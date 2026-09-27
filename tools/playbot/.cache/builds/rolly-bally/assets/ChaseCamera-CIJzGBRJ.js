import { D as MeshBasicMaterial, E as Mesh, N as Vector3, O as MeshLambertMaterial, T as Matrix4, b as InstancedMesh, f as CircleGeometry, j as Quaternion, l as BoxGeometry, n as makeBallGeometry, r as makeSkinMaterial, w as MathUtils } from "./index-Cs7XvCIe.js";
//#region src/fx/Dust.js
var MAX = 24;
var LIFE = .55;
var Dust = class {
	/**
	* @param {THREE.Object3D} scene
	* @param {number|string} [color=0xffffff]
	*/
	constructor(scene, color = 16777215) {
		this.scene = scene;
		const geo = new BoxGeometry(.22, .22, .22);
		const mat = new MeshLambertMaterial({
			color,
			flatShading: true,
			transparent: true,
			opacity: .8
		});
		this.mesh = new InstancedMesh(geo, mat, MAX);
		this.mesh.name = "dust";
		this.mesh.frustumCulled = false;
		this.mesh.count = 0;
		scene.add(this.mesh);
		this.parts = Array.from({ length: MAX }, () => ({
			life: 0,
			p: new Vector3(),
			v: new Vector3(),
			spin: 0
		}));
		this.next = 0;
		this.live = 0;
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._s = new Vector3();
		this._axis = new Vector3(.3, 1, .2).normalize();
	}
	setColor(color) {
		this.mesh.material.color.set(color);
	}
	/**
	* Burst of `n` blocks around `pos` (the contact point), scaled by `power` 0..1.
	*/
	puff(pos, power = 1, n = 10) {
		const k = Math.max(.3, Math.min(1, power));
		for (let i = 0; i < n; i++) {
			const d = this.parts[this.next];
			this.next = (this.next + 1) % MAX;
			const a = i / n * Math.PI * 2 + this.next % 3 * .4;
			d.life = LIFE * (.8 + .4 * (i * 7 % 5) / 5);
			d.p.set(pos.x + Math.cos(a) * .35, pos.y + .1, pos.z + Math.sin(a) * .35);
			const sp = (2 + i * 3 % 4 * .5) * k;
			d.v.set(Math.cos(a) * sp, (1.5 + i % 3 * .6) * k, Math.sin(a) * sp);
			d.spin = (i % 2 ? 1 : -1) * 6;
		}
		this.live = MAX;
	}
	update(dt) {
		if (!this.live) return;
		let count = 0;
		for (const d of this.parts) {
			if (d.life <= 0) continue;
			d.life -= dt;
			if (d.life <= 0) continue;
			d.v.y -= 9 * dt;
			d.v.multiplyScalar(1 - 3 * dt);
			d.p.addScaledVector(d.v, dt);
			const s = Math.min(1, d.life / (LIFE * .6));
			this._q.setFromAxisAngle(this._axis, d.spin * d.life);
			this._m.compose(d.p, this._q, this._s.setScalar(s));
			this.mesh.setMatrixAt(count++, this._m);
		}
		this.mesh.count = count;
		this.mesh.instanceMatrix.needsUpdate = true;
		if (!count) this.live = 0;
	}
	dispose() {
		this.mesh.removeFromParent();
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
		this.mesh.dispose();
	}
};
//#endregion
//#region src/ball/Ball.js
var BALL_RADIUS = .5;
/** Default feel. Modes override per difficulty via ball.setTuning({...}). */
var DEFAULT_TUNING = {
	speedCap: 8,
	accel: 14,
	airControl: .35,
	turnAssist: 1.6,
	capDrag: 3,
	autoRoll: false,
	cruise: .7,
	slow: .3,
	lateral: .9
};
var UP$1 = new Vector3(0, 1, 0);
var Ball = class {
	/**
	* @param {object} opts
	* @param {import('../core/Physics.js').Physics} opts.physics
	* @param {THREE.Object3D} opts.scene parent for the mesh
	* @param {{x,y,z}} opts.position spawn position (center of the ball)
	* @param {string} [opts.skin='red'] skin id
	* @param {object} [opts.tuning] overrides for DEFAULT_TUNING
	* @param {boolean} [opts.shadow=true] draw a blob shadow under the ball
	* @param {boolean} [opts.dust=true] puff of dust blocks on hard landings
	*/
	constructor({ physics, scene, position, skin = "red", tuning = {}, shadow = true, dust = true, radius = BALL_RADIUS }) {
		this.physics = physics;
		this.radius = radius;
		this.tuning = {
			...DEFAULT_TUNING,
			...tuning
		};
		const { body, collider } = physics.addDynamicBall({
			position,
			radius,
			mass: 1,
			friction: .8,
			restitution: .2,
			linearDamping: .05,
			angularDamping: .6,
			ccd: true,
			tag: "ball",
			data: this
		});
		this.body = body;
		this.collider = collider;
		this.mesh = new Mesh(makeBallGeometry(radius), makeSkinMaterial(skin));
		this.mesh.name = "ball";
		scene.add(this.mesh);
		this.skin = skin;
		this.shadow = null;
		if (shadow) {
			this.shadow = new Mesh(new CircleGeometry(radius * .95, 20).rotateX(-Math.PI / 2), new MeshBasicMaterial({
				color: 0,
				transparent: true,
				opacity: .3,
				depthWrite: false
			}));
			this.shadow.renderOrder = 1;
			scene.add(this.shadow);
		}
		this.scene = scene;
		this.dust = dust ? new Dust(scene) : null;
		this.prev = new Vector3().copy(position);
		this.position = new Vector3().copy(position);
		this.velocity = new Vector3();
		this.grounded = false;
		this.groundNormal = new Vector3(0, 1, 0);
		this.boostTime = 0;
		this.boostCapScale = 1;
		this.frozen = false;
		this.popTime = 1;
		/** Called with (position, direction) after respawn(). */
		this.onRespawn = null;
		/** Called with (impactSpeed m/s) when the ball lands after a real drop/jump. */
		this.onLand = null;
		this.airTime = 0;
		this._airVy = 0;
		this._d = new Vector3();
		this._r = new Vector3();
		this._vh = new Vector3();
		this._down = {
			x: 0,
			y: -1,
			z: 0
		};
	}
	setTuning(partial) {
		Object.assign(this.tuning, partial);
	}
	setSkin(id) {
		if (id === this.skin) return;
		this.mesh.material.dispose();
		this.mesh.material = makeSkinMaterial(id);
		this.skin = id;
	}
	/** Current physics position (not interpolated). */
	getPosition(out = new Vector3()) {
		const t = this.body.translation();
		return out.set(t.x, t.y, t.z);
	}
	getVelocity(out = new Vector3()) {
		const v = this.body.linvel();
		return out.set(v.x, v.y, v.z);
	}
	/** Total speed in m/s. */
	get speed() {
		const v = this.body.linvel();
		return Math.hypot(v.x, v.y, v.z);
	}
	/** Horizontal speed in m/s. */
	get groundSpeed() {
		const v = this.body.linvel();
		return Math.hypot(v.x, v.z);
	}
	isGrounded() {
		return this.grounded;
	}
	_probeGround() {
		const t = this.body.translation();
		const hit = this.physics.raycast(t, this._down, this.radius + .2, { excludeBody: this.body });
		this.grounded = !!hit && hit.normal.y > .35;
		if (hit) this.groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
		return hit;
	}
	/**
	* One fixed step of control. Call before the physics step.
	* @param {number} dt
	* @param {{x:number,y:number}} move input (x right, y forward) in [-1,1]
	* @param {THREE.Vector3} forward horizontal "forward" (camera or track direction)
	*/
	update(dt, move, forward) {
		const t = this.body.translation();
		this.prev.set(t.x, t.y, t.z);
		if (this.frozen) return;
		const wasGrounded = this.grounded;
		const hit = this._probeGround();
		this._checkLanding(dt, wasGrounded, hit);
		if (this.boostTime > 0) {
			this.boostTime -= dt;
			if (this.boostTime <= 0) this.boostCapScale = 1;
		}
		const tu = this.tuning;
		const cap = tu.speedCap * this.boostCapScale;
		const f = this._d.set(forward.x, 0, forward.z);
		if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
		f.normalize();
		const r = this._r.crossVectors(f, UP$1);
		const v = this.body.linvel();
		const vh = this._vh.set(v.x, 0, v.z);
		const control = this.grounded ? 1 : tu.airControl;
		const mx = move ? move.x : 0;
		const my = move ? move.y : 0;
		let ix = 0;
		let iz = 0;
		if (tu.autoRoll) {
			const target = cap * (my >= 0 ? tu.cruise + (1 - tu.cruise) * my : tu.cruise + (tu.slow - tu.cruise) * -my);
			const vf = vh.dot(f);
			const a = MathUtils.clamp((target - vf) * 3, -tu.accel, tu.accel) * control;
			const lat = mx * tu.accel * tu.lateral * control;
			ix = f.x * a + r.x * lat;
			iz = f.z * a + r.z * lat;
		} else if (mx !== 0 || my !== 0) {
			const dx = r.x * mx + f.x * my;
			const dz = r.z * mx + f.z * my;
			const mag = Math.min(1, Math.hypot(mx, my));
			const len = Math.hypot(dx, dz) || 1;
			const ux = dx / len;
			const uz = dz / len;
			const along = vh.x * ux + vh.z * uz;
			if (along < cap * mag) {
				const speed = vh.length();
				const against = speed > .5 ? Math.max(0, -along / speed) : 0;
				const a = tu.accel * mag * control * (1 + (tu.turnAssist - 1) * against);
				ix = ux * a;
				iz = uz * a;
			}
		}
		if (ix !== 0 || iz !== 0) this.body.applyImpulse({
			x: ix * dt,
			y: 0,
			z: iz * dt
		}, true);
		const hs = vh.length();
		if (this.grounded && tu.capDrag > 0 && hs > cap) {
			const k = Math.max(cap / hs, 1 - tu.capDrag * dt);
			this.body.setLinvel({
				x: v.x * k,
				y: v.y,
				z: v.z * k
			}, true);
		}
	}
	/** Landing after a jump/drop: dust puff + onLand(impact). */
	_checkLanding(dt, wasGrounded, hit) {
		const vy = this.body.linvel().y;
		if (!this.grounded) {
			this.airTime += dt;
			this._airVy = vy;
			return;
		}
		if (!wasGrounded && this.airTime > .2 && this._airVy < -4 && hit) {
			const impact = -this._airVy;
			if (this.dust) this.dust.puff(hit.point, impact / 12);
			if (this.onLand) this.onLand(impact);
		}
		this.airTime = 0;
		this._airVy = 0;
	}
	/**
	* Speed boost (boost pads): impulse along dir (defaults to current motion)
	* and a temporarily raised cap.
	*/
	boost(strength = 8, dir = null, duration = 1.5) {
		let d = dir;
		if (!d) {
			const v = this.body.linvel();
			d = new Vector3(v.x, 0, v.z);
			if (d.lengthSq() < 1e-4) return;
		}
		const n = new Vector3(d.x, d.y || 0, d.z).normalize();
		this.body.applyImpulse({
			x: n.x * strength,
			y: n.y * strength,
			z: n.z * strength
		}, true);
		this.boostTime = duration;
		this.boostCapScale = 1.5;
	}
	/** Raw impulse (bounce pads, bumpers). */
	push(impulse) {
		this.body.applyImpulse(impulse, true);
	}
	/** Stop the ball in place (countdown, results). */
	setFrozen(frozen) {
		this.frozen = frozen;
		this.body.setEnabled(!frozen);
	}
	/**
	* Teleport to pos (ball center), facing dir, at rest. Plays the pop-in
	* animation; mode should snap the camera and play 'boing'.
	*/
	respawn(pos, dir = null) {
		this.body.setTranslation({
			x: pos.x,
			y: pos.y,
			z: pos.z
		}, true);
		this.body.setLinvel({
			x: 0,
			y: 0,
			z: 0
		}, true);
		this.body.setAngvel({
			x: 0,
			y: 0,
			z: 0
		}, true);
		this.prev.set(pos.x, pos.y, pos.z);
		this.position.set(pos.x, pos.y, pos.z);
		this.boostTime = 0;
		this.boostCapScale = 1;
		this.popTime = 0;
		this.airTime = 0;
		this._airVy = 0;
		if (this.onRespawn) this.onRespawn(pos, dir);
	}
	/** Update mesh from physics, interpolated by alpha in [0,1]. */
	render(alpha = 1, dt = 1 / 60) {
		const t = this.body.translation();
		this.position.set(this.prev.x + (t.x - this.prev.x) * alpha, this.prev.y + (t.y - this.prev.y) * alpha, this.prev.z + (t.z - this.prev.z) * alpha);
		this.mesh.position.copy(this.position);
		const q = this.body.rotation();
		this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
		this.velocity.copy(this.body.linvel());
		if (this.dust) this.dust.update(Math.min(dt, .1));
		if (this.popTime < 1) {
			this.popTime = Math.min(1, this.popTime + dt / .35);
			const s = 1 + Math.sin(this.popTime * Math.PI * 1.5) * (1 - this.popTime) * .6;
			this.mesh.scale.setScalar(Math.max(.05, this.popTime < .15 ? this.popTime / .15 : s));
		} else this.mesh.scale.setScalar(1);
		if (this.shadow) {
			const hit = this.physics.raycast(this.position, this._down, 30, { excludeBody: this.body });
			if (hit) {
				const h = this.position.y - hit.point.y;
				this.shadow.visible = true;
				this.shadow.position.set(hit.point.x, hit.point.y + .03, hit.point.z);
				const s = MathUtils.clamp(1 - h / 12, .3, 1);
				this.shadow.scale.setScalar(s);
				this.shadow.material.opacity = .35 * s;
			} else this.shadow.visible = false;
		}
	}
	dispose() {
		this.dust?.dispose();
		this.scene.remove(this.mesh);
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
		if (this.shadow) {
			this.scene.remove(this.shadow);
			this.shadow.geometry.dispose();
			this.shadow.material.dispose();
		}
		this.physics.remove(this.body);
	}
};
//#endregion
//#region src/core/ChaseCamera.js
var UP = new Vector3(0, 1, 0);
function dampFactor(sharpness, dt) {
	return 1 - Math.exp(-sharpness * dt);
}
function angleLerp(a, b, t) {
	let d = b - a;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return a + d * t;
}
/** yaw 0 = looking along -Z (three.js default camera forward). */
function yawOf(v) {
	return Math.atan2(-v.x, -v.z);
}
var ChaseCamera = class {
	constructor(camera, opts = {}) {
		this.camera = camera;
		this.mode = opts.mode || "track";
		this.distance = opts.distance ?? 7;
		this.height = opts.height ?? 3.2;
		this.lookHeight = opts.lookHeight ?? .6;
		this.lookAhead = opts.lookAhead ?? 3;
		this.posSharpness = opts.posSharpness ?? 8;
		this.turnSharpness = opts.turnSharpness ?? 3;
		this.autoOrbit = opts.autoOrbit ?? .12;
		this.lookSensitivity = opts.lookSensitivity ?? .006;
		this.yaw = 0;
		this.lookYaw = 0;
		this.lookPitch = 0;
		this.desiredForward = new Vector3(0, 0, -1);
		this.focus = new Vector3();
		this._pos = new Vector3();
		this._tmp = new Vector3();
		this._fwd = new Vector3();
		this._initialized = false;
	}
	setMode(mode) {
		this.mode = mode;
	}
	/** Track mode: the direction the camera should face (any length, y ignored). */
	setForward(v) {
		this._tmp.set(v.x, 0, v.z);
		if (this._tmp.lengthSq() > 1e-6) this.desiredForward.copy(this._tmp.normalize());
	}
	/** Two-finger drag delta in pixels (pass input.consumeLook()). */
	addLook(dx, dy) {
		if (this.mode === "free") this.yaw -= dx * this.lookSensitivity;
		else this.lookYaw = MathUtils.clamp(this.lookYaw - dx * this.lookSensitivity, -1.2, 1.2);
		this.lookPitch = MathUtils.clamp(this.lookPitch + dy * this.lookSensitivity * .5, -.35, .5);
	}
	/** Horizontal unit vector the player considers "forward" (for steering). */
	getForward(out = new Vector3()) {
		const yaw = this.yaw + this.lookYaw;
		return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
	}
	/**
	* Jump straight to the chase position (after respawn / at start).
	* @param {{x,y,z}} position ball position
	* @param {{x,y,z}} [forward] facing direction
	*/
	snap(position, forward) {
		if (forward) {
			this.setForward(forward);
			this.yaw = yawOf(this.desiredForward);
		}
		this.lookYaw = 0;
		this.focus.set(position.x, position.y, position.z);
		this._place(1);
		this._initialized = true;
	}
	/**
	* @param {number} dt seconds
	* @param {{position:{x,y,z}, velocity?:{x,y,z}}} target
	*/
	update(dt, target) {
		const p = target.position;
		if (!this._initialized) {
			this.snap(p, this.desiredForward);
			return;
		}
		if (this.mode === "track") {
			this.yaw = angleLerp(this.yaw, yawOf(this.desiredForward), dampFactor(this.turnSharpness, dt));
			this.lookYaw *= 1 - dampFactor(.8, dt);
		} else {
			const v = target.velocity;
			const speed = v ? Math.hypot(v.x, v.z) : 0;
			if (speed > 1.2) {
				this._tmp.set(v.x, 0, v.z);
				const t = dampFactor(this.turnSharpness * Math.min(1, (speed - 1.2) / 4), dt);
				this.yaw = angleLerp(this.yaw, yawOf(this._tmp), t);
			} else this.yaw += this.autoOrbit * dt;
		}
		this.lookPitch *= 1 - dampFactor(.5, dt);
		const k = dampFactor(this.posSharpness, dt);
		this.focus.x += (p.x - this.focus.x) * k;
		this.focus.z += (p.z - this.focus.z) * k;
		this.focus.y += (p.y - this.focus.y) * dampFactor(this.posSharpness * .5, dt);
		this._place(dampFactor(this.posSharpness * 1.5, dt));
	}
	_place(t) {
		const fwd = this.getForward(this._fwd);
		const pitch = this.lookPitch;
		const dist = this.distance * Math.cos(pitch);
		const h = this.height + this.distance * Math.sin(pitch);
		this._tmp.copy(this.focus).addScaledVector(fwd, -dist).addScaledVector(UP, h);
		if (t >= 1) this._pos.copy(this._tmp);
		else this._pos.lerp(this._tmp, t);
		this.camera.position.copy(this._pos);
		this._tmp.copy(this.focus).addScaledVector(fwd, this.lookAhead).addScaledVector(UP, this.lookHeight);
		this.camera.lookAt(this._tmp);
	}
};
//#endregion
export { BALL_RADIUS as n, Ball as r, ChaseCamera as t };
