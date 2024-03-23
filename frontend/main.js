import * as THREE from 'three';

//const scene = new THREE.Scene();
var scene = new THREE.Scene();
//scene.background = new THREE.Color();
//scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
//const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const fov = 75; // AKA Field of View
//const aspect = 1;
const aspect = window.innerWidth / window.innerHeight;
const near = 0.1; // the near clipping plane
const far = 1000; // the far clipping plane
var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 0;
// we start pointing in the negative Z direction
//camera.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
//camera.rotateY(-Math.PI/2); // initializes us pointing in the positive X direction

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

//Create a DirectionalLight and turn on shadows for the light
const light = new THREE.DirectionalLight( 0xffffff, 10 );
light.position.set( 0, 0, 1 ); //default; light shining from top
light.castShadow = true; // default false
scene.add( light );

//Set up shadow properties for the light
/*
light.shadow.mapSize.width = 512; // default
light.shadow.mapSize.height = 512; // default
light.shadow.camera.near = 0.5; // default
light.shadow.camera.far = 500; // default
*/

/*
const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );
*/

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
//import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const gloader = new GLTFLoader();
//const rloader = new DRACOLoader();
//rloader.setDecoderPath( '/examples/jsm/libs/draco/' );
//gloader.setDRACOLoader(rloader);
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
const dloader = new PCDLoader();
/*
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
const yloader = new PLYLoader();
*/

/*
gloader.load('public/mesh_aligned-transformed.glb', function (nonsense) {
    console.log(nonsense);
    scene.add(nonsense.scene);
}, undefined, function (error) {
    console.error( error );
});
*/


dloader.load('public/pcd_aligned.pcd', function (points) {
    //console.log(points);
	//scene.add( gltf.scene );
    points.rotateX(-Math.PI/2);
    points.rotateZ(Math.PI/2);
    console.log(points);
    var bbox = new THREE.Box3().setFromObject(points);
    var width = bbox.max.x - bbox.min.x;
    var height = bbox.max.y - bbox.min.y;
    var depth = bbox.max.z - bbox.min.z;
    points.position.x = width/2;
    points.position.y = height/2;
    points.position.z = -depth/2;
    scene.add(points);
}, undefined, function (error) {
	console.error( error );
});


/*
yloader.load('public/mesh_aligned.ply', function (p) {
    console.log(':3');
}, undefined, function (error) {
    console.error( error );
});
*/

var motioncst = 0.01;
var navmode = "driving";
var dirvec = new THREE.Vector3(0, 0, -1);
    
if (navmode == "flying") {

    var handleW = function () {
        camera.position.z -= motioncst;
    };
    var handleA = function () {
        camera.position.x -= motioncst;
    };
    var handleS = function () {
        camera.position.z += motioncst;
    };
    var handleD = function () {
        camera.position.x += motioncst;
    };
    var handleZ = function () {
        camera.position.y -= motioncst;
    };
    var handleX = function () {
        camera.position.y += motioncst;
    };
    var handleJ = function () {
        camera.rotateZ(-motioncst);
    };
    var handleL = function () {
        camera.rotateZ(motioncst);
    };
    var handleI = function () {
        camera.rotateX(-motioncst);
    };
    var handleK = function () {
        camera.rotateX(motioncst);
    };
    var handleN = function () {
        camera.rotateY(-motioncst);
    };
    var handleM = function () {
        camera.rotateY(motioncst);
    };

} else if (navmode == "driving") {
    camera.position.y = 0.04;
    var handleW = function () {
        // forwards
        camera.position.x += (motioncst * dirvec.x);
        camera.position.y += (motioncst * dirvec.y);
        camera.position.z += (motioncst * dirvec.z);
    };
    var handleA = function () {
        dirvec.applyAxisAngle(new THREE.Vector3(0, 1, 0), motioncst);
        camera.rotateY(motioncst);
        console.log(dirvec);
    };
    var handleS = function () {
        // backwards
        camera.position.x -= (motioncst * dirvec.x);
        camera.position.y -= (motioncst * dirvec.y);
        camera.position.z -= (motioncst * dirvec.z);
    };
    var handleD = function () {
        dirvec.applyAxisAngle(new THREE.Vector3(0, 1, 0), -motioncst);
        camera.rotateY(-motioncst);
        console.log(dirvec);
    };
    var handleZ = function () {
        camera.position.y -= motioncst;
    };
    var handleX = function () {
        camera.position.y += motioncst;
    };
    
}
    
document.addEventListener("keypress", function (e) {
    e = e || window.event;

    if (e.key == 'w') {
        handleW();
    } else if (e.key == 'a') {
        handleA();
    } else if (e.key == 's') {
        handleS();
    } else if (e.key == 'd') {
        handleD();
    } else if (e.key == 'z') {
        handleZ();
    } else if (e.key == 'x') {
        handleX();
    } else if (e.key == 'j') {
        handleJ();
    } else if (e.key == 'l') {
        handleL();
    } else if (e.key == 'i') {
        handleI();
    } else if (e.key == 'k') {
        handleK();
    } else if (e.key == 'n') {
        handleN();
    } else if (e.key == 'm') {
        handleM();
    }

}, null);

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

/*
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
var fpc = new FirstPersonControls(camera, document);

const stats = THREE.Stats()
document.body.appendChild(stats.dom)
*/

function animate() {
	requestAnimationFrame(animate);
	//cube.rotation.x += 0.01;
	//cube.rotation.y += 0.01;
	renderer.render(scene, camera);
}
animate();

