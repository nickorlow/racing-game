import sys
import os


# goofy but wtv
sys.path.append("../scene_recreation/dust3r")

import numpy as np
import os
import torch
import argparse

from PIL import Image
import cv2
import json
import trimesh

import open3d as o3d
from dust3r.inference import inference, load_model
from dust3r.utils.image import load_images
from dust3r.image_pairs import make_pairs
from dust3r.cloud_opt import global_aligner, GlobalAlignerMode
from dust3r.utils.device import to_numpy
from dust3r.viz import add_scene_cam, CAM_COLORS, OPENGL, pts3d_to_trimesh, cat_meshes

def preprocess(pcd, use_rgb=True, max_points=40000):
        num_points = np.asarray(pcd.points).shape[0]

        if num_points < max_points:
            num_pad_points = max_points - num_points

            if num_pad_points > 0:
                # Randomly select points from the original point cloud for padding
                pad_indices = np.random.randint(0, num_points, size=(num_pad_points,))
                pad_points = np.asarray(pcd.points)[pad_indices]
                if use_rgb:
                    pad_colors = np.asarray(pcd.colors)[pad_indices]
                new_pcd = o3d.geometry.PointCloud()
                new_pcd.points = o3d.utility.Vector3dVector(pad_points)
                if use_rgb:
                    new_pcd.colors = o3d.utility.Vector3dVector(pad_colors)
                pcd += new_pcd
        else:
            pcd = pcd.random_down_sample(max_points / num_points)
            # In case downsampling results in fewer points
            if np.asarray(pcd.points).shape[0] < max_points:
                pcd = preprocess(pcd, use_rgb=use_rgb, max_points=max_points)
        return pcd

def estimate_rotation(plane_model, z_up=True):
    # Normal vector of the plane
    a, b, c, d = plane_model
    n = np.array([a, b, c])

    # Z-axis unit vector
    if z_up:
        k = np.array([0, 0, 1])
    else:
        # z down case
        k = np.array([0, 0, -1])

    # Calculate the rotation axis (cross product of n and k)
    axis = np.cross(n, k)

    # Normalize the rotation axis
    axis_normalized = axis / np.linalg.norm(axis)

    # Calculate the angle of rotation (dot product and arccosine)
    cos_theta = np.dot(n, k) / np.linalg.norm(n)
    theta = np.arccos(cos_theta)
    # theta = 2.1
    print(theta)

    # Rodrigues' rotation formula
    # Skew-symmetric matrix of axis
    axis_skew = np.array([[0, -axis_normalized[2], axis_normalized[1]],
                        [axis_normalized[2], 0, -axis_normalized[0]],
                        [-axis_normalized[1], axis_normalized[0], 0]])

    # Rotation matrix
    R = np.eye(3) + np.sin(theta) * axis_skew + (1 - np.cos(theta)) * np.dot(axis_skew, axis_skew)
    T = np.eye(4)
    T[:3, :3] = R
    return T

def plane_estimation(points, colors, distance_threshold=0.01, ransac_n=3, num_iterations=1000, verbose=True):
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        pcd.colors = o3d.utility.Vector3dVector(colors)
        plane_model, inliers = pcd.segment_plane(distance_threshold=distance_threshold, ransac_n=ransac_n, num_iterations=num_iterations)
        [a, b, c, d] = plane_model
        if verbose:
            print("Plane equation: {:.2f}x + {:.2f}y + {:.2f}z + {:.2f} = 0".format(a, b, c, d))
            print("Number of inliers: {}".format(len(inliers)))
        inlier_cloud = pcd.select_by_index(inliers)
        outlier_cloud = pcd.select_by_index(inliers, invert=True)
        return {
            "plane_model": plane_model,
            "inliers": inliers,
            "inlier_cloud": inlier_cloud,
            "outlier_cloud": outlier_cloud
        }


def create_video(frames, output_path, fps=30):
    height, width, _ = frames[0].shape
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # You can also use 'XVID', 'MJPG', etc.
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    frames = frames[:,:,:,::-1]

    for frame in frames:
        out.write(frame)

    out.release()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--images_folder", type=str, default="./futo")
    parser.add_argument("--dust3r_path", type=str, default="./dust3r")
    parser.add_argument("--out_dir", type=str, default="./pcds_and_meshes")
    parser.add_argument("--id", type=int)

    args = parser.parse_args()

    if not os.path.exists(args.out_dir):
        os.makedirs(args.out_dir)

    dust3r_path = args.dust3r_path

    model_path = os.path.join(dust3r_path, "checkpoints/DUSt3R_ViTLarge_BaseDecoder_512_dpt.pth")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    batch_size = 1
    schedule = 'linear'
    lr = 0.01
    niter = 300

    model = load_model(model_path, device)


    #print("1")
    file_list = os.listdir(args.images_folder)
    for i in range(len(file_list)):
        file_list[i] = os.path.join(args.images_folder, file_list[i])
    num_files = len(file_list)
    max_files = 10
    if num_files > max_files:
        print(f"Too many files, please use less than {max_files}")
    #for i in range(40,96):
    # for i in range(num_files):
    #     file_list.append(os.path.join(args.images_folder, f"image{i}.png"))

    #print("2")
    image_batch_size = max_files
    overlap_percent = 0

    start_idx = 0
    end_idx = image_batch_size

    depths_unormalized = []
    num_depths = 0
    imgs = []
    extrinsics = []
    intrinsics = []
    pts3d_all = []
    col_all = []

    while start_idx < len(file_list) - int(overlap_percent * image_batch_size):

        #always use the first frame to maintain same relative poses
        if start_idx == 0:
            images = load_images(file_list[start_idx:end_idx], size=512)
        else:
            images = load_images([file_list[0]] + file_list[start_idx:end_idx], size=512)

        print("num images:", len(images))

        print(start_idx, end_idx, len(depths_unormalized), num_depths)
        pairs = make_pairs(images, scene_graph='complete', prefilter=None, symmetrize=True)
        output = inference(pairs, model, device, batch_size=batch_size)

        mode = GlobalAlignerMode.PointCloudOptimizer if len(images) > 2 else GlobalAlignerMode.PairViewer
        scene = global_aligner(output, device=device, mode=mode)
        scene.min_conf_thr = float(scene.conf_trf(torch.tensor(3)))

        if mode == GlobalAlignerMode.PointCloudOptimizer:
            loss = scene.compute_global_alignment(init='mst', niter=niter, schedule=schedule, lr=lr)

        scene = scene.clean_pointcloud()

        # retrieve useful values from scene:
        imgs_curr = scene.imgs
        pts3d_curr = scene.get_pts3d()
        intrinsics_curr = scene.get_intrinsics().cpu().detach().numpy()
        extrinsics_curr = scene.get_im_poses().cpu().detach().numpy()

        mask = to_numpy(scene.get_masks())
        pts3d_curr = to_numpy(pts3d_curr)
        imgs_curr = np.array(to_numpy(imgs_curr))
        depths_unormalized_curr = np.array(to_numpy(scene.get_depthmaps()))

        pts3d_unconcat = pts3d_curr
        pts3d_curr = np.concatenate([p[m] for p, m in zip(pts3d_curr, mask)])
        col_curr = np.concatenate([p[m] for p, m in zip(imgs_curr, mask)])


        trimesh_scene_pcd = trimesh.Scene()
        trimesh_scene_mesh = trimesh.Scene()
        

        pcd = trimesh.PointCloud(pts3d_curr.reshape(-1, 3), colors=col_curr.reshape(-1, 3))
        trimesh_scene_pcd.add_geometry(pcd)
        
        meshes = []
        for i in range(imgs_curr.shape[0]):
            meshes.append(pts3d_to_trimesh(imgs_curr[i], pts3d_unconcat[i], mask[i]))
        mesh = trimesh.Trimesh(**cat_meshes(meshes))
        trimesh_scene_mesh.add_geometry(mesh)

        plane_estimation_result = plane_estimation(points=pts3d_curr, colors=col_curr)
        T_xy_plane_align = estimate_rotation(plane_estimation_result["plane_model"], z_up=False)


        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(pts3d_curr)
        pcd.colors = o3d.utility.Vector3dVector(col_curr)
        pcd.transform(T_xy_plane_align)
        trimesh_scene_mesh.apply_transform(T_xy_plane_align)


        np.save(os.path.join(args.out_dir, f"pts3d.npy"), np.asarray(pcd.points))
        np.save(os.path.join(args.out_dir, f"colors.npy"), np.asarray(pcd.colors))
        [a,b,c,d] = plane_estimation_result["plane_model"]
        f = open(os.path.join(args.out_dir, f"plane.txt"), "a")
        f.write(f'{a} {b} {c} {d}')
        f.close()


        outdir = args.out_dir
        #pcd_outfile = os.path.join(outdir, 'pcd.glb')
        mesh_outfile = os.path.join(outdir, f'mesh{args.id}.glb')
        #trimesh_scene_pcd.export(file_obj=pcd_outfile)
        trimesh_scene_mesh.export(file_obj=mesh_outfile)
        o3d.io.write_point_cloud(os.path.join(outdir, f'pcd{args.id}.pcd'), pcd)
        pcd = preprocess(pcd, use_rgb=True, max_points=40000)
        o3d.io.write_point_cloud(os.path.join(outdir, f'pcd_downsampled{args.id}.pcd'), pcd)

        print('(exporting 3D scene to', os.path.join(outdir, f'pcd{args.id}.pcd'), "," , mesh_outfile,')')


        #if end_idx >= len(file_list):
        if start_idx == 0:
            print("ADDING WITH SHAPE", depths_unormalized_curr.shape)
            depths_unormalized.append(depths_unormalized_curr)
            imgs.append(imgs_curr)
            intrinsics.append(intrinsics_curr)
            extrinsics.append(extrinsics_curr)
            pts3d_all.append(pts3d_curr)
            col_all.append(col_curr)
            num_depths += depths_unormalized_curr.shape[0]
        else:
            print("ADDING WITH SHAPE", depths_unormalized_curr[1 + int(image_batch_size * overlap_percent):, ...].shape, 1 + int(image_batch_size * overlap_percent))
            depths_unormalized.append(depths_unormalized_curr[1 + int(image_batch_size * overlap_percent):, ...])
            imgs.append(imgs_curr[1 + int(image_batch_size * overlap_percent):, ...])
            intrinsics.append(intrinsics_curr[1 + int(image_batch_size * overlap_percent):])
            extrinsics.append(extrinsics_curr[1 + int(image_batch_size * overlap_percent):])
            num_depths += depths_unormalized_curr[1 + int(image_batch_size * overlap_percent):, ...].shape[0]
            
        start_idx = end_idx - int(overlap_percent * image_batch_size)
        end_idx = start_idx + image_batch_size

    print(start_idx, end_idx, len(depths_unormalized), num_depths)
    depths_unormalized = np.concatenate(depths_unormalized, axis=0)
    imgs = np.concatenate(imgs, axis=0)
    intrinsics = np.concatenate(intrinsics, axis=0)
    extrinsics = np.concatenate(extrinsics, axis=0)

    print(len(file_list), depths_unormalized.shape[0]); assert len(file_list) == depths_unormalized.shape[0]
    print(len(file_list), imgs.shape[0]); assert len(file_list) == imgs.shape[0]

    create_video((imgs * 255).astype(np.uint8), os.path.join(args.out_dir, "run_dust3r_segment.mp4"))
    



if __name__ == '__main__':
    main()
