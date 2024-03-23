import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

Ammo().then(function(Ammo) {
	// - Global variables -
	var DISABLE_DEACTIVATION = 4;
	var TRANSFORM_AUX = new Ammo.btTransform();
	var ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);

	// Graphics variables
	var container, stats, speedometer;
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

		container = document.getElementById( 'container' );
		speedometer = document.getElementById( 'speedometer' );

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
            alert(JSON.stringify(intersects[0].point))
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

	function createWheelMesh(radius, width) {
		var t = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
		t.rotateZ(Math.PI / 2);
		var mesh = new THREE.Mesh(t, materialInteractive);
		mesh.add(new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, radius * 1.75, radius*.25, 1, 1, 1), materialInteractive));
		scene.add(mesh);
		return mesh;
	}

	function createChassisMesh(w, l, h) {
		var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
		var mesh = new THREE.Mesh(shape, materialInteractive);
		scene.add(mesh);
		return mesh;
	}

	function createVehicle(pos, quat) {

		// Vehicle contants

		var chassisWidth = 1.8;
		var chassisHeight = .6;
		var chassisLength = 4;
		var massVehicle = 800;

		var wheelAxisPositionBack = -1;
		var wheelRadiusBack = .4;
		var wheelWidthBack = .3;
		var wheelHalfTrackBack = 1;
		var wheelAxisHeightBack = .3;

		var wheelAxisFrontPosition = 1.7;
		var wheelHalfTrackFront = 1;
		var wheelAxisHeightFront = .3;
		var wheelRadiusFront = .35;
		var wheelWidthFront = .2;

		var friction = 1000;
		var suspensionStiffness = 20.0;
		var suspensionDamping = 2.3;
		var suspensionCompression = 4.4;
		var suspensionRestLength = 0.6;
		var rollInfluence = 0.2;

		var steeringIncrement = .04;
		var steeringClamp = .5;
		var maxEngineForce = 2000;
		var maxBreakingForce = 100;

		// Chassis
		var geometry = new Ammo.btBoxShape(new Ammo.btVector3(chassisWidth * .5, chassisHeight * .5, chassisLength * .5));
		var transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
		transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
		var motionState = new Ammo.btDefaultMotionState(transform);
		var localInertia = new Ammo.btVector3(0, 0, 0);
		geometry.calculateLocalInertia(massVehicle, localInertia);
		var body = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(massVehicle, motionState, geometry, localInertia));
		body.setActivationState(DISABLE_DEACTIVATION);
		physicsWorld.addRigidBody(body);
		var chassisMesh = createChassisMesh(chassisWidth, chassisHeight, chassisLength);

		// Raycast Vehicle
		var engineForce = 0;
		var vehicleSteering = 0;
		var breakingForce = 0;
		var tuning = new Ammo.btVehicleTuning();
		var rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
		var vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
		vehicle.setCoordinateSystem(0, 1, 2);
		physicsWorld.addAction(vehicle);

		// Wheels
		var FRONT_LEFT = 0;
		var FRONT_RIGHT = 1;
		var BACK_LEFT = 2;
		var BACK_RIGHT = 3;
		var wheelMeshes = [];
		var wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
		var wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

		function addWheel(isFront, pos, radius, width, index) {

			var wheelInfo = vehicle.addWheel(
				pos,
				wheelDirectionCS0,
				wheelAxleCS,
				suspensionRestLength,
				radius,
				tuning,
				isFront);

			wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
			wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
			wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
			wheelInfo.set_m_frictionSlip(friction);
			wheelInfo.set_m_rollInfluence(rollInfluence);

			wheelMeshes[index] = createWheelMesh(radius, width);
		}

		addWheel(true, new Ammo.btVector3(wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_LEFT);
		addWheel(true, new Ammo.btVector3(-wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_RIGHT);
		addWheel(false, new Ammo.btVector3(wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_LEFT);
		addWheel(false, new Ammo.btVector3(-wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_RIGHT);

		// Sync keybord actions and physics and graphics
		function sync(dt) {

			var speed = vehicle.getCurrentSpeedKmHour();

			speedometer.innerHTML = (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';

			breakingForce = 0;
			engineForce = 0;

			if (actions.acceleration) {
				if (speed < -1)
					breakingForce = maxBreakingForce;
				else engineForce = maxEngineForce;
			}
			if (actions.braking) {
				if (speed > 1)
					breakingForce = maxBreakingForce;
				else engineForce = -maxEngineForce / 2;
			}
			if (actions.left) {
				if (vehicleSteering < steeringClamp)
					vehicleSteering += steeringIncrement;
			}
			else {
				if (actions.right) {
					if (vehicleSteering > -steeringClamp)
						vehicleSteering -= steeringIncrement;
				}
				else {
					if (vehicleSteering < -steeringIncrement)
						vehicleSteering += steeringIncrement;
					else {
						if (vehicleSteering > steeringIncrement)
							vehicleSteering -= steeringIncrement;
						else {
							vehicleSteering = 0;
						}
					}
				}
			}

			vehicle.applyEngineForce(engineForce, BACK_LEFT);
			vehicle.applyEngineForce(engineForce, BACK_RIGHT);

			vehicle.setBrake(breakingForce / 2, FRONT_LEFT);
			vehicle.setBrake(breakingForce / 2, FRONT_RIGHT);
			vehicle.setBrake(breakingForce, BACK_LEFT);
			vehicle.setBrake(breakingForce, BACK_RIGHT);

			vehicle.setSteeringValue(vehicleSteering, FRONT_LEFT);
			vehicle.setSteeringValue(vehicleSteering, FRONT_RIGHT);

			var tm, p, q, i;
			var n = vehicle.getNumWheels();
			for (i = 0; i < n; i++) {
				vehicle.updateWheelTransform(i, true);
				tm = vehicle.getWheelTransformWS(i);
				p = tm.getOrigin();
				q = tm.getRotation();
				wheelMeshes[i].position.set(p.x(), p.y(), p.z());
				wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
			}

			tm = vehicle.getChassisWorldTransform();
			p = tm.getOrigin();
			q = tm.getRotation();
			chassisMesh.position.set(p.x(), p.y(), p.z());
			chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

            camera.position.set(p.x(), p.y() + 1, p.z());
            camera.quaternion.set(q.x(), q.y(), q.z(), q.w());
            camera.rotateY(Math.PI);
		}

		syncList.push(sync);
	}

	function createObjects() {

		createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, 750, 1, 750, 0, 2, false);

		var quaternion = new THREE.Quaternion(0, 0, 0, 1);
		quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);

        const gltfloader = new GLTFLoader();
        gltfloader.load('public/mesh2.glb', function (gltf) {
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


