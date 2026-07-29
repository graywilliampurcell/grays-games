import * as THREE from 'three';
import { Player } from './Player.js';
import { MazeGenerator } from './MazeGenerator.js';
import { InputManager } from './InputManager.js';
import { CollisionManager } from './CollisionManager.js';

let scene, camera, renderer, player, mazeGenerator, inputManager, collisionManager;
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 200, 500);

    // Camera setup
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(10, 2, 10);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Generate maze
    mazeGenerator = new MazeGenerator(scene, 50, 50, 3);
    mazeGenerator.generate();

    // Player setup
    player = new Player(camera);
    player.position.set(10, 1, 10);

    // Input manager
    inputManager = new InputManager();

    // Collision manager
    collisionManager = new CollisionManager(mazeGenerator.getMazeData());

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    // Update player movement
    player.update(inputManager, collisionManager, deltaTime);

    // Update camera to follow player
    camera.position.copy(player.camera.position);
    camera.rotation.copy(player.camera.rotation);

    // Update FPS
    frameCount++;
    if (now - lastTime > 1000 || frameCount === 1) {
        fps = Math.round(frameCount / ((now - lastTime) / 1000));
        frameCount = 0;
    }

    // Update UI
    updateUI();

    // Render
    renderer.render(scene, camera);
}

function updateUI() {
    const fpsElement = document.getElementById('fps');
    const posElement = document.getElementById('position');

    if (fpsElement) {
        fpsElement.textContent = fps;
    }

    if (posElement) {
        const pos = player.position;
        posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
}

// Initialize on page load
window.addEventListener('load', init);