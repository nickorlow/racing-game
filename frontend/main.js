import * as THREE from 'three';

var scene = new THREE.Scene();

const fov = 75; // AKA Field of View
const aspect = window.innerWidth / window.innerHeight;
const near = 0.1; // the near clipping plane
const far = 1000; // the far clipping plane
var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 0;
// we start pointing in the negative Z direction

const color = 0xFFFFFF;
const intensity = 100;
const light = new THREE.DirectionalLight(color, intensity);
light.position.set(0, 10, 0);
light.target.position.set(0, 0, -1);
scene.add(light);
scene.add(light.target);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
const dloader = new PCDLoader();

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const gloader = new GLTFLoader();

dloader.load('public/pcd_aligned.pcd', function (points) {
//gloader.load('public/mesh2.glb', function (points) {
    //console.log(points);
	//scene.add( gltf.scene );
    //points = points.scene;
    points.rotateX(-Math.PI/2);
    points.rotateZ(Math.PI/2);
    console.log(points);
    var bbox = new THREE.Box3().setFromObject(points);
    var width = bbox.max.x - bbox.min.x;
    var height = bbox.max.y - bbox.min.y;
    var depth = bbox.max.z - bbox.min.z;
    //points.position.x = width/2;
    points.position.y = height/2;
    points.position.z = -depth/2;
    scene.add(points);
}, undefined, function (error) {
	console.error( error );
});

var motioncst = 0.01;
var dirvec = new THREE.Vector3(0, 0, -1);
var accel = 0;
var turndir = 0;

var handleW = function () {
    // forwards
    camera.position.x += (motioncst * dirvec.x);
    camera.position.y += (motioncst * dirvec.y);
    camera.position.z += (motioncst * dirvec.z);
};
var turn = function () {
    if (turndir != 0) {
        dirvec.applyAxisAngle(new THREE.Vector3(0, 1, 0), motioncst);
        camera.rotateY(motioncst);
        console.log(dirvec);
    }
};
var turn_right = function () {
    dirvec.applyAxisAngle(new THREE.Vector3(0, 1, 0), -motioncst);
    camera.rotateY(-motioncst);
    console.log(dirvec);
};
var handleS = function () {
    // backwards
    camera.position.x -= (motioncst * dirvec.x);
    camera.position.y -= (motioncst * dirvec.y);
    camera.position.z -= (motioncst * dirvec.z);
};

var handleZ = function () {
    camera.position.y -= motioncst;
};
var handleX = function () {
    camera.position.y += motioncst;
};
    
document.addEventListener("keydown", function (e) {
    e = e || window.event;

    if (e.key == 'w') {
        accel = 1;
    } else if (e.key == 'a') {
        turndir = -1;
    } else if (e.key == 's') {
        accel = -1;
    } else if (e.key == 'd') {
        turndir = 1;
    }
}, null);

document.addEventListener("keyup", function (e) {
    e = e || window.event;

    if (e.key == 'w') {
        accel = 0;
    } else if (e.key == 'a') {
        turndir = 0;
    } else if (e.key == 's') {
        accel = 0;
    } else if (e.key == 'd') {
        turndir = 0;
    }
});

const geometry = new THREE.BoxGeometry( 1, 1, 1 );

const material0 = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
const cube0 = new THREE.Mesh( geometry, material0 );
cube0.position.set(10, 0, 0);
scene.add(cube0);

const material1 = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube1 = new THREE.Mesh( geometry, material1 );
cube1.position.set(0, 10, 0);
scene.add(cube1);

const material2 = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
const cube2 = new THREE.Mesh( geometry, material2 );
cube2.position.set(0, 0, 10);
scene.add(cube2);

const material3 = new THREE.MeshBasicMaterial( { color: 0x00ffff } );
const cube3 = new THREE.Mesh( geometry, material3 );
cube3.position.set(-10, 0, 0);
scene.add(cube3);

const material4 = new THREE.MeshBasicMaterial( { color: 0xff00ff } );
const cube4 = new THREE.Mesh( geometry, material4 );
cube4.position.set(0, -10, 0);
scene.add(cube4);

const material5 = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
const cube5 = new THREE.Mesh( geometry, material5 );
cube5.position.set(0, 0, -10);
scene.add(cube5);

var prev_timestamp = Date.now();
    
function animate () {
    var now = Date.now();
    var elapsed = now - prev_timestamp;
    prev_timestamp = now;
    
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}
animate();

