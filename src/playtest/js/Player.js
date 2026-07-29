import * as THREE from 'three';

export class Player {
    constructor(camera) {
        this.camera = camera;
        this.position = new THREE.Vector3(10, 1, 10);
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        // Movement parameters
        this.speed = 15; // units per second
        this.jumpHeight = 0;
        this.acceleration = 50;
        this.friction = 0.9;
        
        // Collision
        this.radius = 0.4;
        this.height = 1.8;
        
        // Keys pressed
        this.keysPressed = {};
        
        // Pointer lock for mouse look
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.PI_2 = Math.PI / 2;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.keysPressed[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keysPressed[e.key.toLowerCase()] = false;
        });
        
        // Mouse movement for camera look
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        
        // Pointer lock
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });
    }
    
    onMouseMove(event) {
        if (document.pointerLockElement) {
            const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            
            this.euler.setFromQuaternion(this.camera.quaternion);
            this.euler.rotateY(-movementX * 0.003);
            this.euler.rotateX(-movementY * 0.003);
            this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));
            this.camera.quaternion.setFromEuler(this.euler);
        }
    }
    
    update(inputManager, collisionManager, deltaTime) {
        // Calculate movement direction based on input
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        // Reset direction
        this.direction.set(0, 0, 0);
        
        // Handle input
        if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
            this.direction.add(forward);
        }
        if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
            this.direction.sub(forward);
        }
        if (this.keysPressed['a'] || this.keysPressed['arrowleft']) {
            this.direction.sub(right);
        }
        if (this.keysPressed['d'] || this.keysPressed['arrowright']) {
            this.direction.add(right);
        }
        
        // Normalize direction
        if (this.direction.length() > 0) {
            this.direction.normalize();
        }
        
        // Apply acceleration
        this.velocity.x += this.direction.x * this.acceleration * deltaTime;
        this.velocity.z += this.direction.z * this.acceleration * deltaTime;
        
        // Apply friction
        this.velocity.x *= this.friction;
        this.velocity.z *= this.friction;
        
        // Limit max speed
        const horizontalSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (horizontalSpeed > this.speed) {
            this.velocity.x = (this.velocity.x / horizontalSpeed) * this.speed;
            this.velocity.z = (this.velocity.z / horizontalSpeed) * this.speed;
        }
        
        // Apply velocity
        const newPosition = this.position.clone();
        newPosition.x += this.velocity.x * deltaTime;
        newPosition.z += this.velocity.z * deltaTime;
        
        // Collision check
        if (collisionManager.isPositionValid(newPosition, this.radius)) {
            this.position.copy(newPosition);
        } else {
            // Try sliding along walls
            const slideX = this.position.clone();
            slideX.x += this.velocity.x * deltaTime;
            if (collisionManager.isPositionValid(slideX, this.radius)) {
                this.position.copy(slideX);
                this.velocity.z = 0;
            } else {
                const slideZ = this.position.clone();
                slideZ.z += this.velocity.z * deltaTime;
                if (collisionManager.isPositionValid(slideZ, this.radius)) {
                    this.position.copy(slideZ);
                    this.velocity.x = 0;
                } else {
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                }
            }
        }
        
        // Update camera position
        this.camera.position.set(this.position.x, this.position.y + 1.6, this.position.z);
    }
}