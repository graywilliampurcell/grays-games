import * as THREE from 'three';

export class MazeGenerator {
    constructor(scene, width, depth, height) {
        this.scene = scene;
        this.width = width;
        this.depth = depth;
        this.height = height;
        this.mazeData = [];
        this.blockSize = 1;
    }
    
    generate() {
        // Simple maze pattern (hardcoded for now)
        // 1 = wall, 0 = empty
        this.createBorder();
        this.createInternalMaze();
        this.renderMaze();
    }
    
    createBorder() {
        // Create border walls
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                if (!this.mazeData[x]) this.mazeData[x] = [];
                if (!this.mazeData[x][z]) this.mazeData[x][z] = [];
                
                // Border
                if (x === 0 || x === this.width - 1 || z === 0 || z === this.depth - 1) {
                    for (let y = 0; y < this.height; y++) {
                        this.mazeData[x][z][y] = 1; // Wall
                    }
                } else {
                    for (let y = 0; y < this.height; y++) {
                        this.mazeData[x][z][y] = 0; // Empty
                    }
                }
            }
        }
    }
    
    createInternalMaze() {
        // Create some internal walls for a simple maze
        const corridors = [
            { x: 10, z: 10, dx: 30, dz: 0 }, // Horizontal corridor
            { x: 25, z: 5, dx: 0, dz: 40 },  // Vertical corridor
            { x: 5, z: 25, dx: 40, dz: 0 },  // Another horizontal
        ];
        
        for (const corridor of corridors) {
            const steps = Math.max(Math.abs(corridor.dx), Math.abs(corridor.dz));
            for (let i = 0; i < steps; i++) {
                const x = Math.min(Math.max(corridor.x + Math.round(corridor.dx * i / steps), 1), this.width - 2);
                const z = Math.min(Math.max(corridor.z + Math.round(corridor.dz * i / steps), 1), this.depth - 2);
                
                for (let y = 0; y < this.height; y++) {
                    if (this.mazeData[x] && this.mazeData[x][z]) {
                        this.mazeData[x][z][y] = 0; // Empty (corridor)
                    }
                }
                
                // Add width to corridors
                if (x + 1 < this.width - 1 && this.mazeData[x + 1] && this.mazeData[x + 1][z]) {
                    for (let y = 0; y < this.height; y++) {
                        this.mazeData[x + 1][z][y] = 0;
                    }
                }
                if (z + 1 < this.depth - 1 && this.mazeData[x] && this.mazeData[x][z + 1]) {
                    for (let y = 0; y < this.height; y++) {
                        this.mazeData[x][z + 1][y] = 0;
                    }
                }
            }
        }
    }
    
    renderMaze() {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355 }); // Brown
        const wallGeometry = new THREE.BoxGeometry(this.blockSize, this.blockSize, this.blockSize);
        
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                for (let y = 0; y < this.height; y++) {
                    if (this.mazeData[x] && this.mazeData[x][z] && this.mazeData[x][z][y] === 1) {
                        const mesh = new THREE.Mesh(wallGeometry, wallMaterial);
                        mesh.position.set(x, y, z);
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        this.scene.add(mesh);
                    }
                }
            }
        }
        
        // Add floor
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x90ee90 }); // Light green
        const floorGeometry = new THREE.BoxGeometry(this.width, 0.2, this.depth);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(this.width / 2 - 0.5, -0.1, this.depth / 2 - 0.5);
        floor.receiveShadow = true;
        this.scene.add(floor);
    }
    
    getMazeData() {
        return this.mazeData;
    }
}