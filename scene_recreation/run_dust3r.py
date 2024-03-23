import sys
import os

sys.path.append("./dust3r")

import numpy as np
import os
import torch
import argparse

from PIL import Image
import cv2
import json
import trimesh

from dust3r.inference import inference, load_model
from dust3r.utils.image import load_images
from dust3r.image_pairs import make_pairs
from dust3r.cloud_opt import global_aligner, GlobalAlignerMode
from dust3r.utils.device import to_numpy
from dust3r.viz import add_scene_cam, CAM_COLORS, OPENGL, pts3d_to_trimesh, cat_meshes


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

        np.save(os.path.join(args.out_dir, f"pts3d.npy"), pts3d_curr)
        np.save(os.path.join(args.out_dir, f"colors.npy"), col_curr)

        trimesh_scene_pcd = trimesh.Scene()
        trimesh_scene_mesh = trimesh.Scene()
        

        pcd = trimesh.PointCloud(pts3d_curr.reshape(-1, 3), colors=col_curr.reshape(-1, 3))
        trimesh_scene_pcd.add_geometry(pcd)
        
        meshes = []
        for i in range(imgs_curr.shape[0]):
            meshes.append(pts3d_to_trimesh(imgs_curr[i], pts3d_unconcat[i], mask[i]))
        mesh = trimesh.Trimesh(**cat_meshes(meshes))
        trimesh_scene_mesh.add_geometry(mesh)

        outdir = args.out_dir
        pcd_outfile = os.path.join(outdir, 'pcd.glb')
        mesh_outfile = os.path.join(outdir, 'mesh.glb')
        print('(exporting 3D scene to', pcd_outfile, "," , mesh_outfile,')')
        trimesh_scene_pcd.export(file_obj=pcd_outfile)
        trimesh_scene_mesh.export(file_obj=mesh_outfile)


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