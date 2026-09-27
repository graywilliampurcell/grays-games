import { A as PointsMaterial, E as Mesh, M as Shape, N as Vector3, O as MeshLambertMaterial, T as Matrix4, a as applySky, b as InstancedMesh, c as randomEmojiSeed, d as BufferGeometry, g as ExtrudeGeometry, i as BlockMesh, j as Quaternion, k as Points, l as BoxGeometry, m as CylinderGeometry, o as getPalette, p as Color, s as Rng, u as BufferAttribute } from "./index-Cs7XvCIe.js";
import { r as Ball, t as ChaseCamera } from "./ChaseCamera-CIJzGBRJ.js";
//#region src/playground/Features.js
var FEATURE_COUNTS = {
	small: 2,
	medium: 4,
	large: 7
};
var MIN_SPAWN_DIST = 12;
var DIRS = [
	{
		x: 0,
		z: 1
	},
	{
		x: 1,
		z: 0
	},
	{
		x: 0,
		z: -1
	},
	{
		x: -1,
		z: 0
	}
];
/**
* Per-type layout. blocked(u, v): solid at ground level. access: cells the
* ball must be able to reach. stars: [u, v, heightAboveGround] bonus spots.
*/
var FEATURE_SPECS = {
	ramps: {
		W: 3,
		L: 13,
		height: 1.5,
		blocked: (u, v) => v >= 1 && v < 12,
		access: [[1, 0], [1, 12]],
		stars: [[
			1.5,
			6.5,
			2.4
		]]
	},
	jumps: {
		W: 3,
		L: 14,
		height: 1.2,
		blocked: (u, v) => v >= 2 && v < 5,
		access: [[1, 0], [1, 10]],
		stars: [
			[
				1.5,
				6.5,
				1.9
			],
			[
				1.5,
				8.5,
				1.8
			],
			[
				1.5,
				10.5,
				1.2
			]
		]
	},
	bouncePads: {
		W: 5,
		L: 5,
		blocked: () => false,
		access: [[2, 2]],
		stars: [[
			2.5,
			2.5,
			3.6
		]]
	},
	tunnels: {
		W: 5,
		L: 9,
		height: 3,
		blocked: (u, v) => v >= 1 && v < 8 && (u === 0 || u === 4),
		access: [[2, 0], [2, 8]],
		stars: [
			[
				2.5,
				2.5,
				.9
			],
			[
				2.5,
				4.5,
				.9
			],
			[
				2.5,
				6.5,
				.9
			]
		]
	},
	bumpers: {
		W: 7,
		L: 7,
		armLength: 6,
		blocked: (u, v) => u === 3 && v === 3,
		access: [[3, 0]],
		stars: []
	}
};
/** World rect size (cells along x, z) of a feature. */
function rectSize(spec, dir) {
	return dir % 2 === 0 ? {
		w: spec.W,
		l: spec.L
	} : {
		w: spec.L,
		l: spec.W
	};
}
/**
* Local (u, v) (continuous, cell units) → world (x, z) for a feature whose
* rect min corner is at world (X0, Z0).
*/
function featureToWorld(f, u, v) {
	const { W, L } = FEATURE_SPECS[f.type];
	switch (f.dir) {
		case 0: return {
			x: f.X0 + u,
			z: f.Z0 + v
		};
		case 1: return {
			x: f.X0 + v,
			z: f.Z0 + W - u
		};
		case 2: return {
			x: f.X0 + W - u,
			z: f.Z0 + L - v
		};
		default: return {
			x: f.X0 + L - v,
			z: f.Z0 + u
		};
	}
}
/** Local cell (u, v) → world cell (cx, cz). */
function featureCell(f, n, u, v) {
	const p = featureToWorld(f, u + .5, v + .5);
	return {
		cx: Math.floor(p.x + n / 2),
		cz: Math.floor(p.z + n / 2)
	};
}
/**
* Place the requested stuff on flat, free, reachable spots.
* ctx: {t, n, blocked, used, spawnCell, pads, size, config} (mutates blocked/used).
*/
function placeFeatures(ctx, rng) {
	const { t, n, blocked, used, protectedV, spawnCell, size, config } = ctx;
	const stuff = Array.isArray(config.stuff) ? config.stuff : [];
	const count = FEATURE_COUNTS[size] || FEATURE_COUNTS.medium;
	const placed = [];
	const accessCells = [];
	const queue = [];
	for (let k = 0; k < count; k++) for (const type of stuff) if (FEATURE_SPECS[type]) queue.push(type);
	for (const type of queue) {
		const spec = FEATURE_SPECS[type];
		for (let attempt = 0; attempt < 120; attempt++) {
			const dir = rng.int(0, 3);
			const { w, l } = rectSize(spec, dir);
			const cx0 = rng.int(2, n - 2 - w);
			const cz0 = rng.int(2, n - 2 - l);
			const X0 = cx0 - n / 2;
			const Z0 = cz0 - n / 2;
			if (Math.hypot(X0 + w / 2, Z0 + l / 2) < MIN_SPAWN_DIST + Math.max(w, l) / 2) continue;
			if (!rectFree(used, n, cx0 - 1, cz0 - 1, w + 2, l + 2) || !rectFree(blocked, n, cx0 - 1, cz0 - 1, w + 2, l + 2)) continue;
			const carve = carveFlat(t, protectedV, cx0 - 1, cz0 - 1, w + 2, l + 2);
			if (!carve) continue;
			const f = {
				type,
				dir,
				cx0,
				cz0,
				w,
				l,
				X0,
				Z0,
				y: t.heights[vIndex(n, cx0, cz0)]
			};
			const d = DIRS[dir];
			f.fwd = {
				x: d.x,
				z: d.z
			};
			f.yaw = Math.atan2(d.x, d.z);
			const solid = [];
			for (let u = 0; u < spec.W; u++) for (let v = 0; v < spec.L; v++) {
				if (!spec.blocked(u, v)) continue;
				const { cx, cz } = featureCell(f, n, u, v);
				if (!blocked[cx * n + cz]) solid.push(cx * n + cz);
			}
			const access = spec.access.map(([u, v]) => featureCell(f, n, u, v));
			for (const i of solid) blocked[i] = 1;
			let ok = true;
			if (solid.length || placed.length === 0) {
				const reach = floodFill(t, blocked, spawnCell.cx, spawnCell.cz);
				ok = [...accessCells, ...access].every(({ cx, cz }) => reach[cx * n + cz]);
			}
			if (!ok) {
				for (const i of solid) blocked[i] = 0;
				undoCarve(t, carve);
				continue;
			}
			protectRect(protectedV, n, cx0 - 1, cz0 - 1, w + 2, l + 2);
			markRect(used, n, cx0, cz0, w, l, 1);
			f.access = access;
			f.starSpots = spec.stars.map(([u, v, dy]) => {
				const p = featureToWorld(f, u, v);
				return {
					x: p.x,
					y: f.y + dy,
					z: p.z
				};
			});
			f.center = featureToWorld(f, spec.W / 2, spec.L / 2);
			accessCells.push(...access);
			placed.push(f);
			break;
		}
	}
	return placed;
}
var BOUNCE_SPEED = 13;
var BOUNCE_COOLDOWN = .25;
var JUMP_LIFT = 7.5;
var BUMPER_SPIN = 1.1;
var BUMPER_PUSH = 7;
var BUMPER_COOLDOWN = .45;
var RAINBOW = [
	"red",
	"orange",
	"yellow",
	"green",
	"blue",
	"purple"
];
var _q$1 = new Quaternion();
var _m$1 = new Matrix4();
var _p$1 = new Vector3();
var _s$1 = new Vector3();
var _y$1 = new Vector3(0, 1, 0);
var FeatureSet = class {
	/**
	* @param {object} o
	* @param {import('../core/Physics.js').Physics} o.physics
	* @param {THREE.Object3D} o.scene
	* @param {import('../voxel/BlockMesh.js').BlockMesh} o.blocks shared static block mesh (caller builds it)
	* @param {Array} o.features from generate()
	* @param {object} o.audio
	*/
	constructor({ physics, scene, blocks, features, audio }) {
		this.physics = physics;
		this.scene = scene;
		this.audio = audio;
		this.bodies = [];
		this.meshes = [];
		this.pads = [];
		this.bumpers = [];
		this.kickers = [];
		this.time = 0;
		for (const f of features) if (f.type === "ramps") this._ramp(f, blocks);
		else if (f.type === "jumps") this._jump(f, blocks);
		else if (f.type === "bouncePads") this._bouncePad(f, blocks);
		else if (f.type === "tunnels") this._tunnel(f, blocks);
		else if (f.type === "bumpers") this._bumper(f, blocks);
		this._buildPadMesh();
		this._buildBumperMeshes();
	}
	_at(f, u, v, dy = 0) {
		const p = featureToWorld(f, u, v);
		return {
			x: p.x,
			y: f.y + dy,
			z: p.z
		};
	}
	/** Solid wedge: visual + convex-hull collider. Rises along +fwd unless flip. */
	_wedge(f, blocks, u, v, width, length, height, color, flip = false) {
		const c = this._at(f, u, v, height / 2);
		const yaw = f.yaw + (flip ? Math.PI : 0);
		blocks.addWedge(c, {
			x: width,
			y: height,
			z: length
		}, color, {
			yaw,
			jitter: .03
		});
		const pts = [];
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);
		const corner = (lx, ly, lz) => pts.push(c.x + lx * cy + lz * sy, c.y + ly, c.z - lx * sy + lz * cy);
		const hw = width / 2;
		const hl = length / 2;
		const hh = height / 2;
		const base = -hh - .05;
		corner(-hw, base, -hl);
		corner(hw, base, -hl);
		corner(-hw, base, hl);
		corner(hw, base, hl);
		corner(-hw, hh, hl);
		corner(hw, hh, hl);
		this._hull(pts);
	}
	_hull(points, { friction = .8 } = {}) {
		const { RAPIER, world } = this.physics;
		const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
		const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
		if (!desc) return;
		desc.setFriction(friction);
		world.createCollider(desc, body);
		this.physics.bodies.add(body);
		this.bodies.push(body);
	}
	/** Axis-aligned-in-feature-frame solid box: visual + cuboid collider. */
	_box(f, blocks, u, v, dy, size, color, { collide = true, jitter } = {}) {
		const c = this._at(f, u, v, dy);
		blocks.addBox(c, size, color, {
			yaw: f.yaw,
			jitter
		});
		if (collide) {
			const { body } = this.physics.addFixedCuboid({
				position: c,
				halfExtents: {
					x: size.x / 2,
					y: size.y / 2,
					z: size.z / 2
				},
				yaw: f.yaw,
				friction: .8,
				tag: "feature"
			});
			this.bodies.push(body);
		}
	}
	_ramp(f, blocks) {
		const h = FEATURE_SPECS.ramps.height;
		this._wedge(f, blocks, 1.5, 3, 3, 4, h, "orange");
		this._box(f, blocks, 1.5, 6.5, h / 2 - .05, {
			x: 3,
			y: h + .1,
			z: 3
		}, "yellow");
		this._wedge(f, blocks, 1.5, 10, 3, 4, h, "orange", true);
		for (const u of [.15, 2.85]) this._box(f, blocks, u, 6.5, h + .1, {
			x: .3,
			y: .2,
			z: 3
		}, "red", {
			collide: false,
			jitter: 0
		});
	}
	_jump(f, blocks) {
		const s = FEATURE_SPECS.jumps;
		this._wedge(f, blocks, 1.5, 3.5, 3, 3, s.height, "red");
		const lip = this._at(f, 1.5, 4.7, s.height + .4);
		const kick = {
			fwd: f.fwd,
			hit: false,
			cooldown: 0
		};
		const { body } = this.physics.addSensorCuboid({
			position: lip,
			halfExtents: {
				x: 1.5,
				y: .6,
				z: .4
			},
			yaw: f.yaw,
			tag: "jumpLip",
			onCollide: ({ otherInfo, started }) => {
				if (started && otherInfo?.tag === "ball") kick.hit = true;
			}
		});
		this.kickers.push(kick);
		this.bodies.push(body);
		for (let v = 6; v < 14; v += 2) this._box(f, blocks, 1.5, v + .5, .02, {
			x: 2.6,
			y: .06,
			z: .5
		}, "white", {
			collide: false,
			jitter: 0
		});
	}
	_bouncePad(f, blocks) {
		const c = this._at(f, 2.5, 2.5);
		blocks.addBox({
			x: c.x,
			y: c.y - .08,
			z: c.z
		}, {
			x: 3.2,
			y: .2,
			z: 3.2
		}, "blue", { jitter: 0 });
		const { body } = this.physics.addSensorCuboid({
			position: {
				x: c.x,
				y: c.y + .45,
				z: c.z
			},
			halfExtents: {
				x: 1.3,
				y: .4,
				z: 1.3
			},
			tag: "bouncePad",
			onCollide: ({ otherInfo, started }) => {
				if (started && otherInfo?.tag === "ball") pad.hit = true;
			}
		});
		const pad = {
			x: c.x,
			y: c.y,
			z: c.z,
			hit: false,
			cooldown: 0,
			squash: 0
		};
		this.pads.push(pad);
		this.bodies.push(body);
	}
	_tunnel(f, blocks) {
		const h = FEATURE_SPECS.tunnels.height;
		for (let v = 1; v < 8; v++) {
			const color = RAINBOW[(v - 1) % RAINBOW.length];
			for (const u of [.5, 4.5]) this._box(f, blocks, u, v + .5, h / 2, {
				x: 1,
				y: h,
				z: 1
			}, color, { collide: false });
			this._box(f, blocks, 2.5, v + .5, h + .4, {
				x: 5,
				y: .8,
				z: 1
			}, color, { collide: false });
		}
		const add = (u, dy, size) => {
			const c = this._at(f, u, 4.5, dy);
			const { body } = this.physics.addFixedCuboid({
				position: c,
				halfExtents: {
					x: size.x / 2,
					y: size.y / 2,
					z: size.z / 2
				},
				yaw: f.yaw,
				friction: .5,
				tag: "feature"
			});
			this.bodies.push(body);
		};
		add(.5, h / 2, {
			x: 1,
			y: h,
			z: 7
		});
		add(4.5, h / 2, {
			x: 1,
			y: h,
			z: 7
		});
		add(2.5, h + .4, {
			x: 5,
			y: .8,
			z: 7
		});
	}
	_bumper(f, blocks) {
		const s = FEATURE_SPECS.bumpers;
		const c = this._at(f, 3.5, 3.5);
		blocks.addBox({
			x: c.x,
			y: c.y + .05,
			z: c.z
		}, {
			x: 1.6,
			y: .1,
			z: 1.6
		}, "white", { jitter: 0 });
		const half = s.armLength / 2;
		const bumper = {
			x: c.x,
			y: c.y,
			z: c.z,
			angle: 0,
			prevAngle: 0,
			spin: 0,
			hit: false,
			cooldown: 0
		};
		bumper.spin = BUMPER_SPIN * ((f.cx0 + f.cz0) % 2 ? 1 : -1);
		const { body } = this.physics.addKinematic({
			position: c,
			shapes: [{
				type: "cylinder",
				halfHeight: .9,
				radius: .5,
				offset: {
					x: 0,
					y: .9,
					z: 0
				}
			}, {
				type: "cuboid",
				halfExtents: {
					x: half,
					y: .3,
					z: .3
				},
				offset: {
					x: 0,
					y: .55,
					z: 0
				}
			}],
			friction: .3,
			restitution: .8,
			events: true,
			tag: "bumper",
			onCollide: ({ otherInfo, started }) => {
				if (started && otherInfo?.tag === "ball") bumper.hit = true;
			}
		});
		bumper.body = body;
		this.bumpers.push(bumper);
		this.bodies.push(body);
	}
	_buildPadMesh() {
		if (!this.pads.length) return;
		const geo = new BoxGeometry(2.6, .12, 2.6);
		const mat = new MeshLambertMaterial({
			color: "#ff5fa2",
			flatShading: true
		});
		this.padMesh = new InstancedMesh(geo, mat, this.pads.length);
		this.padMesh.name = "bounce-pads";
		this._updatePads();
		this.scene.add(this.padMesh);
		this.meshes.push(this.padMesh);
	}
	_updatePads() {
		this.pads.forEach((p, i) => {
			const k = p.squash > 0 ? Math.sin((1 - p.squash) * Math.PI * 3) * p.squash : 0;
			_p$1.set(p.x, p.y + .04 + k * .08, p.z);
			_s$1.set(1 + k * .12, 1 - k * .6, 1 + k * .12);
			_m$1.compose(_p$1, _q$1.identity(), _s$1);
			this.padMesh.setMatrixAt(i, _m$1);
		});
		this.padMesh.instanceMatrix.needsUpdate = true;
	}
	_buildBumperMeshes() {
		if (!this.bumpers.length) return;
		const n = this.bumpers.length;
		const half = FEATURE_SPECS.bumpers.armLength / 2;
		const postGeo = new CylinderGeometry(.5, .55, 1.8, 8);
		postGeo.translate(0, .9, 0);
		const armGeo = new BoxGeometry(half * 2, .6, .6);
		armGeo.translate(0, .55, 0);
		this.postMesh = new InstancedMesh(postGeo, new MeshLambertMaterial({
			color: "#ffd21f",
			flatShading: true
		}), n);
		this.armMesh = new InstancedMesh(armGeo, new MeshLambertMaterial({
			color: "#8a3ee8",
			flatShading: true
		}), n);
		this.postMesh.name = "bumper-posts";
		this.armMesh.name = "bumper-arms";
		this.bumpers.forEach((b, i) => {
			_m$1.makeTranslation(b.x, b.y, b.z);
			this.postMesh.setMatrixAt(i, _m$1);
		});
		this._updateArms(1);
		this.postMesh.frustumCulled = false;
		this.armMesh.frustumCulled = false;
		this.scene.add(this.postMesh, this.armMesh);
		this.meshes.push(this.postMesh, this.armMesh);
	}
	_updateArms(alpha) {
		this.bumpers.forEach((b, i) => {
			const a = b.prevAngle + (b.angle - b.prevAngle) * alpha;
			_q$1.setFromAxisAngle(_y$1, a);
			_p$1.set(b.x, b.y, b.z);
			_m$1.compose(_p$1, _q$1, _s$1.set(1, 1, 1));
			this.armMesh.setMatrixAt(i, _m$1);
		});
		this.armMesh.instanceMatrix.needsUpdate = true;
	}
	/** Fixed step, before physics: spin the bumpers. */
	update(dt) {
		this.time += dt;
		for (const b of this.bumpers) {
			b.prevAngle = b.angle;
			b.angle += b.spin * dt;
			_q$1.setFromAxisAngle(_y$1, b.angle);
			b.body.setNextKinematicRotation(_q$1);
			if (b.cooldown > 0) b.cooldown -= dt;
		}
		for (const p of this.pads) if (p.cooldown > 0) p.cooldown -= dt;
		for (const k of this.kickers) if (k.cooldown > 0) k.cooldown -= dt;
	}
	/** After physics: apply bounces / bumps flagged by contact callbacks. */
	postStep(dt, ball) {
		for (const p of this.pads) {
			if (!p.hit) continue;
			p.hit = false;
			if (p.cooldown > 0) continue;
			p.cooldown = BOUNCE_COOLDOWN;
			p.squash = 1;
			const v = ball.body.linvel();
			ball.body.setLinvel({
				x: v.x,
				y: BOUNCE_SPEED,
				z: v.z
			}, true);
			this.audio.play("boing", { pitch: 1.15 });
		}
		for (const k of this.kickers) {
			if (!k.hit) continue;
			k.hit = false;
			const v = ball.body.linvel();
			const along = v.x * k.fwd.x + v.z * k.fwd.z;
			if (k.cooldown > 0 || along < 2) continue;
			k.cooldown = .5;
			ball.body.setLinvel({
				x: v.x + k.fwd.x * 1.5,
				y: Math.max(v.y, JUMP_LIFT),
				z: v.z + k.fwd.z * 1.5
			}, true);
			this.audio.play("whoosh");
		}
		for (const b of this.bumpers) {
			if (!b.hit) continue;
			b.hit = false;
			if (b.cooldown > 0) continue;
			b.cooldown = BUMPER_COOLDOWN;
			const t = ball.body.translation();
			let dx = t.x - b.x;
			let dz = t.z - b.z;
			const d = Math.hypot(dx, dz) || 1;
			dx /= d;
			dz /= d;
			ball.push({
				x: dx * BUMPER_PUSH,
				y: 2.5,
				z: dz * BUMPER_PUSH
			});
			this.audio.play("boing", { pitch: 1.5 });
		}
	}
	render(alpha, frameDt) {
		if (this.padMesh) {
			let any = false;
			for (const p of this.pads) if (p.squash > 0) {
				p.squash = Math.max(0, p.squash - frameDt * 2.2);
				any = true;
			}
			if (any || this._padsDirty) this._updatePads();
			this._padsDirty = any;
		}
		if (this.armMesh) this._updateArms(alpha);
	}
	dispose() {
		for (const body of this.bodies) this.physics.remove(body);
		this.bodies = [];
		for (const m of this.meshes) {
			m.removeFromParent();
			m.geometry.dispose();
			m.material.dispose();
			m.dispose();
		}
		this.meshes = [];
	}
};
//#endregion
//#region src/playground/Stars.js
var STAR_COUNTS = {
	none: {
		small: 0,
		medium: 0,
		large: 0
	},
	some: {
		small: 15,
		medium: 30,
		large: 50
	},
	lots: {
		small: 40,
		medium: 80,
		large: 120
	}
};
var STAR_HOVER = .9;
var TRAIL_GAP = 2.5;
/**
* ctx: {t, n, blocked, reach, features, pads, size, config}. Returns [{x, y, z}]
* with exactly STAR_COUNTS[config.stars][size] entries.
*/
function placeStars(ctx, rng) {
	const { t, n, blocked, reach, features, size, config } = ctx;
	const want = (STAR_COUNTS[config.stars] || STAR_COUNTS.none)[size] || 0;
	const stars = [];
	if (!want) return stars;
	const ok = (cx, cz) => cx > 0 && cz > 0 && cx < n - 1 && cz < n - 1 && reach[cx * n + cz] && !blocked[cx * n + cz];
	const spaced = (x, z, gap) => stars.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 >= gap * gap);
	const onGround = (cx, cz) => {
		const p = cellCenter(t, cx, cz);
		return {
			x: p.x,
			y: heightAt(t, p.x, p.z) + STAR_HOVER,
			z: p.z
		};
	};
	const spots = rng.shuffle(features.flatMap((f) => f.starSpots || []));
	for (const s of spots) {
		if (stars.length >= Math.ceil(want * .4)) break;
		stars.push({
			x: s.x,
			y: s.y,
			z: s.z
		});
	}
	const dirs = [
		[1, 0],
		[0, 1],
		[-1, 0],
		[0, -1],
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1]
	];
	for (let a = 0; a < want * 60 && stars.length < want; a++) {
		let cx = rng.int(2, n - 3);
		let cz = rng.int(2, n - 3);
		const [dx, dz] = rng.pick(dirs);
		const len = rng.int(3, 5);
		const step = TRAIL_GAP / Math.hypot(dx, dz);
		for (let k = 0; k < len && stars.length < want; k++) {
			if (!ok(cx, cz) || cellRange(t, cx, cz) > .5) break;
			const p = onGround(cx, cz);
			if (!spaced(p.x, p.z, 2)) break;
			stars.push(p);
			cx = Math.round(cx + dx * step);
			cz = Math.round(cz + dz * step);
		}
	}
	if (stars.length < want) {
		const start = rng.int(0, n * n - 1);
		for (let k = 0; k < n * n && stars.length < want; k++) {
			const i = (start + k * 7919) % (n * n);
			const cx = i / n | 0;
			const cz = i % n;
			if (!ok(cx, cz)) continue;
			const p = onGround(cx, cz);
			if (spaced(p.x, p.z, 1.5)) stars.push(p);
		}
	}
	return stars.slice(0, want);
}
var COLLECT_RADIUS = 1.25;
var POP_TIME = .35;
var SPARKLES_PER_STAR = 14;
var SPARKLE_POOL = 256;
function makeStarGeometry() {
	const shape = new Shape();
	const outer = .5;
	const inner = .22;
	for (let i = 0; i < 10; i++) {
		const r = i % 2 ? inner : outer;
		const a = i / 10 * Math.PI * 2 + Math.PI / 2;
		const x = Math.cos(a) * r;
		const y = Math.sin(a) * r;
		if (i === 0) shape.moveTo(x, y);
		else shape.lineTo(x, y);
	}
	shape.closePath();
	const g = new ExtrudeGeometry(shape, {
		depth: .16,
		bevelEnabled: true,
		bevelSize: .05,
		bevelThickness: .05,
		bevelSegments: 1
	});
	g.center();
	return g;
}
var _m = new Matrix4();
var _q = new Quaternion();
var _p = new Vector3();
var _s = new Vector3();
var _y = new Vector3(0, 1, 0);
var StarField = class {
	/**
	* @param {object} o
	* @param {THREE.Object3D} o.scene
	* @param {Array<{x,y,z}>} o.stars from generate()
	*/
	constructor({ scene, stars }) {
		this.scene = scene;
		this.stars = stars.map((s, i) => ({
			...s,
			phase: i * .7,
			state: "idle",
			t: 0
		}));
		this.remaining = this.stars.length;
		this.time = 0;
		this.meshes = [];
		if (this.stars.length) {
			const mat = new MeshLambertMaterial({
				color: "#ffd21f",
				emissive: "#b88a00",
				flatShading: true
			});
			this.mesh = new InstancedMesh(makeStarGeometry(), mat, this.stars.length);
			this.mesh.name = "stars";
			this.mesh.frustumCulled = false;
			scene.add(this.mesh);
			this.meshes.push(this.mesh);
			this._updateMatrices();
		}
		const pos = new Float32Array(SPARKLE_POOL * 3);
		const col = new Float32Array(SPARKLE_POOL * 3);
		const geo = new BufferGeometry();
		geo.setAttribute("position", new BufferAttribute(pos, 3));
		geo.setAttribute("color", new BufferAttribute(col, 3));
		this.sparkles = new Points(geo, new PointsMaterial({
			size: .35,
			vertexColors: true,
			transparent: true,
			depthWrite: false,
			blending: 2
		}));
		this.sparkles.frustumCulled = false;
		this.sparkles.name = "sparkles";
		scene.add(this.sparkles);
		this.meshes.push(this.sparkles);
		this.sp = Array.from({ length: SPARKLE_POOL }, () => ({
			life: 0,
			vx: 0,
			vy: 0,
			vz: 0,
			r: 1,
			g: 1,
			b: 1
		}));
		this.spNext = 0;
		this._sparkRng = 1;
	}
	get total() {
		return this.stars.length;
	}
	/** Check the ball against idle stars. Returns the number collected this call. */
	collect(ballPos) {
		let got = 0;
		const r2 = COLLECT_RADIUS * COLLECT_RADIUS;
		for (const s of this.stars) {
			if (s.state !== "idle") continue;
			const dx = s.x - ballPos.x;
			const dy = s.y - ballPos.y;
			const dz = s.z - ballPos.z;
			if (dx * dx + dy * dy + dz * dz > r2) continue;
			s.state = "pop";
			s.t = 0;
			this.remaining--;
			got++;
			this._burst(s);
		}
		return got;
	}
	_rand() {
		this._sparkRng = this._sparkRng * 16807 % 2147483647;
		return this._sparkRng / 2147483647;
	}
	_burst(s) {
		const pos = this.sparkles.geometry.attributes.position.array;
		for (let k = 0; k < SPARKLES_PER_STAR; k++) {
			const i = this.spNext;
			this.spNext = (this.spNext + 1) % SPARKLE_POOL;
			const p = this.sp[i];
			const a = this._rand() * Math.PI * 2;
			const up = this._rand();
			const sp = 2 + this._rand() * 3;
			p.vx = Math.cos(a) * sp;
			p.vz = Math.sin(a) * sp;
			p.vy = 2 + up * 4;
			p.life = .6 + this._rand() * .4;
			const white = this._rand() < .4;
			p.r = 1;
			p.g = white ? 1 : .85;
			p.b = white ? 1 : .2;
			pos[i * 3] = s.x;
			pos[i * 3 + 1] = s.y;
			pos[i * 3 + 2] = s.z;
		}
	}
	_updateMatrices() {
		this.stars.forEach((s, i) => {
			let scale = 1;
			let lift = Math.sin(this.time * 2 + s.phase) * .12;
			let spin = this.time * 2 + s.phase;
			if (s.state === "pop") {
				const k = s.t / POP_TIME;
				scale = k < .4 ? 1 + k * 1.5 : Math.max(0, 1.6 * (1 - (k - .4) / .6));
				lift += k * .8;
				spin += k * 8;
			} else if (s.state === "gone") scale = 0;
			_p.set(s.x, s.y + lift, s.z);
			_q.setFromAxisAngle(_y, spin);
			_m.compose(_p, _q, _s.setScalar(scale * 1.1));
			this.mesh.setMatrixAt(i, _m);
		});
		this.mesh.instanceMatrix.needsUpdate = true;
	}
	render(frameDt) {
		this.time += frameDt;
		if (this.mesh) {
			for (const s of this.stars) {
				if (s.state !== "pop") continue;
				s.t += frameDt;
				if (s.t >= POP_TIME) s.state = "gone";
			}
			this._updateMatrices();
		}
		const pos = this.sparkles.geometry.attributes.position.array;
		const col = this.sparkles.geometry.attributes.color.array;
		let any = false;
		for (let i = 0; i < SPARKLE_POOL; i++) {
			const p = this.sp[i];
			if (p.life <= 0) {
				if (col[i * 3] !== 0) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
				continue;
			}
			any = true;
			p.life -= frameDt;
			p.vy -= 9 * frameDt;
			pos[i * 3] += p.vx * frameDt;
			pos[i * 3 + 1] += p.vy * frameDt;
			pos[i * 3 + 2] += p.vz * frameDt;
			const f = Math.max(0, Math.min(1, p.life * 1.6));
			col[i * 3] = p.r * f;
			col[i * 3 + 1] = p.g * f;
			col[i * 3 + 2] = p.b * f;
		}
		if (any || this._sparkDirty) {
			this.sparkles.geometry.attributes.position.needsUpdate = true;
			this.sparkles.geometry.attributes.color.needsUpdate = true;
		}
		this._sparkDirty = any;
	}
	dispose() {
		for (const m of this.meshes) {
			m.removeFromParent();
			m.geometry.dispose();
			m.material.dispose();
			if (m.isInstancedMesh) m.dispose();
		}
		this.meshes = [];
	}
};
//#endregion
//#region src/playground/TerrainGenerator.js
var SIZE_CELLS = {
	small: 64,
	medium: 128,
	large: 192
};
var STEP = .5;
var BUMPINESS = {
	flat: {
		amp: 1.1,
		scale: 18,
		octaves: 2,
		shape: "plain"
	},
	hilly: {
		amp: 6,
		scale: 26,
		octaves: 3,
		shape: "plain"
	},
	mountains: {
		amp: 24,
		scale: 46,
		octaves: 4,
		shape: "peaks"
	}
};
var SPAWN_BLEND = 12;
var PAD_COUNTS = {
	small: 3,
	medium: 6,
	large: 10
};
var TREE_COUNTS = {
	small: 14,
	medium: 45,
	large: 100
};
function lattice(seed, x, z) {
	let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
	h = Math.imul(h ^ h >>> 13, 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}
var smooth = (t) => t * t * (3 - 2 * t);
/** Value noise in [0, 1). */
function valueNoise(seed, x, z) {
	const x0 = Math.floor(x);
	const z0 = Math.floor(z);
	const fx = smooth(x - x0);
	const fz = smooth(z - z0);
	const a = lattice(seed, x0, z0);
	const b = lattice(seed, x0 + 1, z0);
	const c = lattice(seed, x0, z0 + 1);
	const d = lattice(seed, x0 + 1, z0 + 1);
	return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
/** Fractal value noise in [-1, 1]. */
function fbm(seed, x, z, octaves) {
	let sum = 0;
	let amp = 1;
	let norm = 0;
	let f = 1;
	for (let o = 0; o < octaves; o++) {
		sum += amp * (valueNoise(seed + o * 1013, x * f, z * f) * 2 - 1);
		norm += amp;
		amp *= .5;
		f *= 2;
	}
	return sum / norm;
}
var vIndex = (n, ix, iz) => ix * (n + 1) + iz;
/** Corner-height range (max - min) of cell (cx, cz). */
function cellRange(t, cx, cz) {
	const { n, heights: h } = t;
	const a = h[vIndex(n, cx, cz)];
	const b = h[vIndex(n, cx + 1, cz)];
	const c = h[vIndex(n, cx, cz + 1)];
	const d = h[vIndex(n, cx + 1, cz + 1)];
	return Math.max(a, b, c, d) - Math.min(a, b, c, d);
}
function cellMin(t, cx, cz) {
	const { n, heights: h } = t;
	return Math.min(h[vIndex(n, cx, cz)], h[vIndex(n, cx + 1, cz)], h[vIndex(n, cx, cz + 1)], h[vIndex(n, cx + 1, cz + 1)]);
}
/** World (x, z) of a cell's center. */
function cellCenter(t, cx, cz) {
	return {
		x: cx - t.n / 2 + .5,
		z: cz - t.n / 2 + .5
	};
}
/**
* Surface height at world (x, z), using the same triangulation as Rapier's
* heightfield: each cell is split along the diagonal from (x0, z1) to (x1, z0).
*/
function heightAt(t, x, z) {
	const { n, heights: h } = t;
	const gx = Math.min(n, Math.max(0, x + n / 2));
	const gz = Math.min(n, Math.max(0, z + n / 2));
	const cx = Math.min(n - 1, Math.floor(gx));
	const cz = Math.min(n - 1, Math.floor(gz));
	const fx = gx - cx;
	const fz = gz - cz;
	const h00 = h[vIndex(n, cx, cz)];
	const h10 = h[vIndex(n, cx + 1, cz)];
	const h01 = h[vIndex(n, cx, cz + 1)];
	const h11 = h[vIndex(n, cx + 1, cz + 1)];
	if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
	return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
/**
* Level the cell rect [cx0, cx0+w) × [cz0, cz0+l) to one height (a terrace cut
* into / built onto a hill) without breaking the slope limit:
*   h'(v) = clamp(h(v), L - STEP*d(v), L + STEP*d(v)),  d = Chebyshev distance to the rect.
* min/max of STEP-Lipschitz functions stay STEP-Lipschitz, so no re-smoothing
* is needed. Refused (returns null, nothing changed) if the cut/fill would be
* deeper than maxCut or would touch a protected vertex (other pads/features).
* On success returns an undo list [index, oldHeight, ...] and the level.
*/
function carveFlat(t, protectedV, cx0, cz0, w, l, maxCut = 2.5) {
	const { n, heights: h } = t;
	if (cx0 < 0 || cz0 < 0 || cx0 + w > n || cz0 + l > n) return null;
	let sum = 0;
	let count = 0;
	for (let ix = cx0; ix <= cx0 + w; ix++) for (let iz = cz0; iz <= cz0 + l; iz++) {
		sum += h[vIndex(n, ix, iz)];
		count++;
	}
	const L = Math.round(sum / count / STEP) * STEP + 0;
	const undo = [];
	for (let ix = 0; ix <= n; ix++) {
		const dx = ix < cx0 ? cx0 - ix : ix > cx0 + w ? ix - cx0 - w : 0;
		for (let iz = 0; iz <= n; iz++) {
			const dz = iz < cz0 ? cz0 - iz : iz > cz0 + l ? iz - cz0 - l : 0;
			const d = Math.max(dx, dz);
			const i = vIndex(n, ix, iz);
			const v = h[i];
			const nv = Math.min(L + STEP * d, Math.max(L - STEP * d, v));
			if (nv === v) continue;
			if (protectedV[i] || d === 0 && Math.abs(nv - v) > maxCut) {
				for (let k = 0; k < undo.length; k += 2) h[undo[k]] = undo[k + 1];
				return null;
			}
			undo.push(i, v);
			h[i] = nv;
		}
	}
	return {
		undo,
		level: L
	};
}
function undoCarve(t, carve) {
	if (!carve) return;
	const u = carve.undo;
	for (let k = 0; k < u.length; k += 2) t.heights[u[k]] = u[k + 1];
}
/** Protect the vertices of a cell rect (grown by margin) from later carving. */
function protectRect(protectedV, n, cx0, cz0, w, l, margin = 0) {
	for (let ix = Math.max(0, cx0 - margin); ix <= Math.min(n, cx0 + w + margin); ix++) for (let iz = Math.max(0, cz0 - margin); iz <= Math.min(n, cz0 + l + margin); iz++) protectedV[vIndex(n, ix, iz)] = 1;
}
/**
* Lower every vertex so neighbours (8-connected) differ by at most one STEP:
* h'(v) = min over u of h(u) + STEP * chebyshev(u, v). Two chamfer sweeps per
* iteration; repeated until stable (usually 1–2 iterations).
*/
function limitSlope(h, n) {
	const N = n + 1;
	let changed = true;
	let guard = 0;
	while (changed && guard++ < 50) {
		changed = false;
		for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
			const i = ix * N + iz;
			let m = h[i];
			if (iz > 0) m = Math.min(m, h[i - 1] + STEP);
			if (ix > 0) {
				m = Math.min(m, h[i - N] + STEP);
				if (iz > 0) m = Math.min(m, h[i - N - 1] + STEP);
				if (iz < N - 1) m = Math.min(m, h[i - N + 1] + STEP);
			}
			if (m < h[i]) {
				h[i] = m;
				changed = true;
			}
		}
		for (let ix = N - 1; ix >= 0; ix--) for (let iz = N - 1; iz >= 0; iz--) {
			const i = ix * N + iz;
			let m = h[i];
			if (iz < N - 1) m = Math.min(m, h[i + 1] + STEP);
			if (ix < N - 1) {
				m = Math.min(m, h[i + N] + STEP);
				if (iz < N - 1) m = Math.min(m, h[i + N + 1] + STEP);
				if (iz > 0) m = Math.min(m, h[i + N - 1] + STEP);
			}
			if (m < h[i]) {
				h[i] = m;
				changed = true;
			}
		}
	}
}
/**
* Build the (n+1)² height grid for a bumpiness level. The middle
* (2*SPAWN_PAD_HALF)² cells are guaranteed flat (the spawn pad).
*/
function makeHeights(n, bumpiness, rng) {
	const b = BUMPINESS[bumpiness] || BUMPINESS.hilly;
	const seed = Math.floor(rng.next() * 4294967296) | 0;
	const ox = rng.range(0, 1e3);
	const oz = rng.range(0, 1e3);
	const N = n + 1;
	const c = n / 2;
	const raw = new Float64Array(N * N);
	for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
		let v = fbm(seed, ox + ix / b.scale, oz + iz / b.scale, b.octaves);
		if (b.shape === "peaks") {
			const p = (v + 1) / 2;
			v = p * p * p * 2.2 - .25;
		}
		raw[ix * N + iz] = v * b.amp;
	}
	const padH = Math.round(raw[c * N + c] / STEP) * STEP + 0;
	const h = new Float32Array(N * N);
	for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
		const d = Math.max(0, Math.max(Math.abs(ix - c), Math.abs(iz - c)) - 3);
		const k = smooth(Math.min(1, d / SPAWN_BLEND));
		const v = padH + (raw[ix * N + iz] - padH) * k;
		h[ix * N + iz] = Math.round(v / STEP) * STEP + 0;
	}
	limitSlope(h, n);
	let pad = Infinity;
	for (let ix = c - 3; ix <= c + 3; ix++) for (let iz = c - 3; iz <= c + 3; iz++) pad = Math.min(pad, h[ix * N + iz]);
	for (let ix = c - 3; ix <= c + 3; ix++) for (let iz = c - 3; iz <= c + 3; iz++) h[ix * N + iz] = pad;
	limitSlope(h, n);
	return h;
}
/**
* Flood fill over cells from (sx, sz): 4-connected, skipping blocked cells
* and cells steeper than WALK_MAX_RANGE. Returns Uint8Array (1 = reachable).
*/
function floodFill(t, blocked, sx, sz) {
	const { n } = t;
	const seen = new Uint8Array(n * n);
	const walk = (cx, cz) => !blocked[cx * n + cz] && cellRange(t, cx, cz) <= .5;
	if (!walk(sx, sz)) return seen;
	const stack = [sx * n + sz];
	seen[sx * n + sz] = 1;
	while (stack.length) {
		const i = stack.pop();
		const cx = i / n | 0;
		const cz = i - cx * n;
		if (cx > 0 && !seen[i - n] && walk(cx - 1, cz)) {
			seen[i - n] = 1;
			stack.push(i - n);
		}
		if (cx < n - 1 && !seen[i + n] && walk(cx + 1, cz)) {
			seen[i + n] = 1;
			stack.push(i + n);
		}
		if (cz > 0 && !seen[i - 1] && walk(cx, cz - 1)) {
			seen[i - 1] = 1;
			stack.push(i - 1);
		}
		if (cz < n - 1 && !seen[i + 1] && walk(cx, cz + 1)) {
			seen[i + 1] = 1;
			stack.push(i + 1);
		}
	}
	return seen;
}
/** Mark cell rect [cx0, cx0+w) × [cz0, cz0+l) (grown by margin) in grid. */
function markRect(grid, n, cx0, cz0, w, l, margin = 0, value = 1) {
	for (let cx = Math.max(0, cx0 - margin); cx < Math.min(n, cx0 + w + margin); cx++) for (let cz = Math.max(0, cz0 - margin); cz < Math.min(n, cz0 + l + margin); cz++) grid[cx * n + cz] = value;
}
function rectFree(grid, n, cx0, cz0, w, l) {
	if (cx0 < 0 || cz0 < 0 || cx0 + w > n || cz0 + l > n) return false;
	for (let cx = cx0; cx < cx0 + w; cx++) for (let cz = cz0; cz < cz0 + l; cz++) if (grid[cx * n + cz]) return false;
	return true;
}
/**
* Generate a whole playground world from a normalized config
* ({size, theme, bumpiness, stuff[], stars, seed}). Deterministic per config.
*/
function generate(config) {
	const size = SIZE_CELLS[config.size] ? config.size : "medium";
	const n = SIZE_CELLS[size];
	const rng = new Rng(config.seed);
	const heights = makeHeights(n, config.bumpiness, rng.fork("terrain"));
	const t = {
		n,
		heights
	};
	const blocked = new Uint8Array(n * n);
	const used = new Uint8Array(n * n);
	for (let i = 0; i < n; i++) {
		blocked[i * n] = blocked[i * n + n - 1] = 1;
		blocked[i] = blocked[(n - 1) * n + i] = 1;
	}
	const c = n / 2;
	markRect(used, n, c - 3, c - 3, 6, 6, 2);
	const spawnCell = {
		cx: c,
		cz: c
	};
	const spawnH = heights[vIndex(n, c, c)];
	const spawn = {
		x: 0,
		y: spawnH,
		z: 0,
		dir: {
			x: 0,
			y: 0,
			z: -1
		}
	};
	const pads = [{
		x: 0,
		y: spawnH,
		z: 0,
		cx: c - 1,
		cz: c - 1,
		size: 5,
		spawn: true
	}];
	const protectedV = new Uint8Array((n + 1) * (n + 1));
	protectRect(protectedV, n, c - 3, c - 3, 6, 6);
	const ctx = {
		t,
		n,
		rng,
		blocked,
		used,
		protectedV,
		spawnCell,
		pads,
		size,
		config
	};
	const features = placeFeatures(ctx, rng.fork("features"));
	placePads(ctx, rng.fork("pads"));
	const trees = placeTrees(ctx, rng.fork("trees"));
	const reach = floodFill(t, blocked, spawnCell.cx, spawnCell.cz);
	const stars = placeStars({
		...ctx,
		reach,
		features
	}, rng.fork("stars"));
	let minH = Infinity;
	let maxH = -Infinity;
	for (const v of heights) {
		if (v < minH) minH = v;
		if (v > maxH) maxH = v;
	}
	return {
		n,
		size,
		theme: config.theme,
		heights,
		minH,
		maxH,
		spawn,
		pads,
		features,
		trees,
		stars,
		blocked,
		reach
	};
}
/** Extra flat 3×3 "safe pads" spread around the world: respawn points + landmarks. */
function placePads(ctx, rng) {
	const { t, n, used, pads, size, blocked, protectedV, spawnCell } = ctx;
	const reach = floodFill(t, blocked, spawnCell.cx, spawnCell.cz);
	const want = PAD_COUNTS[size];
	const minDist = n / 5;
	for (let a = 0; a < want * 80 && pads.length < want + 1; a++) {
		const cx0 = rng.int(3, n - 6);
		const cz0 = rng.int(3, n - 6);
		if (!rectFree(used, n, cx0 - 1, cz0 - 1, 5, 5) || !rectFree(blocked, n, cx0 - 1, cz0 - 1, 5, 5)) continue;
		const p = cellCenter(t, cx0 + 1, cz0 + 1);
		if (pads.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < minDist)) continue;
		if (!reach[(cx0 + 1) * n + cz0 + 1]) continue;
		if (!carveFlat(t, protectedV, cx0 - 1, cz0 - 1, 5, 5)) continue;
		protectRect(protectedV, n, cx0 - 1, cz0 - 1, 5, 5);
		markRect(used, n, cx0, cz0, 3, 3, 1);
		pads.push({
			x: p.x,
			y: t.heights[vIndex(n, cx0, cz0)],
			z: p.z,
			cx: cx0,
			cz: cz0,
			size: 3
		});
	}
}
/**
* Decorative trees (trunk cell is solid). Each tree keeps its 8 neighbours
* free, so a lone blocked cell can never cut the world in two.
*/
function placeTrees(ctx, rng) {
	const { t, n, used, blocked, size } = ctx;
	const want = TREE_COUNTS[size];
	const trees = [];
	for (let a = 0; a < want * 30 && trees.length < want; a++) {
		const cx = rng.int(2, n - 3);
		const cz = rng.int(2, n - 3);
		if (!rectFree(used, n, cx - 1, cz - 1, 3, 3) || !rectFree(blocked, n, cx - 1, cz - 1, 3, 3)) continue;
		if (cellRange(t, cx, cz) !== 0) continue;
		const p = cellCenter(t, cx, cz);
		trees.push({
			x: p.x,
			y: cellMin(t, cx, cz),
			z: p.z,
			cx,
			cz,
			kind: rng.int(0, 2),
			height: rng.int(3, 5)
		});
		blocked[cx * n + cz] = 1;
		markRect(used, n, cx - 1, cz - 1, 3, 3);
	}
	return trees;
}
//#endregion
//#region src/playground/TerrainMesh.js
function cellHash(cx, cz) {
	let h = Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663);
	h = Math.imul(h ^ h >>> 13, 1274126177);
	return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
var STONE_FROM = 6.5;
var SNOWCAP_FROM = 10;
/** Ground color for a cell by theme, height and slope. */
function groundColor(theme, pal, y, lowest, sloped, out) {
	if (theme === "snow") {
		if (y <= lowest + .5 && !sloped) return out.set(pal.ice);
		return out.set(sloped ? pal.grassDark : pal.snow);
	}
	if (y >= SNOWCAP_FROM) return out.set(sloped ? "#dfe8f2" : "#f7fbff");
	if (y >= STONE_FROM) return out.set(sloped ? "#8a9096" : pal.stone);
	return out.set(sloped ? pal.grassDark : pal.grass);
}
/**
* @param {{n, heights, minH, maxH, theme}} world
* @returns {THREE.Mesh}
*/
function buildTerrainMesh(world) {
	const { n, heights: h, minH } = world;
	const theme = world.theme === "snow" ? "snow" : "grass";
	const pal = getPalette(theme);
	const t = {
		n,
		heights: h
	};
	const half = n / 2;
	const bottom = minH - 4;
	const skirtTris = 4 * n * 2;
	const tris = n * n * 2 + skirtTris;
	const pos = new Float32Array(tris * 9);
	const col = new Float32Array(tris * 9);
	let k = 0;
	const c = new Color();
	const dirt = new Color(pal.dirt);
	const vert = (x, y, z, color) => {
		pos[k] = x;
		pos[k + 1] = y;
		pos[k + 2] = z;
		col[k] = color.r;
		col[k + 1] = color.g;
		col[k + 2] = color.b;
		k += 3;
	};
	for (let cx = 0; cx < n; cx++) {
		const x0 = cx - half;
		const x1 = x0 + 1;
		for (let cz = 0; cz < n; cz++) {
			const z0 = cz - half;
			const z1 = z0 + 1;
			const h00 = h[vIndex(n, cx, cz)];
			const h10 = h[vIndex(n, cx + 1, cz)];
			const h01 = h[vIndex(n, cx, cz + 1)];
			const h11 = h[vIndex(n, cx + 1, cz + 1)];
			const sloped = cellRange(t, cx, cz) > 0;
			groundColor(theme, pal, cellMin(t, cx, cz), minH, sloped, c);
			const f = 1 + (cellHash(cx, cz) * 2 - 1) * .045 + (cx + cz & 1 ? -.03 : .02);
			c.multiplyScalar(f);
			vert(x0, h00, z0, c);
			vert(x0, h01, z1, c);
			vert(x1, h10, z0, c);
			vert(x1, h11, z1, c);
			vert(x1, h10, z0, c);
			vert(x0, h01, z1, c);
		}
	}
	const quad = (ax, az, ah, bx, bz, bh, outX, outZ) => {
		const shade = c.copy(dirt).multiplyScalar(.85);
		const ex = bx - ax;
		if ((bz - az) * outX - ex * outZ > 0) {
			vert(ax, ah, az, shade);
			vert(bx, bh, bz, shade);
			vert(ax, bottom, az, shade);
			vert(bx, bh, bz, shade);
			vert(bx, bottom, bz, shade);
			vert(ax, bottom, az, shade);
		} else {
			vert(ax, ah, az, shade);
			vert(ax, bottom, az, shade);
			vert(bx, bh, bz, shade);
			vert(bx, bh, bz, shade);
			vert(ax, bottom, az, shade);
			vert(bx, bottom, bz, shade);
		}
	};
	for (let i = 0; i < n; i++) {
		const a = i - half;
		const b = a + 1;
		quad(-half, a, h[vIndex(n, 0, i)], -half, b, h[vIndex(n, 0, i + 1)], -1, 0);
		quad(half, a, h[vIndex(n, n, i)], half, b, h[vIndex(n, n, i + 1)], 1, 0);
		quad(a, -half, h[vIndex(n, i, 0)], b, -half, h[vIndex(n, i + 1, 0)], 0, -1);
		quad(a, half, h[vIndex(n, i, n)], b, half, h[vIndex(n, i + 1, n)], 0, 1);
	}
	const geo = new BufferGeometry();
	geo.setAttribute("position", new BufferAttribute(pos, 3));
	geo.setAttribute("color", new BufferAttribute(col, 3));
	geo.computeVertexNormals();
	geo.computeBoundingSphere();
	const mesh = new Mesh(geo, new MeshLambertMaterial({
		vertexColors: true,
		flatShading: true
	}));
	mesh.name = "terrain";
	return mesh;
}
/** Border wall, safe pads and trees → blocks. */
function addWorldBlocks(world, blocks) {
	const { n, heights: h, pads, trees } = world;
	const t = {
		n,
		heights: h
	};
	const half = n / 2;
	const snow = world.theme === "snow";
	const wallTop = 1.2;
	const wallCell = (cx, cz) => {
		const lo = cellMin(t, cx, cz) - .5;
		const hi = Math.max(h[vIndex(n, cx, cz)], h[vIndex(n, cx + 1, cz)], h[vIndex(n, cx, cz + 1)], h[vIndex(n, cx + 1, cz + 1)]) + wallTop;
		blocks.addBox({
			x: cx - half + .5,
			y: (lo + hi) / 2,
			z: cz - half + .5
		}, {
			x: 1,
			y: hi - lo,
			z: 1
		}, (cx + cz) % 2 ? "wall" : "stone");
	};
	for (let i = 0; i < n; i++) {
		wallCell(i, 0);
		wallCell(i, n - 1);
		if (i > 0 && i < n - 1) {
			wallCell(0, i);
			wallCell(n - 1, i);
		}
	}
	for (const p of pads) {
		const s = p.size;
		for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) blocks.addBox({
			x: p.x - s / 2 + i + .5,
			y: p.y - .06,
			z: p.z - s / 2 + j + .5
		}, {
			x: 1,
			y: .2,
			z: 1
		}, (i + j) % 2 ? "pad" : "white", { jitter: 0 });
	}
	for (const tr of trees) {
		const th = tr.height;
		blocks.addBox({
			x: tr.x,
			y: tr.y + th / 2,
			z: tr.z
		}, {
			x: .8,
			y: th,
			z: .8
		}, "trunk");
		if (snow) for (let k = 0; k < 3; k++) {
			const w = 3 - k * .9;
			const y = tr.y + th - .5 + k * .9;
			blocks.addBox({
				x: tr.x,
				y,
				z: tr.z
			}, {
				x: w,
				y: .8,
				z: w
			}, "leaves");
			blocks.addBox({
				x: tr.x,
				y: y + .45,
				z: tr.z
			}, {
				x: w - .3,
				y: .15,
				z: w - .3
			}, "snow");
		}
		else if (tr.kind === 2) {
			blocks.addBox({
				x: tr.x,
				y: tr.y + th + .6,
				z: tr.z
			}, {
				x: 2.6,
				y: 2,
				z: 2.6
			}, "leaves");
			blocks.addBox({
				x: tr.x,
				y: tr.y + th + 1.9,
				z: tr.z
			}, {
				x: 1.6,
				y: .8,
				z: 1.6
			}, "leaves");
		} else blocks.addBox({
			x: tr.x,
			y: tr.y + th + .8,
			z: tr.z
		}, {
			x: 3,
			y: 2.4,
			z: 3
		}, tr.kind ? "leaves" : "green");
	}
}
//#endregion
//#region src/playground/Snow.js
var COUNT = 700;
var BOX = {
	x: 44,
	y: 22,
	z: 44
};
var Snowfall = class {
	constructor(scene) {
		this.pos = new Float32Array(COUNT * 3);
		this.drift = new Float32Array(COUNT);
		let s = 12345;
		const rand = () => (s = s * 16807 % 2147483647) / 2147483647;
		for (let i = 0; i < COUNT; i++) {
			this.pos[i * 3] = rand() * BOX.x;
			this.pos[i * 3 + 1] = rand() * BOX.y;
			this.pos[i * 3 + 2] = rand() * BOX.z;
			this.drift[i] = rand() * Math.PI * 2;
		}
		const geo = new BufferGeometry();
		this.attr = new BufferAttribute(new Float32Array(COUNT * 3), 3);
		geo.setAttribute("position", this.attr);
		this.points = new Points(geo, new PointsMaterial({
			color: 16777215,
			size: .13,
			transparent: true,
			opacity: .9,
			depthWrite: false
		}));
		this.points.frustumCulled = false;
		this.points.name = "snowfall";
		scene.add(this.points);
		this.time = 0;
	}
	/** Move flakes down and wrap them into the box around `center` (the camera). */
	update(dt, center) {
		this.time += dt;
		const out = this.attr.array;
		const ox = center.x - BOX.x / 2;
		const oy = center.y - BOX.y / 2;
		const oz = center.z - BOX.z / 2;
		const wrap = (v, size) => (v % size + size) % size;
		for (let i = 0; i < COUNT; i++) {
			const j = i * 3;
			this.pos[j + 1] -= dt * 1.6;
			const sway = Math.sin(this.time * .8 + this.drift[i]) * .6;
			out[j] = ox + wrap(this.pos[j] + sway - ox, BOX.x);
			out[j + 1] = oy + wrap(this.pos[j + 1] - oy, BOX.y);
			out[j + 2] = oz + wrap(this.pos[j + 2] - oz, BOX.z);
		}
		this.attr.needsUpdate = true;
	}
	dispose() {
		this.points.removeFromParent();
		this.points.geometry.dispose();
		this.points.material.dispose();
	}
};
//#endregion
//#region src/fx/confetti.js
var COLORS = [
	"#e8302e",
	"#ff8a1f",
	"#ffd21f",
	"#2fb84a",
	"#2e6be8",
	"#8a3ee8",
	"#ff5fa2",
	"#22d3ee"
];
/**
* @param {HTMLElement} parent
* @param {number} [n=60] pieces
* @returns {() => void} remove now
*/
function confetti(parent, n = 60) {
	const box = document.createElement("div");
	box.className = "fx-confetti";
	for (let i = 0; i < n; i++) {
		const c = document.createElement("i");
		const h = (i * 2654435761 >>> 0) / 4294967296;
		const h2 = (i * 40503 + 17) % 97 / 97;
		c.style.left = `${(h * 100).toFixed(1)}%`;
		c.style.background = COLORS[i % COLORS.length];
		c.style.animationDuration = `${(1.8 + h2 * 1.6).toFixed(2)}s`;
		c.style.animationDelay = `${(h2 * .6).toFixed(2)}s`;
		c.style.setProperty("--dx", `${((h2 - .5) * 30).toFixed(1)}vw`);
		c.style.setProperty("--rot", `${Math.round((h - .5) * 1440)}deg`);
		box.appendChild(c);
	}
	parent.appendChild(box);
	const t = setTimeout(() => box.remove(), 4200);
	return () => {
		clearTimeout(t);
		box.remove();
	};
}
var STUCK_DIST = .5;
var StuckWatch = class {
	constructor({ time = 5, dist = STUCK_DIST } = {}) {
		this.time = time;
		this.dist = dist;
		this.anchor = null;
		this.t = 0;
	}
	/** Forget the anchor (call after a respawn). */
	reset() {
		this.anchor = null;
		this.t = 0;
	}
	/**
	* @param {number} dt
	* @param {{x:number, y:number, z:number}} pos ball position
	* @param {boolean} steering the player is pushing the stick/keys
	* @returns {boolean} true once when the ball counts as stuck (then resets)
	*/
	update(dt, pos, steering) {
		if (!this.anchor) {
			this.anchor = {
				x: pos.x,
				y: pos.y,
				z: pos.z
			};
			this.t = 0;
			return false;
		}
		const a = this.anchor;
		if (Math.hypot(pos.x - a.x, pos.y - a.y, pos.z - a.z) > this.dist) {
			a.x = pos.x;
			a.y = pos.y;
			a.z = pos.z;
			this.t = 0;
			return false;
		}
		if (steering) this.t += dt;
		if (this.t >= this.time) {
			this.reset();
			return true;
		}
		return false;
	}
};
//#endregion
//#region src/playground/PlaygroundMode.js
var FADE_TIME = .35;
var FALL_BELOW = 6;
var CAM_CLEARANCE = .8;
var STAR_CHEER_EVERY = 10;
var STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.8 9.2l7.1-.8z"/></svg>`;
var PlaygroundMode = class {
	async start(ctx, config) {
		this.ctx = ctx;
		this.config = config;
		this.sessionStars = 0;
		this.fade = null;
		this.lastSafe = new Vector3();
		this._pos = new Vector3();
		this._fwd = new Vector3();
		this._look = new Vector3();
		this._dir = new Vector3();
		this._camTarget = new Vector3();
		this.camPull = null;
		this.stuck = new StuckWatch();
		this._buildHud();
		this._buildWorld(config);
		const { spawn } = this.world.data;
		const spawnPos = {
			x: spawn.x,
			y: spawn.y + .8,
			z: spawn.z
		};
		this.ball = new Ball({
			physics: ctx.physics,
			scene: ctx.scene,
			position: spawnPos,
			skin: ctx.save.get().skins.selected,
			tuning: { speedCap: 9 }
		});
		this.lastSafe.set(spawnPos.x, spawnPos.y, spawnPos.z);
		this.ball.dust?.setColor(config.theme === "snow" ? 16777215 : 15853260);
		this.ball.onLand = (impact) => {
			ctx.audio.play("thump", {
				volume: Math.min(.6, impact / 18),
				pitch: 1.6
			});
		};
		this._cancelConfetti = [];
		this.cam = new ChaseCamera(ctx.camera, {
			mode: "free",
			distance: 7.5,
			height: 3.4
		});
		this.cam.snap(spawnPos, spawn.dir);
		ctx.debug.watch("speed", () => this.ball.speed);
		ctx.debug.watch("seed", () => this.config.seed);
		ctx.debug.watch("stars", () => `${this.sessionStars} (${this.world.stars.remaining} left)`);
		ctx.debug.watch("world", () => {
			const d = this.world.data;
			return `${d.n}² h ${d.minH}..${d.maxH} ${d.features.length} stuff ${d.pads.length} pads`;
		});
	}
	_buildWorld(config) {
		const { scene, physics, audio } = this.ctx;
		const data = generate(config);
		const theme = config.theme === "snow" ? "snow" : "grass";
		const far = Math.min(230, 90 + data.n * .6);
		applySky(scene, theme, {
			near: theme === "snow" ? 30 : 45,
			far
		});
		const w = {
			data,
			bodies: [],
			meshes: []
		};
		const { n, heights, minH, maxH } = data;
		const hf = physics.addHeightfield({
			nx: n,
			nz: n,
			heights,
			sizeX: n,
			sizeZ: n,
			friction: .8,
			tag: "ground"
		});
		w.bodies.push(hf.body);
		const lo = minH - 10;
		const hi = maxH + 40;
		const cy = (lo + hi) / 2;
		const hy = (hi - lo) / 2;
		const half = n / 2;
		for (const [x, z, hx, hz] of [
			[
				-half + .5,
				0,
				.5,
				half
			],
			[
				half - .5,
				0,
				.5,
				half
			],
			[
				0,
				-half + .5,
				half,
				.5
			],
			[
				0,
				half - .5,
				half,
				.5
			]
		]) {
			const { body } = physics.addFixedCuboid({
				position: {
					x,
					y: cy,
					z
				},
				halfExtents: {
					x: hx,
					y: hy,
					z: hz
				},
				friction: .2,
				tag: "border"
			});
			w.bodies.push(body);
		}
		for (const t of data.trees) {
			const { body } = physics.addFixedCuboid({
				position: {
					x: t.x,
					y: t.y + t.height / 2,
					z: t.z
				},
				halfExtents: {
					x: .4,
					y: t.height / 2,
					z: .4
				},
				friction: .5,
				restitution: .3,
				tag: "tree"
			});
			w.bodies.push(body);
		}
		const terrain = buildTerrainMesh(data);
		scene.add(terrain);
		w.meshes.push(terrain);
		w.blocks = new BlockMesh({ palette: theme });
		addWorldBlocks(data, w.blocks);
		w.features = new FeatureSet({
			physics,
			scene,
			blocks: w.blocks,
			features: data.features,
			audio
		});
		scene.add(w.blocks.build());
		w.stars = new StarField({
			scene,
			stars: data.stars
		});
		w.snow = theme === "snow" ? new Snowfall(scene) : null;
		this.world = w;
		this.hud.stars.classList.toggle("hidden", data.stars.length === 0);
	}
	_disposeWorld() {
		const w = this.world;
		if (!w) return;
		const { physics } = this.ctx;
		w.features.dispose();
		w.stars.dispose();
		w.snow?.dispose();
		w.blocks.dispose();
		for (const b of w.bodies) physics.remove(b);
		for (const m of w.meshes) {
			m.removeFromParent();
			m.geometry.dispose();
			m.material.dispose();
		}
		this.world = null;
	}
	_buildHud() {
		const { ui } = this.ctx;
		const stars = document.createElement("div");
		stars.className = "pg-stars";
		stars.innerHTML = `${STAR_SVG}<span class="pg-stars__n">0</span>`;
		const fade = document.createElement("div");
		fade.className = "pg-fade";
		ui.append(stars, fade);
		this.hud = {
			stars,
			count: stars.querySelector(".pg-stars__n"),
			fade
		};
	}
	_bumpStarHud() {
		const { stars, count } = this.hud;
		count.textContent = String(this.sessionStars);
		stars.classList.remove("pg-stars--bump");
		stars.offsetWidth;
		stars.classList.add("pg-stars--bump");
	}
	_cheer(n) {
		this._cancelConfetti.push(confetti(this.ctx.ui, n));
		if (this._cancelConfetti.length > 4) this._cancelConfetti.shift();
	}
	update(dt) {
		const { input } = this.ctx;
		this.cam.getForward(this._fwd);
		this.ball.update(dt, input.getMove(), this._fwd);
		this.world.features.update(dt);
		const pos = this.ball.getPosition(this._pos);
		if (this.ball.isGrounded()) this.lastSafe.copy(pos);
		const d = this.world.data;
		const half = d.n / 2 + 2;
		const out = pos.y < d.minH - FALL_BELOW || Math.abs(pos.x) > half || Math.abs(pos.z) > half;
		const wedged = !this.fade && this.stuck.update(dt, pos, input.isActive());
		if ((out || wedged) && !this.fade) this.fade = {
			phase: "out",
			t: 0
		};
		if (this.fade) {
			this.fade.t += dt;
			if (this.fade.phase === "out" && this.fade.t >= FADE_TIME) {
				this.respawn();
				this.fade = {
					phase: "in",
					t: 0
				};
			} else if (this.fade.phase === "in" && this.fade.t >= FADE_TIME) this.fade = null;
		}
	}
	postStep(dt) {
		this.world.features.postStep(dt, this.ball);
		const got = this.world.stars.collect(this.ball.getPosition(this._pos));
		if (got) {
			const { audio, events } = this.ctx;
			for (let i = 0; i < got; i++) {
				this.sessionStars++;
				events.emit("starCollected", { sessionStars: this.sessionStars });
			}
			audio.play("pop", { pitch: 1.2 });
			audio.play("sparkle", { volume: .7 });
			this._bumpStarHud();
			if (this.world.stars.remaining === 0) {
				audio.play("fanfare");
				audio.play("confetti");
				this.hud.stars.classList.add("pg-stars--all");
				this._cheer(90);
			} else if (this.sessionStars % STAR_CHEER_EVERY === 0) {
				audio.play("confetti", { volume: .6 });
				this._cheer(24);
			}
		}
	}
	render(alpha, frameDt) {
		const dt = Math.min(frameDt, .1);
		const look = this.ctx.input.consumeLook();
		if (look.dx || look.dy) this.cam.addLook(look.dx, look.dy);
		this.ball.render(alpha, frameDt);
		this.cam.update(dt, {
			position: this.ball.position,
			velocity: this.ball.velocity
		});
		this._keepCameraClear(dt);
		this.world.features.render(alpha, dt);
		this.world.stars.render(dt);
		this.world.snow?.update(dt, this.ctx.camera.position);
		let o = 0;
		if (this.fade) {
			const k = Math.min(1, this.fade.t / FADE_TIME);
			o = this.fade.phase === "out" ? k : 1 - k;
		}
		this.hud.fade.style.opacity = o.toFixed(3);
	}
	/**
	* Keep hills, tunnel roofs and walls from hiding the ball: pull the camera
	* in along the ball→camera ray when something is in the way (fast in, slow
	* out), and never below the ground under the camera.
	*/
	_keepCameraClear(dt) {
		const camera = this.ctx.camera;
		const focus = this._look.copy(this.cam.focus);
		focus.y += .6;
		const dir = this._dir.copy(camera.position).sub(focus);
		const full = dir.length();
		if (full < .001) return;
		dir.divideScalar(full);
		const { world, RAPIER } = this.ctx.physics;
		const hit = world.castRay(new RAPIER.Ray(focus, dir), full, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, void 0, void 0, this.ball.body, (collider) => this.ctx.physics.info(collider)?.tag !== "border");
		let toi = hit ? hit.timeOfImpact : full;
		toi = Math.min(toi, this._treeHit(focus, dir, toi));
		const want = toi < full ? Math.max(1.2, toi - .35) : full;
		if (this.camPull === null) this.camPull = want;
		else if (want < this.camPull) this.camPull = want;
		else this.camPull += (want - this.camPull) * (1 - Math.exp(-2 * dt));
		const dist = Math.min(full, this.camPull);
		const p = this._camTarget.copy(focus).addScaledVector(dir, dist);
		const ground = heightAt(this.world.data, p.x, p.z) + CAM_CLEARANCE;
		if (p.y < ground) p.y = ground;
		if (dist < full - .001 || p.y !== camera.position.y) {
			camera.position.copy(p);
			this.cam.getForward(this._fwd);
			camera.lookAt(focus.x + this._fwd.x * this.cam.lookAhead, focus.y, focus.z + this._fwd.z * this.cam.lookAhead);
		}
	}
	/**
	* Tree canopies have no colliders (the ball rolls under them), so the
	* physics ray misses them. Ray vs. each nearby canopy box; returns the
	* nearest hit distance (or maxDist).
	*/
	_treeHit(o, d, maxDist) {
		let best = maxDist;
		const r2 = (maxDist + 3) ** 2;
		for (const t of this.world.data.trees) {
			const dx = t.x - o.x;
			const dz = t.z - o.z;
			if (dx * dx + dz * dz > r2) continue;
			const top = t.y + t.height + 2.3;
			best = rayBox(o, d, t.x - 1.5, t.y + t.height - 1, t.z - 1.5, t.x + 1.5, top, t.z + 1.5, best);
		}
		return best;
	}
	/** Respawn at the safe pad nearest to where the ball last touched ground. */
	respawn() {
		const { pads } = this.world.data;
		let best = pads[0];
		let bestD = Infinity;
		for (const p of pads) {
			const d = (p.x - this.lastSafe.x) ** 2 + (p.z - this.lastSafe.z) ** 2;
			if (d < bestD) {
				bestD = d;
				best = p;
			}
		}
		const pos = {
			x: best.x,
			y: best.y + .8,
			z: best.z
		};
		this.cam.getForward(this._fwd);
		this.ball.respawn(pos, this._fwd);
		this.lastSafe.set(pos.x, pos.y, pos.z);
		this.stuck.reset();
		this.cam.snap(pos, this._fwd);
		this.camPull = null;
		this.ctx.audio.play("boing");
	}
	regenerate() {
		this._disposeWorld();
		this.config = {
			...this.config,
			seed: randomEmojiSeed()
		};
		this._buildWorld(this.config);
		this.lastSafe.set(0, 0, 0);
		this.respawn();
		this.hud.stars.classList.remove("pg-stars--all");
		this.ctx.audio.play("pop");
	}
	dispose() {
		for (const cancel of this._cancelConfetti || []) cancel();
		this._disposeWorld();
		this.ball?.dispose();
	}
};
/** Slab test: distance along unit ray (o, d) into the box, if < best; else best. */
function rayBox(o, d, x0, y0, z0, x1, y1, z1, best) {
	const span = {
		lo: 0,
		hi: best
	};
	if (!slab(o.x, d.x, x0, x1, span) || !slab(o.y, d.y, y0, y1, span) || !slab(o.z, d.z, z0, z1, span)) return best;
	return span.lo < best ? span.lo : best;
}
function slab(o, d, lo, hi, span) {
	if (Math.abs(d) < 1e-8) return o >= lo && o <= hi;
	let a = (lo - o) / d;
	let b = (hi - o) / d;
	if (a > b) [a, b] = [b, a];
	if (a > span.lo) span.lo = a;
	if (b < span.hi) span.hi = b;
	return span.lo <= span.hi;
}
//#endregion
export { PlaygroundMode as default };
