export class InputManager {
    constructor() {
        this.keysPressed = {};
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keysPressed[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keysPressed[e.key.toLowerCase()] = false;
        });
    }
    
    isKeyPressed(key) {
        return this.keysPressed[key.toLowerCase()] || false;
    }
    
    getMovementInput() {
        return {
            forward: this.isKeyPressed('w') || this.isKeyPressed('arrowup'),
            backward: this.isKeyPressed('s') || this.isKeyPressed('arrowdown'),
            left: this.isKeyPressed('a') || this.isKeyPressed('arrowleft'),
            right: this.isKeyPressed('d') || this.isKeyPressed('arrowright')
        };
    }
}