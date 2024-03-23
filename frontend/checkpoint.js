import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const container = document.getElementById( 'container' );
const infoDiv = document.getElementById( 'info' );
const reviewDiv = document.getElementById('review')

reviewDiv.style.display = 'none'

Ammo().then(function(Ammo) {
	// - Global variables -
	var DISABLE_DEACTIVATION = 4;
	var TRANSFORM_AUX = new Ammo.btTransform();
	var ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);

	// Graphics variables
	var stats;
	var camera, controls, scene, renderer;
	var clock = new THREE.Clock();
	var materialDynamic, materialStatic, materialInteractive;

	// Physics variables
	var collisionConfiguration;
	var dispatcher;
	var broadphase;
	var solver;
	var physicsWorld;

	var syncList = [];
	var time = 0;

	// Keybord actions
	var actions = {};
	var keysActions = {
		"KeyW":'acceleration',
		"KeyS":'braking',
		"KeyA":'left',
		"KeyD":'right'
	};

	// - Functions -

	function initGraphics() {

		scene = new THREE.Scene();

		camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );
		camera.position.x = -4.84;
		camera.position.y = 4.39;
		camera.position.z = -35.11;
		camera.lookAt( new THREE.Vector3( 0.33, -0.40, 0.85 ) );

		renderer = new THREE.WebGLRenderer({antialias:true});
		renderer.setClearColor( 0xbfd1e5 );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		controls = new OrbitControls( camera, renderer.domElement );

		var ambientLight = new THREE.AmbientLight( 0x404040 );
		scene.add( ambientLight );

		var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
		dirLight.position.set( 10, 10, 5 );
		scene.add( dirLight );

		materialDynamic = new THREE.MeshPhongMaterial( { color:0xfca400 } );
		materialStatic = new THREE.MeshPhongMaterial( { color:0x999999 } );
		materialInteractive=new THREE.MeshPhongMaterial( { color:0x990000 } );

		container.innerHTML = "";

		container.appendChild( renderer.domElement );

        
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0px';
		container.appendChild( stats.domElement );

		window.addEventListener( 'resize', onWindowResize, false );
		window.addEventListener( 'keydown', keydown);
		window.addEventListener( 'keyup', keyup);
        window.addEventListener( 'dblclick', dblclick);
	}

	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}

	function initPhysics() {

		// Physics configuration
		collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
		dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
		broadphase = new Ammo.btDbvtBroadphase();
		solver = new Ammo.btSequentialImpulseConstraintSolver();
		physicsWorld = new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration );
		physicsWorld.setGravity( new Ammo.btVector3( 0, -9.82, 0 ) );
	}

	function tick() {
		requestAnimationFrame( tick );
		var dt = clock.getDelta();
		for (var i = 0; i < syncList.length; i++)
			syncList[i](dt);
		physicsWorld.stepSimulation( dt, 10 );
		//controls.update( dt );
		renderer.render( scene, camera );
		time += dt;
		stats.update();
	}

	function keyup(e) {
		if(keysActions[e.code]) {
			actions[keysActions[e.code]] = false;
			e.preventDefault();
			e.stopPropagation();
			return false;
		} else {
			console.log(reviewDiv.style.display )
			const reviewHidden = reviewDiv.style.display === 'none'
			if (!reviewHidden && e.code === "Escape") {
				reviewDiv.style.display = "none"
			}
			else if (reviewHidden && e.code === "Space") {
				reviewDiv.style.display = "flex"
			}
			else if (reviewHidden && e.code === "Backspace") {
				
			}
		}
	}
	function keydown(e) {
		if(keysActions[e.code]) {
			actions[keysActions[e.code]] = true;
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
	}
    function dblclick(e) {
        console.log(e);
        var mouse_position = {};
        mouse_position.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse_position.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(mouse_position, camera);
        const mesh = scene.children[2]
        const intersects = rayCaster.intersectObjects([mesh], true);
        console.log(intersects.length)
        if (intersects.length > 0) {
            console.log(JSON.stringify(intersects[0].point))
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({
                    color: 0xff0000
                }));
            mesh.position.set(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);
            scene.add(mesh);
        }
    }
    
	function createBox(pos, quat, w, l, h, mass, friction, render = true) {
		var material = mass > 0 ? materialDynamic : materialStatic;
		var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
		var geometry = new Ammo.btBoxShape(new Ammo.btVector3(w * 0.5, l * 0.5, h * 0.5));

		if(!mass) mass = 0;
		if(!friction) friction = 1;

		var mesh = new THREE.Mesh(shape, material);
		mesh.position.copy(pos);
		mesh.quaternion.copy(quat);
        if (render) {
		    scene.add( mesh );
        }
        
		var transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
		transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
		var motionState = new Ammo.btDefaultMotionState(transform);

		var localInertia = new Ammo.btVector3(0, 0, 0);
		geometry.calculateLocalInertia(mass, localInertia);

		var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, geometry, localInertia);
		var body = new Ammo.btRigidBody(rbInfo);

		body.setFriction(friction);
		//body.setRestitution(.9);
		//body.setDamping(0.2, 0.2);

		physicsWorld.addRigidBody( body );

		if (mass > 0) {
			body.setActivationState(DISABLE_DEACTIVATION);
			// Sync physics and graphics
			function sync(dt) {
				var ms = body.getMotionState();
				if (ms) {
					ms.getWorldTransform(TRANSFORM_AUX);
					var p = TRANSFORM_AUX.getOrigin();
					var q = TRANSFORM_AUX.getRotation();
					mesh.position.set(p.x(), p.y(), p.z());
					mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
				}
			}

			syncList.push(sync);
		}
	}


	function createObjects() {
		const urlParams = new URLSearchParams(window.location.search);
		console.log(urlParams.get('room_id'))

		createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, 750, 1, 750, 0, 2, false);

		var quaternion = new THREE.Quaternion(0, 0, 0, 1);
		quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);

        const gltfloader = new GLTFLoader();
        gltfloader.load(`/room/mesh_map/${urlParams.get('room_id')}`, function (gltf) {
            const color = 0xFFFFFF;
            const intensity = 10;
            const light = new THREE.DirectionalLight(color, intensity);
            light.position.set(0, 100, 0);
            light.target.position.set(0, 0, 0);

            var szene = gltf.scene;
            var kvec = new THREE.Vector3(100, 100, 100);
            szene.scale.copy(kvec);
            szene.rotateX(-Math.PI/2);
            szene.rotateZ(Math.PI/2);
            console.log(szene);
            var bbox = new THREE.Box3().setFromObject(szene);
            console.log(bbox);
            var width = bbox.max.x - bbox.min.x;
            var height = bbox.max.y - bbox.min.y;
            var depth = bbox.max.z - bbox.min.z;
            szene.position.y = 9.7;
            szene.position.z = -depth/2;
            scene.add(szene);
        }, undefined, function (error) {
	        console.error( error );
        });
        
	}

	// - Init -
	initGraphics();
	initPhysics();
	createObjects();
	tick();

});


