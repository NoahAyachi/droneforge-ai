import * as THREE from 'three';

/**
 * @class PhysicsEngine
 * @description Manages the physics simulation for the drone and its environment.
 * This class handles the integration of Ammo.js physics with Three.js rendering.
 */
class PhysicsEngine {
  /**
   * @constructor
   * @param {DroneControls} controls - The drone controls instance.
   */
  constructor(controls) {
    this.controls = controls;
    this.rigidBodies = [];
    this.physicsWorld = null;
    this.Ammo = null;
    this.tmpTransformation = null;
    this.clockDelta = 0;
    this.lastTime = performance.now();

    // === Setting Variables === //
    // These variables can later be integrated with the UI for dynamic adjustments
    this.settings = {
      droneMass: 0.25, // kg (250g)
      dragCoefficient: 0.47, // Approximate for a cube
      liftCoefficient: 0.3, // Example value, should be based on drone's design
      frontalArea: 0.25, // m^2 (for a cube with side 1m)
      airDensity: 1.225, // kg/m^3 at sea level
      maxThrust: 1, // N per motor (adjusted for hover)
      torqueStrength: 0.5, // Adjust as needed for responsiveness
      maxVelocity: 50, // m/s
      maxAngularVelocity: 10, // rad/s
      useIndividualMotors: false, // Flag to switch control modes
      motorPositions: [ // Positions of the motors relative to the drone's center
        new THREE.Vector3(1, 0, 1),   // Motor 1: Front-Right
        new THREE.Vector3(-1, 0, 1),  // Motor 2: Front-Left
        new THREE.Vector3(-1, 0, -1), // Motor 3: Rear-Left
        new THREE.Vector3(1, 0, -1)   // Motor 4: Rear-Right
      ],
      motorThrusts: [0.6125, 0.6125, 0.6125, 0.6125] // Initial thrust values for each motor (0 to 1)
    };
    // === End of Setting Variables === //
    
    this.droneMass = this.settings.droneMass;
  }

  /**
   * @method init
   * @async
   * @param {THREE.Scene} scene - The Three.js scene to which physics objects will be added.
   * @description Initializes the physics engine, loading Ammo.js and setting up the physics world.
   */
  async init(scene) {
    this.scene = scene;
    
    await this.loadAmmo();
    
    if (!this.Ammo) {
      console.error('Ammo.js could not be loaded!');
      return;
    }

    this.setupPhysicsWorld();
    this.createPhysicsObjects();
    this.tmpTransformation = new this.Ammo.btTransform();
  }

  /**
   * @method loadAmmo
   * @private
   * @returns {Promise} A promise that resolves when Ammo.js is loaded.
   * @description Loads the Ammo.js library.
   */
  loadAmmo() {
    return new Promise((resolve) => {
      if (window.Ammo) {
        this.Ammo = window.Ammo;
        resolve();
      } else {
        window.addEventListener('ammo-loaded', () => {
          this.Ammo = window.Ammo;
          resolve();
        });
      }
    });
  }

  /**
   * @method setupPhysicsWorld
   * @private
   * @description Sets up the Ammo.js physics world with default settings.
   */
  setupPhysicsWorld() {
    const collisionConfiguration = new this.Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new this.Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new this.Ammo.btDbvtBroadphase();
    const solver = new this.Ammo.btSequentialImpulseConstraintSolver();

    this.physicsWorld = new this.Ammo.btDiscreteDynamicsWorld(
      dispatcher,
      broadphase,
      solver,
      collisionConfiguration
    );
    this.physicsWorld.setGravity(new this.Ammo.btVector3(0, -9.81, 0));

    // Increase solver iterations for better accuracy
    const solverInfo = this.physicsWorld.getSolverInfo();
    if (solverInfo.m_numIterations !== undefined) {
      solverInfo.m_numIterations = 20; // Increased from default
    } else {
      console.warn('Unable to set solver iterations. This may affect simulation accuracy.');
    }
  }

  /**
   * @method createPhysicsObjects
   * @private
   * @description Creates the initial physics objects in the world (ground and drone).
   */
  createPhysicsObjects() {
    this.createGround();
    this.createDronePhysics();
  }

  /**
   * @method createGround
   * @private
   * @description Creates a static ground plane in the physics world.
   */
  createGround() {
    const groundShape = new this.Ammo.btBoxShape(new this.Ammo.btVector3(500, 0.5, 500));
    const groundTransform = new this.Ammo.btTransform();
    groundTransform.setIdentity();
    groundTransform.setOrigin(new this.Ammo.btVector3(0, -0.5, 0));

    const mass = 0;
    const localInertia = new this.Ammo.btVector3(0, 0, 0);
    const motionState = new this.Ammo.btDefaultMotionState(groundTransform);
    const rbInfo = new this.Ammo.btRigidBodyConstructionInfo(mass, motionState, groundShape, localInertia);
    const body = new this.Ammo.btRigidBody(rbInfo);

    this.physicsWorld.addRigidBody(body);
  }

  /**
   * @method createDronePhysics
   * @private
   * @description Creates the physics representation of the drone.
   */
  createDronePhysics() {
    if (!this.scene.drone) {
      setTimeout(() => this.createDronePhysics(), 100);
      return;
    }

    const droneMesh = this.scene.drone;
    const position = droneMesh.position;
    const quaternion = droneMesh.quaternion;
    
    // Create a bounding box for the drone model
    const box = new THREE.Box3().setFromObject(droneMesh);
    const size = box.getSize(new THREE.Vector3());
    const dimensions = new this.Ammo.btVector3(size.x / 2, size.y / 2, size.z / 2);

    const shape = new this.Ammo.btBoxShape(dimensions);
    const transform = new this.Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new this.Ammo.btVector3(position.x, position.y, position.z));
    transform.setRotation(new this.Ammo.btQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w));

    const localInertia = new this.Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(this.droneMass, localInertia);

    const motionState = new this.Ammo.btDefaultMotionState(transform);
    const rbInfo = new this.Ammo.btRigidBodyConstructionInfo(this.droneMass, motionState, shape, localInertia);
    this.droneRigidBody = new this.Ammo.btRigidBody(rbInfo);
    
    this.droneRigidBody.setDamping(0.7, 0.7);
    this.droneRigidBody.setActivationState(4);

    this.physicsWorld.addRigidBody(this.droneRigidBody);
    this.rigidBodies.push({ mesh: droneMesh, body: this.droneRigidBody });
  }

  /**
   * @method update
   * @public
   * @description Updates the physics simulation. Should be called once per frame.
   */
  update() {
    const now = performance.now();
    this.clockDelta = (now - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = now;

    if (this.physicsWorld) {
      this.physicsWorld.stepSimulation(this.clockDelta, 10);

      if (this.droneRigidBody) {
        this.applyAerodynamics();
        this.applyControlsToDrone();
      }

      this.updateMeshPositions();
    }
  }

  /**
   * @method updateMeshPositions
   * @private
   * @description Updates the positions of Three.js meshes based on their physics representations.
   */
  updateMeshPositions() {
    for (let i = 0; i < this.rigidBodies.length; i++) {
      const objThree = this.rigidBodies[i].mesh;
      const objAmmo = this.rigidBodies[i].body;
      const ms = objAmmo.getMotionState();
      if (ms) {
        ms.getWorldTransform(this.tmpTransformation);
        const p = this.tmpTransformation.getOrigin();
        const q = this.tmpTransformation.getRotation();

        // Ensure valid numerical values
        const x = isFinite(p.x()) ? p.x() : objThree.position.x;
        const y = isFinite(p.y()) ? p.y() : objThree.position.y;
        const z = isFinite(p.z()) ? p.z() : objThree.position.z;
        const qx = isFinite(q.x()) ? q.x() : objThree.quaternion.x;
        const qy = isFinite(q.y()) ? q.y() : objThree.quaternion.y;
        const qz = isFinite(q.z()) ? q.z() : objThree.quaternion.z;
        const qw = isFinite(q.w()) ? q.w() : objThree.quaternion.w;

        objThree.position.set(x, y, z);
        objThree.quaternion.set(qx, qy, qz, qw);

        // Limit maximum linear velocity
        const velocity = objAmmo.getLinearVelocity();
        const currentSpeed = velocity.length();
        const maxVelocity = this.settings.maxVelocity; // m/s

        if (currentSpeed > maxVelocity) {
          const scale = maxVelocity / currentSpeed;
          velocity.setX(velocity.x() * scale);
          velocity.setY(velocity.y() * scale);
          velocity.setZ(velocity.z() * scale);
          objAmmo.setLinearVelocity(velocity);
        }

        // Limit maximum angular velocity
        const angularVelocity = objAmmo.getAngularVelocity();
        const currentAngSpeed = angularVelocity.length();
        const maxAngularVelocity = this.settings.maxAngularVelocity; // rad/s

        if (currentAngSpeed > maxAngularVelocity) {
          const scale = maxAngularVelocity / currentAngSpeed;
          angularVelocity.setX(angularVelocity.x() * scale);
          angularVelocity.setY(angularVelocity.y() * scale);
          angularVelocity.setZ(angularVelocity.z() * scale);
          objAmmo.setAngularVelocity(angularVelocity);
        }
      }
    }
  }

  /**
   * @method applyAerodynamics
   * @private
   * @description Applies aerodynamic forces to the drone based on its current state.
   */
  applyAerodynamics() {
    const velocity = this.droneRigidBody.getLinearVelocity();
    const speed = velocity.length();
    
    const airDensity = this.settings.airDensity; // kg/m^3

    // Drag Calculations
    const dragCoefficient = this.settings.dragCoefficient;
    const frontalArea = this.settings.frontalArea;
    const dragMagnitude = 0.5 * dragCoefficient * frontalArea * airDensity * speed * speed;

    if (speed > 0) {
      const dragForce = new this.Ammo.btVector3(-velocity.x(), -velocity.y(), -velocity.z());
      dragForce.normalize();
      dragForce.op_mul(dragMagnitude);
      this.droneRigidBody.applyCentralForce(dragForce);
      
      
    }

    // Lift Calculations
    const liftCoefficient = this.settings.liftCoefficient;
    const liftMagnitude = 0.5 * liftCoefficient * airDensity * speed * speed;

    // Calculate lift direction based on drone's orientation
    const droneTransform = this.droneRigidBody.getWorldTransform();
    const rotation = droneTransform.getRotation();
    const threeQuat = new THREE.Quaternion(rotation.x(), rotation.y(), rotation.z(), rotation.w());
    const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(threeQuat);
    upVector.normalize();

    const liftForce = new this.Ammo.btVector3(upVector.x * liftMagnitude, upVector.y * liftMagnitude, upVector.z * liftMagnitude);
    this.droneRigidBody.applyCentralForce(liftForce);
    
    
  }

  /**
   * @method applyControlsToDrone
   * @private
   * @description Applies control inputs to the drone's physics representation.
   */
  applyControlsToDrone() {
    const controls = this.controls.getControlInputs();
    
    const maxThrust = this.settings.maxThrust; // N
    const torqueStrength = this.settings.torqueStrength; // Adjust as needed for responsiveness

    // Get drone's current orientation
    const droneTransform = this.droneRigidBody.getWorldTransform();
    const rotation = droneTransform.getRotation();
    
    // Convert Ammo.js quaternion to Three.js quaternion
    const ammoQuat = rotation;
    const threeQuat = new THREE.Quaternion(ammoQuat.x(), ammoQuat.y(), ammoQuat.z(), ammoQuat.w());
    
    if (this.settings.useIndividualMotors) {
      // === Individual Motor Control Mode === ==
      
      // Extract individual motor thrusts from controls
      const motorThrusts = controls.motorThrusts;

      // Apply thrusts to individual motors
      for (let i = 1; i <= 4; i++) {
        const motorKey = `motor${i}`;
        const motorThrust = motorThrusts[motorKey];

        // Skip if motor thrust is not defined
        if (motorThrust === undefined) continue;

        // Calculate thrust force in world space
        const thrustLocal = new THREE.Vector3(0, motorThrust * maxThrust, 0);
        const thrustWorldVector = thrustLocal.clone().applyQuaternion(threeQuat);
        
        // Convert to Ammo.js vector
        const thrustWorld = new this.Ammo.btVector3(thrustWorldVector.x, thrustWorldVector.y, thrustWorldVector.z);
        
        // Get motor position in world space
        const motorPositionLocal = this.settings.motorPositions[i - 1]; // Array is 0-indexed
        const originAmmo = droneTransform.getOrigin();
        const origin = new THREE.Vector3(originAmmo.x(), originAmmo.y(), originAmmo.z());
        const motorPositionWorld = motorPositionLocal.clone().applyQuaternion(threeQuat).add(origin);
        const motorPosAmmo = new this.Ammo.btVector3(motorPositionWorld.x, motorPositionWorld.y, motorPositionWorld.z);
        
        // Apply force at motor position
        this.droneRigidBody.applyForce(thrustWorld, motorPosAmmo);
        
        // **Do Not** destroy Ammo.js vectors here unless necessary
        // this.Ammo.destroy(thrustWorld);
        // this.Ammo.destroy(motorPosAmmo);
      }
    } else {
      // === Standard Control Mode === ==
      const thrustForce = controls.throttle * maxThrust;
      
      // Calculate local thrust vector and rotate it to world space
      const thrustLocal = new THREE.Vector3(0, thrustForce, 0);
      const thrustWorldVector = thrustLocal.clone().applyQuaternion(threeQuat);
      
      // Convert back to Ammo.js vector
      const thrustWorld = new this.Ammo.btVector3(thrustWorldVector.x, thrustWorldVector.y, thrustWorldVector.z);

      // Apply central thrust
      this.droneRigidBody.applyCentralForce(thrustWorld);
      
      // Define local torques based on control inputs
      const torqueLocal = new THREE.Vector3(
        torqueStrength * controls.roll,          // Roll
        torqueStrength * -controls.yaw,         // Yaw (inverted)
        torqueStrength * controls.pitch         // Pitch
      );

      // Rotate the local torque vector to world space
      const torqueWorldVector = torqueLocal.clone().applyQuaternion(threeQuat);
      
      // Convert the rotated torque vector back to Ammo.js btVector3
      const torqueWorld = new this.Ammo.btVector3(torqueWorldVector.x, torqueWorldVector.y, torqueWorldVector.z);

      // Apply the transformed torque to the drone
      this.droneRigidBody.applyTorque(torqueWorld);
      
      
      // **Do Not** destroy Ammo.js vectors here unless necessary
      // this.Ammo.destroy(thrustWorld);
      // this.Ammo.destroy(torqueWorld);
    }
  }
}

export default PhysicsEngine;
