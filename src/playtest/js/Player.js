import * as THREE from 'three';
import { DEFAULT_SETTINGS } from './settings.js';

// A quick tap on an arrow pad button still moves you a little
const NUDGE_SECONDS = 0.15;

// Taps on these pass through to the page as normal taps (menus, buttons, sliders)
const PAGE_UI = 'button, #menu, #escaped, #thanks';

export class Player {
    constructor(camera, settings = DEFAULT_SETTINGS) {
        this.camera = camera;
        this.settings = settings;
        this.position = new THREE.Vector3(10, 0, 10);
        this.frozen = false; // true while a message like "You got out!" is showing
        this.paused = false; // true while the pause menu is open
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        // Movement parameters
        this.speed = 15; // units per second
        this.jumpHeight = 0;
        this.acceleration = 50;
        this.friction = 0.9;
        this.turnSpeed = Math.PI / 2; // radians per second for held turns (90°/s)

        // Sliding on a slippery spot: { dir, speed, left } while it lasts
        this.slide = null;
        // Being shoved by a water current, or bounced by a marshmallow (with a
        // hop: how high the arc goes): { from, to, time, length, hop } while it lasts
        this.shove = null;
        this.carried = false; // in the air in a hot-air balloon (Volcano World): look only
        // How fast you walk compared with normal (0.5 on sticky caramel, Level 52 on)
        this.sticky = 1;

        // Collision
        this.radius = 0.4;
        this.height = 1.8;

        // Keys pressed
        this.keysPressed = {};

        // Touch controls. Circles setup: bottom-left circle walks (drag direction =
        // walk direction), bottom-right circle looks. Simple setup: the bottom-left
        // circle alone walks forward/back and turns. Arrows setup: two arrow pads.
        this.touchMove = { x: 0, y: 0 };
        this.lookEdge = { x: 0, y: 0 }; // look finger held at/past the circle's edge
        this.moveTouchId = null;
        this.lookTouchId = null;
        this.walkCircle = document.getElementById('walk-circle');
        this.lookCircle = document.getElementById('look-circle');
        this.padTouches = new Map(); // touch id -> { action, startedAt }
        this.nudges = {}; // action -> time (ms) a quick tap keeps it going until

        // Which way the camera faces (turned by arrow keys and touch look)
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

        // Touch events (passive: false so we can stop the page from scrolling/zooming)
        document.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        document.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
    }

    look(yaw, pitch) {
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.euler.y -= yaw;
        this.euler.x -= pitch;
        this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
    }

    // Which way the player is facing: { yaw, pitch } in radians
    facing() {
        const e = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(this.camera.quaternion);
        return { yaw: e.y, pitch: e.x };
    }

    // Level the view (for setups that can't look up or down)
    levelView() {
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.euler.x = 0;
        this.camera.quaternion.setFromEuler(this.euler);
    }

    // Put the player at a spot, stopped, looking along the given heading (radians)
    resetTo(position, yaw, pitch = 0) {
        this.position.copy(position);
        this.velocity.set(0, 0, 0);
        this.slide = null;
        this.shove = null;
        this.euler.set(pitch, yaw, 0);
        this.camera.quaternion.setFromEuler(this.euler);
        this.camera.position.set(this.position.x, this.position.y + 1.6, this.position.z);
    }

    // Let go of everything: keys, circles, pads (used when pausing and resuming)
    releaseAll() {
        this.keysPressed = {};
        this.moveTouchId = null;
        this.lookTouchId = null;
        this.touchMove.x = 0;
        this.touchMove.y = 0;
        this.lookEdge.x = 0;
        this.lookEdge.y = 0;
        this.padTouches.clear();
        this.nudges = {};
        this.moveKnob(this.walkCircle, 0, 0);
        this.moveKnob(this.lookCircle, 0, 0);
        document.querySelectorAll('.pad-btn.pressed').forEach((b) => b.classList.remove('pressed'));
    }

    // Centre and radius of a circle on screen (radius 0 when it's hidden)
    circleCentre(circle) {
        const r = circle.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 };
    }

    touchOnCircle(touch, circle) {
        if (!circle) return null;
        const c = this.circleCentre(circle);
        if (c.radius === 0) return null; // circle hidden (not a touch screen, or another setup)
        // A little slack around the edge so small fingers still land on it
        return Math.hypot(touch.clientX - c.x, touch.clientY - c.y) <= c.radius * 1.3 ? c : null;
    }

    onTouchStart(event) {
        // Let taps on menus and buttons (e.g. "Play again", ⏸) through as normal taps
        if (event.target.closest && event.target.closest(PAGE_UI)) return;
        event.preventDefault();
        // First touch: show the touch controls even on a touch laptop
        if (!document.body.classList.contains('touch')) {
            document.body.classList.add('touch');
            document.dispatchEvent(new Event('mazle:touch'));
        }
        if (this.paused) return;
        for (const touch of event.changedTouches) {
            let centre;
            const padButton = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.pad-btn');
            if (padButton) {
                this.padTouches.set(touch.identifier, { action: padButton.dataset.action, button: padButton, startedAt: performance.now() });
                padButton.classList.add('pressed');
            } else if (this.moveTouchId === null && (centre = this.touchOnCircle(touch, this.walkCircle))) {
                this.moveTouchId = touch.identifier;
                this.moveOrigin = centre;
                this.updateWalk(touch);
            } else if (this.lookTouchId === null && (centre = this.touchOnCircle(touch, this.lookCircle))) {
                this.lookTouchId = touch.identifier;
                this.lookOrigin = centre;
                this.lookLast = { x: touch.clientX, y: touch.clientY };
                this.updateLookEdge(touch);
            }
        }
    }

    // How far the knob can move from the circle's centre, in screen pixels
    knobTravel(centre) {
        return centre.radius * 0.8;
    }

    // Walk joystick: knob follows the finger inside the circle; direction and
    // distance from the centre set walking direction and speed
    updateWalk(touch) {
        const travel = this.knobTravel(this.moveOrigin);
        let dx = touch.clientX - this.moveOrigin.x;
        let dy = touch.clientY - this.moveOrigin.y;
        const dist = Math.hypot(dx, dy);
        if (dist > travel) {
            dx = (dx / dist) * travel;
            dy = (dy / dist) * travel;
        }
        this.touchMove.x = dx / travel;
        this.touchMove.y = dy / travel;
        this.moveKnob(this.walkCircle, dx, dy);
    }

    // Look circle: with the finger at or past the circle's edge, keep turning
    // (and tilting) that way; inside the circle there is no extra turn
    updateLookEdge(touch) {
        const dx = touch.clientX - this.lookOrigin.x;
        const dy = touch.clientY - this.lookOrigin.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= this.lookOrigin.radius) {
            this.lookEdge.x = dx / dist;
            this.lookEdge.y = dy / dist;
        } else {
            this.lookEdge.x = 0;
            this.lookEdge.y = 0;
        }
        this.moveKnob(this.lookCircle, dx, dy);
    }

    // Move a circle's knob by (dx, dy) screen pixels, clamped to the circle
    moveKnob(circle, dx, dy) {
        const knob = circle?.querySelector('.knob');
        if (!knob) return;
        const rect = circle.getBoundingClientRect();
        const scale = circle.offsetWidth ? rect.width / circle.offsetWidth : 1; // size setting
        const travel = (rect.width / 2) * 0.8;
        const dist = Math.hypot(dx, dy);
        if (dist > travel) {
            dx = (dx / dist) * travel;
            dy = (dy / dist) * travel;
        }
        knob.style.transform = `translate(${dx / scale}px, ${dy / scale}px)`;
    }

    onTouchMove(event) {
        if (!(event.target.closest && event.target.closest(PAGE_UI))) event.preventDefault();
        if (this.paused) return;
        for (const touch of event.changedTouches) {
            if (touch.identifier === this.moveTouchId) {
                this.updateWalk(touch);
            } else if (touch.identifier === this.lookTouchId) {
                // The view follows the finger exactly: no smoothing or momentum.
                // Dragging across the right half of the screen turns 180°.
                const radiansPerPixel = Math.PI / (window.innerWidth / 2);
                this.look((touch.clientX - this.lookLast.x) * radiansPerPixel, (touch.clientY - this.lookLast.y) * radiansPerPixel);
                this.lookLast = { x: touch.clientX, y: touch.clientY };
                this.updateLookEdge(touch);
            }
        }
    }

    onTouchEnd(event) {
        if (!(event.target.closest && event.target.closest(PAGE_UI))) event.preventDefault();
        for (const touch of event.changedTouches) {
            if (touch.identifier === this.moveTouchId) {
                this.moveTouchId = null;
                this.touchMove.x = 0;
                this.touchMove.y = 0;
                this.moveKnob(this.walkCircle, 0, 0);
            } else if (touch.identifier === this.lookTouchId) {
                this.lookTouchId = null;
                this.lookEdge.x = 0;
                this.lookEdge.y = 0;
                this.moveKnob(this.lookCircle, 0, 0);
            } else if (this.padTouches.has(touch.identifier)) {
                const { action, button, startedAt } = this.padTouches.get(touch.identifier);
                this.padTouches.delete(touch.identifier);
                button.classList.remove('pressed');
                // A quick tap keeps going for a moment so it always moves you a little
                this.nudges[action] = Math.max(this.nudges[action] || 0, startedAt + NUDGE_SECONDS * 1000);
            }
        }
    }

    // Is an arrow pad button held (or still finishing a quick tap)?
    padActive(action, now) {
        for (const t of this.padTouches.values()) if (t.action === action) return true;
        return (this.nudges[action] || 0) > now;
    }

    // What the controls ask for this frame: walk forward/back and sideways
    // (-1..1), and turn/tilt rates (-1..1 of the 90°/s turn speed)
    readControls() {
        const k = this.keysPressed;
        const keyboard = this.settings.keyboardSetup;
        const touch = this.settings.touchSetup;
        let forward = 0;
        let sideways = 0;
        let turn = 0;
        let tilt = 0;

        // Keyboard. Every setup: ↑/↓ walk, ←/→ turn.
        if (k.arrowup) forward += 1;
        if (k.arrowdown) forward -= 1;
        const leftRight = (k.arrowright ? 1 : 0) - (k.arrowleft ? 1 : 0);
        if (keyboard === 'shift' && k.shift) sideways += leftRight; // Shift + ←/→ side-steps
        else turn += leftRight;
        if (keyboard === 'full') {
            if (k.w) forward += 1;
            if (k.s) forward -= 1;
            if (k.d) sideways += 1;
            if (k.a) sideways -= 1;
        }

        // Touch
        if (touch === 'simple') {
            // One circle: up/down walks, left/right turns (90°/s at the edge)
            forward -= this.touchMove.y;
            turn += this.touchMove.x;
        } else {
            // Circles (and the bots' joystick): walk circle walks and side-steps
            forward -= this.touchMove.y;
            sideways += this.touchMove.x;
            turn += this.lookEdge.x;
            tilt += this.lookEdge.y;
        }
        if (touch === 'arrows') {
            const now = performance.now();
            if (this.padActive('forward', now)) forward += 1;
            if (this.padActive('back', now)) forward -= 1;
            if (this.padActive('step-left', now)) sideways -= 1;
            if (this.padActive('step-right', now)) sideways += 1;
            if (this.padActive('turn-left', now)) turn -= 1;
            if (this.padActive('turn-right', now)) turn += 1;
            if (this.padActive('look-up', now)) tilt -= 1;
            if (this.padActive('look-down', now)) tilt += 1;
        }

        const clamp = (v) => Math.max(-1, Math.min(1, v));
        return { forward, sideways, turn: clamp(turn), tilt: clamp(tilt) };
    }

    update(inputManager, collisionManager, deltaTime) {
        if (this.frozen || this.paused) return;

        const controls = this.readControls();
        if (controls.turn || controls.tilt) {
            this.look(controls.turn * this.turnSpeed * deltaTime, controls.tilt * this.turnSpeed * deltaTime);
        }

        // In the air in a hot-air balloon (Volcano World): you can look
        // around but not move; main.js holds you in the basket
        if (this.carried) {
            this.velocity.set(0, 0, 0);
            return;
        }

        // A water current is carrying you: you can look around, but you go
        // where it takes you, smoothly, then it lets go (Level 41)
        if (this.shove) {
            const sh = this.shove;
            sh.time = Math.min(sh.length, sh.time + deltaTime);
            const t = sh.time / sh.length;
            const eased = t * t * (3 - 2 * t);
            this.position.lerpVectors(sh.from, sh.to, eased);
            this.velocity.set(0, 0, 0);
            if (sh.time >= sh.length) this.shove = null;
            // A bounce goes up and down in an arc; a current's shove stays on the floor
            const lift = sh.hop ? sh.hop * 4 * t * (1 - t) : 0;
            this.camera.position.set(this.position.x, this.position.y + 1.6 + lift, this.position.z);
            return;
        }

        // Calculate movement direction based on input
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        this.direction.set(0, 0, 0);
        this.direction.addScaledVector(forward, controls.forward);
        this.direction.addScaledVector(right, controls.sideways);

        // Normalize direction (only when over full speed, to keep joystick analog)
        if (this.direction.length() > 1) {
            this.direction.normalize();
        }

        if (this.slide) {
            // Sliding: keep going the same way at the same speed, whatever is pressed
            this.velocity.x = this.slide.dir.x * this.slide.speed;
            this.velocity.z = this.slide.dir.z * this.slide.speed;
        } else {
            // Apply acceleration
            this.velocity.x += this.direction.x * this.acceleration * deltaTime;
            this.velocity.z += this.direction.z * this.acceleration * deltaTime;

            // Apply friction
            this.velocity.x *= this.friction;
            this.velocity.z *= this.friction;
        }
        const before = this.position.clone();

        // Limit max speed
        const horizontalSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (horizontalSpeed > this.speed) {
            this.velocity.x = (this.velocity.x / horizontalSpeed) * this.speed;
            this.velocity.z = (this.velocity.z / horizontalSpeed) * this.speed;
        }

        // Apply velocity (slowed down on sticky caramel)
        const moveTime = deltaTime * this.sticky;
        const newPosition = this.position.clone();
        newPosition.x += this.velocity.x * moveTime;
        newPosition.z += this.velocity.z * moveTime;

        // Collision check
        if (collisionManager.isPositionValid(newPosition, this.radius)) {
            this.position.copy(newPosition);
        } else {
            // Try sliding along walls
            const slideX = this.position.clone();
            slideX.x += this.velocity.x * moveTime;
            if (collisionManager.isPositionValid(slideX, this.radius)) {
                this.position.copy(slideX);
                this.velocity.z = 0;
            } else {
                const slideZ = this.position.clone();
                slideZ.z += this.velocity.z * moveTime;
                if (collisionManager.isPositionValid(slideZ, this.radius)) {
                    this.position.copy(slideZ);
                    this.velocity.x = 0;
                } else {
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                }
            }
        }

        // The slide ends after its distance, or at once if a wall stops it
        if (this.slide) {
            const moved = Math.hypot(this.position.x - before.x, this.position.z - before.z);
            this.slide.left -= moved;
            if (this.slide.left <= 0 || moved < this.slide.speed * moveTime * 0.5) this.slide = null;
        }

        // Update camera position
        this.camera.position.set(this.position.x, this.position.y + 1.6, this.position.z);
    }

    // Get carried to `to` over `length` seconds (a water current's shove), in
    // an arc `hop` high at its top (a marshmallow's bounce)
    startShove(to, length, hop = 0) {
        this.slide = null;
        this.velocity.set(0, 0, 0);
        this.shove = { from: this.position.clone(), to: new THREE.Vector3(to.x, this.position.y, to.z), time: 0, length, hop };
    }

    // Slide `distance` further the way you're moving now (a slippery spot)
    startSlide(distance, minSpeed) {
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        if (speed < 0.5) return false;
        const dir = new THREE.Vector3(this.velocity.x / speed, 0, this.velocity.z / speed);
        this.slide = { dir, speed: Math.max(speed, minSpeed), left: distance };
        return true;
    }
}
