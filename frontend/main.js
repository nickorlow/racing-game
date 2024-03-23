import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const startGameButton = document.getElementById("startButton")
const submitUsernameButton = document.getElementById("submitUsername")
const usernameInput = document.getElementById("usernameInput")
const usernameDiv = document.getElementById("usernameDiv")
const gameInfoDiv = document.getElementById("gameInfo")
const racerList = document.getElementById("racers")
gameInfoDiv.style.display = "none"
const makeLobbyButton = document.getElementById("makeLobby")
const makeLobbyDiv = document.getElementById("makeLobbyDiv")
const makeLobbyInput = document.getElementById("lobbyInput")
makeLobbyDiv.style.display = "none"
let username = ""

const startGameDiv = document.getElementById("startPopup")
const container = document.getElementById( 'container' );
const speedometer = document.getElementById( 'speedometer' );
const existingRoomsDiv = document.getElementById("existingRooms")

let socket = null
let roomID = ""
//container.setAttribute("hidden", true)
startGameButton.onclick = () => {
	socket.send(JSON.stringify({
        msgType: "RoomStateChange",
        newState: "RACING"
    }))
	sendIt()
}
makeLobbyButton.onclick = makeLobby


function submitUsernameAction() {
	if (usernameInput.value.length > 0) {
		findRooms()
		makeLobbyDiv.style.display = "flex"
		usernameDiv.style.display = "none"
		username = usernameInput.value
		console.log(username)

	}
}

submitUsernameButton.onclick = submitUsernameAction

//async function spinUp() {
	//container.setAttribute("hidden", false)
	//startGameButton.setAttribute("hidden", true)

await Ammo()
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
var frameNum = 0;

// Keybord actions
var actions = {};
var keysActions = {
	"KeyW":'acceleration',
	"KeyS":'braking',
	"KeyA":'left',
	"KeyD":'right'
};

const userMap = new Map();
const locationMap = new Map();
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
	//controls = new OrbitControls( camera, renderer.domElement );

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
		function sync(dt, nc) {
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
		syncListLocal.push(sync, true);
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

function createVehicle(pos, quat, isLocalUser, test) {


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
        console.warn(test + " test " + isLocalUser);
        if (isLocalUser) {
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
            let wheelpos = []
        		for (i = 0; i < n; i++) {
        			vehicle.updateWheelTransform(i, true);
        			tm = vehicle.getWheelTransformWS(i);
        			p = tm.getOrigin();
        			q = tm.getRotation();
        			wheelMeshes[i].position.set(p.x(), p.y(), p.z());
        			wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
        			    wheelpos.push({
                            position: {x: p.x(), y: p.y(), z: p.z()},
                            rotation: { x: q.x(), y: q.y(), z: q.z(), w: q.w()}
                        });
        		}
        
        		//console.log(`${p.x()} ${p.y()} ${p.z()}`)
        
        		tm = vehicle.getChassisWorldTransform();
        		p = tm.getOrigin();
        		q = tm.getRotation();
        		chassisMesh.position.set(p.x(), p.y(), p.z());
        		chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
                
        

                frameNum += 1;
                if (frameNum % 120) {
                    let locdata = {
                            chassis: {
                                position: {
                                    x: p.x(),
                                    y: p.y(),
                                    z: p.z()
                                },
                                rotation: {
                                    x: q.x(),
                                    y: q.y(),
                                    z: q.z(),
                                    w: q.w()
                                },
                                velocity: {
                                    x: vehicle.getForwardVector().x(),
                                    y: vehicle.getForwardVector().y(),
                                    z: vehicle.getForwardVector().z()
                                }
                            },
                            wheels: wheelpos 
                       };

        	       socket.send(JSON.stringify({
                       msgType: "PositionUpdate",
                       name: username,
                       data: locdata
                   }))
        		
        		tm = vehicle.getChassisWorldTransform();
        		p = tm.getOrigin();
        		q = tm.getRotation();

                camera.position.set(p.x(), p.y() + 1, p.z());
        		camera.quaternion.set(q.x(), q.y(), q.z(), q.w());
        		camera.rotateY(Math.PI);
                }
        } else {
                if (locationMap.has(test)) {
                    let locationData = locationMap.get(test)
        		    //var tm, p, q, i;
        		    //var n = vehicle.getNumWheels();
        		    //for (i = 0; i < n; i++) {
        		    //	vehicle.updateWheelTransform(i, true);
        		    //	tm = vehicle.getWheelTransformWS(i);
        		    //	p = tm.getOrigin();
        		    //	q = tm.getRotation();
        		    //	wheelMeshes[i].position.set(p.x(), p.y(), p.z());
        		    //	wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
        		    //}
        
        		    ////console.log(`${p.x()} ${p.y()} ${p.z()}`)
        
        		    //tm = vehicle.getChassisWorldTransform();
        		    //p = tm.getOrigin();
        		    //q = tm.getRotation();

        		    //chassisMesh.position.set(p.x(), p.y(), p.z());
        		    //chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
        		    var n = vehicle.getNumWheels();
        		    for (i = 0; i < n; i++) {
        		    	wheelMeshes[i].position.set(locationData.wheels[i].position.x, locationData.wheels[i].position.y, locationData.wheels[i].position.z);
        		    	wheelMeshes[i].quaternion.set(locationData.wheels[i].rotation.x, locationData.wheels[i].rotation.y, locationData.wheels[i].rotation.z, locationData.wheels[i].rotation.w);
        		    }
        		    chassisMesh.position.set(locationData.chassis.position.x, locationData.chassis.position.y, locationData.chassis.position.z);
        		    chassisMesh.quaternion.set(locationData.chassis.rotation.x, locationData.chassis.rotation.y, locationData.chassis.rotation.z, locationData.chassis.rotation.w);
                } else {
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

                    console.log(vehicle)
                    console.log(vehicle.updateVehicle.toString())
                    console.log(vehicle.updateVehicle.toString())
                    console.log(vehicle.updateVehicle())
        
        		    //console.log(`${p.x()} ${p.y()} ${p.z()}`)
        
        		    tm = vehicle.getChassisWorldTransform();
        		    p = tm.getOrigin();
        		    q = tm.getRotation();
        		    chassisMesh.position.set(p.x(), p.y(), p.z());
        		    chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
                }
        }
	}

	syncList.push(sync);
}

function createObjects() {

	createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, 750, 1, 750, 0, 2, false);

	var quaternion = new THREE.Quaternion(0, 0, 0, 1);
	quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);
	//createBox(new THREE.Vector3(0, -1.5, 0), quaternion, 8, 4, 10, 0);

	var size = 2;
	/*
	var nw = 8;
	var nh = 6;
	for (var j = 0; j < nw; j++)
		for (var i = 0; i < nh; i++)
			createBox(new THREE.Vector3(size * j - (size * (nw - 1)) / 2, size * i, 10), ZERO_QUATERNION, size, size, size, 10);
	*/

	const pcdloader = new PCDLoader();
	pcdloader.load(`/room/pc_map_down/${roomID}`, function (points) {
		//console.log(points);
		var kvec = new THREE.Vector3(100, 100, 100);
		points.scale.copy(kvec);
		console.log(kvec);
		points.rotateX(-Math.PI/2);
		points.rotateZ(Math.PI/2);
		//console.log(points);
		var bbox = new THREE.Box3().setFromObject(points);
		console.log(bbox);
		var width = bbox.max.x - bbox.min.x;
		var height = bbox.max.y - bbox.min.y;
		var depth = bbox.max.z - bbox.min.z;
		//points.position.x = width/2;
		points.position.y = 9.7;
		points.position.z = -depth/2;
		scene.add(points);

		points.geometry.rotateX(-Math.PI/2);
		points.geometry.rotateZ(Math.PI/2);
		var kgeom = points.geometry.getAttribute('position').array;
		var itsz = points.geometry.getAttribute('position').itemSize;
		console.log(itsz);
		var kgeomlen = kgeom.length / itsz;
		var xaxis = new THREE.Vector3(1, 0, 0);
		var zaxis = new THREE.Vector3(0, 0, 1);
		for (var i = 0; i < kgeomlen; i += 20) {
			var kx = kgeom[i * 3];
			var ky = kgeom[i * 3 + 1];
			var kz = kgeom[i * 3 + 2];
			//console.log(kx + ' ' + ky + ' ' + kz);
			var kvec2 = new THREE.Vector3(kx, ky, kz);
			kvec2.applyAxisAngle(xaxis, -Math.PI/2);
			kvec2.applyAxisAngle(zaxis, -Math.PI/2);
			kvec2.multiplyScalar(100);
			kvec2.y += 8;
			kvec2.z -= depth/2;
			createBox(kvec2, ZERO_QUATERNION, size, size, size, 0, 2, false);
		}
	}, undefined, function (error) {
		console.error(error);
	});

	const gltfloader = new GLTFLoader();
	gltfloader.load(`/room/mesh_map/${roomID}`, function (gltf) {
		const color = 0xFFFFFF;
		const intensity = 10;
		const light = new THREE.DirectionalLight(color, intensity);
		light.position.set(0, 100, 0);
		light.target.position.set(0, 0, 0);
		//scene.add(light);
		////scene.add(light.target);

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
		//szene.position.x = width/2;
		szene.position.y = 9.7;
		szene.position.z = -depth/2;
		scene.add(szene);
		//scene.add(bbox);

		//createVehicle(new THREE.Vector3(0, 4, -20), ZERO_QUATERNION);
		//createVehicle(new THREE.Vector3(0, 4, -40), ZERO_QUATERNION);

		createVehicle(new THREE.Vector3(-20, 4, -97), ZERO_QUATERNION, true, "ME");


        for (const [key, value] of userMap.entries()) {
		    createVehicle(new THREE.Vector3(-25, 10, -97), ZERO_QUATERNION, false, key);
        }

		//createVehicle(new THREE.Vector3((bbox.min.x + bbox.max.x) / 2 + 5, 4, bbox.min.z), ZERO_QUATERNION);
		// -23.06685447692871 0.4176217019557953 -97.69366455078125

	}, undefined, function (error) {
		console.error( error );
	});
	
}

// - Init -

function sendIt() {
	startGameDiv.style.display = "none"
	console.log("meow")
	initGraphics();
	initPhysics();
	createObjects();
	tick();
}

function socketMessageHandler(e) {
	console.log(e.data)
    let msgObj = JSON.parse(e.data)
    switch (msgObj.msgType) {
        case "RacerInfo":
            let newUsername = msgObj. name
            if (!userMap.has(newUsername)) {
	            socket.send(JSON.stringify({
                    msgType: "RacerInfo",
                    name: username
                }))
                userMap.set(newUsername, "idk"); /* can store user's car model or smth here */
				racerList.innerText = [username, ...userMap.keys()].join(', ')
            }
            break;
        case "RoomStateChange":
            switch (msgObj.newState) {
                case "RACING":
                    sendIt();
                    break;
            }
            break;
        case "PositionUpdate":
            locationMap.set(msgObj.name, msgObj.data);
            break;
    }
}

function waitForSocketConnection(socket, callback){
    setTimeout(
        function () {
            if (socket.readyState === 1) {
                console.log("Connection is made")
                if (callback != null){
                    callback();
                }
            } else {
                console.log("wait for connection...")
                waitForSocketConnection(socket, callback);
            }

        }, 5); // wait 5 milisecond for the connection...
}

async function joinRoom(room) {
	if (username.length > 0) {
		socket = new WebSocket(`wss://able-willingly-moose.ngrok-free.app/ws/${room.id}`)
		socket.onmessage = socketMessageHandler
		makeLobbyDiv.style.display = "none"
		gameInfoDiv.style.display = "flex"
		const gameName = document.createElement("p")
		gameName.innerText = room.name
		gameInfoDiv.insertBefore(gameName, racerList)
		existingRoomsDiv.style.display = "none"

        waitForSocketConnection(socket, function(){
	        socket.send(JSON.stringify({
                msgType: "RacerInfo",
                name: username
            }))

	        makeLobbyButton.style.display = "none"
	        startGameButton.disabled = false
	        existingRoomsDiv.style.display = "none"
        });

    } else {
        alert("Please enter a username");
    }
}


async function findRooms() {
	const res = await fetch("https://able-willingly-moose.ngrok-free.app/rooms")
	const data = await res.json()
	if (data && Array.isArray(data) && data.length > 0) {
		const header = document.createElement("p")
		header.innerText = "Existing Rooms"
		existingRoomsDiv.appendChild(header)
		for (const room of data) {
			const roomDesc = document.createElement("div")
			roomDesc.classList.add("roomDesc")
			const roomText = document.createElement("p")
			roomText.innerText = `${room.name} ${room.id}`
			const roomSelector = document.createElement("button")
			roomSelector.onclick = () => joinRoom(room)
			roomSelector.innerText = "Select"
			roomDesc.appendChild(roomText)
			roomDesc.appendChild(roomSelector)
			existingRoomsDiv.appendChild(roomDesc)
		}
	}
}


async function makeLobby() {
	const name = makeLobbyInput.value
	if (name.length === 0) return;

	var payload = {name};
    //var type = root.lookupType("RoomCreationRequest");
    //var msg = type.create(payload);
    //var buf = type.encode(msg).finish();

    const url = "/room";
	try {
		const response = await fetch(url, {
			method: "POST", // *GET, POST, PUT, DELETE, etc.
			mode: "cors", // no-cors, *cors, same-origin
			cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
			credentials: "same-origin", // include, *same-origin, omit
			headers: {
				// "Content-Type": "application/json",
				// 'Content-Type': 'application/x-www-form-urlencoded',
				//"Content-Type": "text/plain",
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*"
			},
			//redirect: "follow", // manual, *follow, error
			//referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
			body: JSON.stringify(payload) // buf, // body data type must match "Content-Type" header
		})
		
		//const encoder = new TextEncoder();
		///const ntype = root.lookupType("Room");
				
		const data = await response.json()
		socket = new WebSocket(`wss://able-willingly-moose.ngrok-free.app/ws/${data.id}`)
		socket.onmessage = socketMessageHandler
	  
		makeLobbyDiv.style.display = "none"
		existingRoomsDiv.style.display = "none"
		gameInfoDiv.style.display = "flex"
		const gameName = document.createElement("p")
		gameName.innerText = name
		gameInfoDiv.insertBefore(gameName, racerList)

	} catch (e) {
		console.error(e);

	}
}



//}	

