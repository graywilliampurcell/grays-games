import { D as MeshBasicMaterial, E as Mesh, F as getSkin, N as Vector3, O as MeshLambertMaterial, P as SKINS, T as Matrix4, b as InstancedMesh, c as randomEmojiSeed, f as CircleGeometry, j as Quaternion, l as BoxGeometry, n as makeBallGeometry, r as makeSkinMaterial, s as Rng, t as drawSkinIcon } from "./index-Cs7XvCIe.js";
import { f as lerp, h as smoothstep, l as clamp, r as getPiece, u as deg } from "./Catalog-CUbTmyD8.js";
import { n as BALL_RADIUS, r as Ball, t as ChaseCamera } from "./ChaseCamera-CIJzGBRJ.js";
import { n as TrackLayout, t as buildTrack } from "./TrackBuilder-C-0t_KFI.js";
//#region src/race/difficulty.js
/** Race-wide knobs (tune these first). */
var RACE_TUNING = {
	checkpointSpacing: 20,
	aiSpeedFraction: .85,
	aiSkillSpread: .04,
	aiAccel: 5,
	aiCatchUp: 1.12,
	aiMinFraction: .45,
	aiWobble: .25,
	mercyFalls: 3,
	stuckTime: 5,
	respawnDelay: 1,
	fallDepth: 2.5,
	finishBannerTime: 2.4,
	tapDelay: 1.2
};
/**
* One entry per level (index 0 = level 1).
*   width, rails, gaps, hazards, speedCap, autoRoll, opponents, length: plan §3.5
*   hazardSpeed   multiplies every moving hazard's speed (L3 "slow hammers")
*   cruise        auto-roll speed with the stick centered (× speedCap)
*   aiSpeed       opponent base speed (× speedCap); level 1 is slower than the player
*   leadCap       m an opponent may lead the player before it slows to match
*   aiMinFraction optional per-level override of RACE_TUNING.aiMinFraction
*   behindCap     m the player may lead before opponents speed up (mildly)
*   maxChallengeRun  hazards/gaps allowed back to back (1 = never two in a row)
*   rampRise      m height of ramp pieces
*   pieces        allow-list: piece id → weight for the generator
*/
var DIFFICULTIES = [
	{
		level: 1,
		name: "Rolling Hills",
		width: 8,
		rails: "full",
		gaps: "none",
		hazards: [],
		speedCap: 6,
		autoRoll: true,
		opponents: 2,
		length: 120,
		hazardSpeed: 0,
		cruise: .85,
		aiSpeed: .65,
		leadCap: 3,
		behindCap: 12,
		maxChallengeRun: 0,
		rampRise: 2,
		pieces: {
			straight: 3,
			"curve-gentle-left": 2,
			"curve-gentle-right": 2,
			"ramp-up": 1.5,
			"ramp-down": 1.5
		}
	},
	{
		level: 2,
		name: "Bumpy Road",
		width: 6,
		rails: "full",
		gaps: "none",
		hazards: ["bumpers"],
		speedCap: 7,
		autoRoll: true,
		opponents: 2,
		length: 150,
		hazardSpeed: 0,
		cruise: .85,
		aiSpeed: .8,
		leadCap: 5,
		behindCap: 12,
		maxChallengeRun: 1,
		rampRise: 2.5,
		pieces: {
			straight: 3,
			"curve-gentle-left": 2,
			"curve-gentle-right": 2,
			"curve-sharp-left": 1,
			"curve-sharp-right": 1,
			"ramp-up": 1.2,
			"ramp-down": 1.2,
			bumpers: 2.5
		}
	},
	{
		level: 3,
		name: "Sky Road",
		width: 5,
		rails: "curves",
		gaps: "bridged",
		hazards: ["bumpers", "hammer"],
		speedCap: 8,
		autoRoll: true,
		opponents: 3,
		length: 180,
		hazardSpeed: .6,
		cruise: .85,
		aiSpeed: .66,
		leadCap: 6,
		behindCap: 12,
		maxChallengeRun: 1,
		rampRise: 3,
		pieces: {
			straight: 2.5,
			"curve-gentle-left": 1.5,
			"curve-gentle-right": 1.5,
			"curve-sharp-left": 1,
			"curve-sharp-right": 1,
			"ramp-up": 1,
			"ramp-down": 1,
			boost: 1,
			bumpers: 1.5,
			hammer: 2,
			"gap-bridged": 1.5
		}
	},
	{
		level: 4,
		name: "Hammer Time",
		width: 4,
		rails: "none",
		gaps: "small",
		hazards: ["hammer", "wrecking-ball"],
		speedCap: 10,
		autoRoll: false,
		opponents: 3,
		length: 220,
		hazardSpeed: .85,
		cruise: .85,
		aiSpeed: .74,
		leadCap: 8,
		behindCap: 14,
		maxChallengeRun: 2,
		rampRise: 3,
		pieces: {
			straight: 2,
			"curve-gentle-left": 1.2,
			"curve-gentle-right": 1.2,
			"curve-sharp-left": 1,
			"curve-sharp-right": 1,
			"ramp-up": 1,
			"ramp-down": 1,
			boost: 1,
			hammer: 2,
			"wrecking-ball": 2,
			"gap-bridged": 1,
			"gap-open": 1.5,
			beam: 1
		}
	},
	{
		level: 5,
		name: "Going Big",
		width: 3,
		rails: "none",
		gaps: "jumps",
		hazards: [
			"hammer",
			"wrecking-ball",
			"spinner",
			"moving-platform"
		],
		speedCap: 12,
		autoRoll: false,
		opponents: 3,
		length: 260,
		hazardSpeed: 1,
		cruise: .85,
		aiSpeed: .6,
		leadCap: 5,
		aiMinFraction: .1,
		behindCap: 16,
		maxChallengeRun: 3,
		rampRise: 3,
		pieces: {
			straight: 1.5,
			"curve-gentle-left": 1,
			"curve-gentle-right": 1,
			"curve-sharp-left": 1,
			"curve-sharp-right": 1,
			"ramp-up": .8,
			"ramp-down": .8,
			boost: .8,
			hammer: 1.5,
			"wrecking-ball": 1.5,
			spinner: 1.5,
			"moving-platform": 1.2,
			"gap-open": 1.2,
			launch: 1.2,
			beam: 1.2
		}
	}
];
/** Settings for a level (clamped to 1..5). */
function getDifficulty(level) {
	return DIFFICULTIES[Math.min(5, Math.max(1, Math.round(Number(level)) || 1)) - 1];
}
var MEDALS = [
	"gold",
	"silver",
	"bronze",
	"ribbon"
];
/** Place 1..4+ → medal. */
function medalForPlace(place) {
	return MEDALS[Math.min(3, Math.max(0, Math.round(place) - 1))];
}
/**
* Series cup from the places (CONTRACT §7): average place ≤ 1.5 gold,
* ≤ 2.5 silver, ≤ 3.5 bronze, else ribbon.
*/
function cupForPlaces(places) {
	if (!places.length) return "ribbon";
	const avg = places.reduce((a, b) => a + b, 0) / places.length;
	if (avg <= 1.5) return "gold";
	if (avg <= 2.5) return "silver";
	if (avg <= 3.5) return "bronze";
	return "ribbon";
}
/** Seed for race i (0-based) of a series; the URL seed reproduces the whole series. */
function raceSeed(seriesSeed, index) {
	return `${seriesSeed}/race${index + 1}`;
}
//#endregion
//#region src/track/TrackGenerator.js
var LEAD_IN = 8;
var FINISH_LINE_S = 4;
var MIN_FINAL = 6;
var MAX_FINAL = 16;
var MAX_HEADING = deg(90);
var MAX_HEIGHT = 6;
var MAX_ATTEMPTS = 25;
/** Kinds that don't break up a run of challenges (and don't count as one). */
var NEUTRAL = /* @__PURE__ */ new Set(["checkpoint", "boost"]);
function isChallenge(id) {
	const p = getPiece(id);
	return !!(p.hazard || p.gap);
}
var entryId = (e) => typeof e === "string" ? e : e.id;
var _lenCache = /* @__PURE__ */ new Map();
/** Exact arc length of one piece entry (m), from the pure layout. */
function pieceLength(entry, options) {
	const key = `${JSON.stringify(entry)}|${options.width}`;
	let v = _lenCache.get(key);
	if (v === void 0) {
		v = new TrackLayout([entry], options).length;
		_lenCache.set(key, v);
	}
	return v;
}
/** Heading change (rad, + = left) and height change of an entry. */
function pieceDelta(entry, options) {
	const def = getPiece(entryId(entry)).build({
		...options,
		...typeof entry === "string" ? {} : entry
	});
	let turn = 0;
	let rise = 0;
	for (const s of def.sections) {
		turn += s.turn || 0;
		rise += s.rise || 0;
	}
	return {
		turn,
		rise
	};
}
function makeEntry(id, rng, cfg) {
	switch (id) {
		case "straight": return {
			id,
			len: rng.pick([
				8,
				10,
				12
			])
		};
		case "ramp-up":
		case "ramp-down": return {
			id,
			rise: cfg.rampRise
		};
		case "bumpers": return cfg.rails === "none" ? id : {
			id,
			guard: true
		};
		case "beam": return {
			id,
			len: rng.pick([
				7,
				8,
				10
			])
		};
		case "hammer": return {
			id,
			side: rng.chance(.5) ? 1 : -1,
			phase: +rng.range(0, Math.PI * 2).toFixed(3)
		};
		case "wrecking-ball":
		case "spinner":
		case "moving-platform": return {
			id,
			phase: +rng.range(0, Math.PI * 2).toFixed(3)
		};
		default: return id;
	}
}
/** The entries a pick expands to (gates and boost pads the rules demand). */
function chunkFor(id, entry) {
	const p = getPiece(id);
	if (id === "launch") return [
		"checkpoint",
		"boost",
		entry
	];
	if (p.gap) return ["checkpoint", entry];
	return [entry];
}
function attempt(cfg, seed, n) {
	const rng = new Rng(n === 0 ? `track:${seed}` : `track:${seed}~${n}`);
	const options = {
		width: cfg.width,
		rails: cfg.rails,
		hazardSpeed: cfg.hazardSpeed || 1
	};
	const len = (e) => pieceLength(e, options);
	const spacing = RACE_TUNING.checkpointSpacing;
	const pieces = ["start", {
		id: "straight",
		len: LEAD_IN
	}];
	let s = len("start") + LEAD_IN;
	let lastCp = 6;
	let heading = 0;
	let height = 0;
	let run = 0;
	let prev = "straight";
	const cpLen = len("checkpoint");
	const append = (list) => {
		const lastIsCp = entryId(pieces[pieces.length - 1]) === "checkpoint";
		const entries = lastIsCp && entryId(list[0]) === "checkpoint" ? list.slice(1) : list;
		const total = entries.reduce((a, e) => a + len(e), 0);
		if (entryId(entries[0]) !== "checkpoint" && !lastIsCp && s + total / 2 - lastCp > spacing) {
			pieces.push("checkpoint");
			lastCp = s + cpLen / 2;
			s += cpLen;
		}
		for (const e of entries) {
			if (entryId(e) === "checkpoint") lastCp = s + cpLen / 2;
			pieces.push(e);
			s += len(e);
		}
	};
	const ids = Object.keys(cfg.pieces);
	for (;;) {
		const room = cfg.length - FINISH_LINE_S - MIN_FINAL - s;
		const options2 = [];
		for (const id of ids) {
			const weight = cfg.pieces[id];
			if (!(weight > 0)) continue;
			const entry = makeEntry(id, rng, cfg);
			const chunk = chunkFor(id, entry);
			if (chunk.reduce((a, e) => a + len(e), 0) + cpLen > room) continue;
			const challenge = isChallenge(id);
			if (challenge && run >= cfg.maxChallengeRun) continue;
			if (id === "boost" && (prev === "boost" || prev === "launch")) continue;
			if (id.startsWith("curve-sharp") && (prev === "boost" || prev === "launch")) continue;
			const { turn, rise } = pieceDelta(entry, options);
			if (Math.abs(heading + turn) > MAX_HEADING + 1e-6) continue;
			if (Math.abs(height + rise) > MAX_HEIGHT) continue;
			let w = weight;
			if (id === prev) w *= .3;
			if (turn && Math.sign(turn) === Math.sign(heading)) w *= .6;
			if (rise && Math.sign(rise) === Math.sign(height) && Math.abs(height) > 2) w *= .4;
			options2.push({
				item: {
					id,
					chunk,
					turn,
					rise,
					challenge
				},
				weight: w
			});
		}
		const pick = rng.weighted(options2);
		if (!pick) break;
		append(pick.chunk);
		heading += pick.turn;
		height += pick.rise;
		run = pick.challenge ? run + 1 : NEUTRAL.has(pick.id) ? run : 0;
		prev = pick.id;
		if (cfg.length - FINISH_LINE_S - s <= MAX_FINAL) break;
	}
	let finalLen = Math.max(MIN_FINAL, cfg.length - FINISH_LINE_S - s);
	while (finalLen > 0) {
		const l = Math.min(finalLen, 24);
		append([{
			id: "straight",
			len: +l.toFixed(2)
		}]);
		finalLen -= l;
		if (finalLen < MIN_FINAL / 2) break;
	}
	pieces.push("finish");
	return {
		pieces,
		options
	};
}
/**
* Generate a race track.
* @param {{difficulty:number, seed:string|number}} o
* @returns {{pieces, options, difficulty, seed, layout, attempts, errors}}
*/
function generateTrack({ difficulty = 1, seed = "rolly" } = {}) {
	const cfg = getDifficulty(difficulty);
	let last = null;
	for (let n = 0; n < MAX_ATTEMPTS; n++) {
		const { pieces, options } = attempt(cfg, String(seed), n);
		const layout = new TrackLayout(pieces, options);
		const errors = [...checkTrackRules(pieces, cfg.level), ...validateLayout(layout, cfg.level)];
		last = {
			pieces,
			options,
			difficulty: cfg.level,
			seed: String(seed),
			layout,
			attempts: n + 1,
			errors
		};
		if (errors.length === 0) return last;
	}
	return last;
}
/**
* Rule check on a piece list for a level. Returns a list of problems ([] = ok).
* @param {Array<string|object>} pieces
* @param {number} level
*/
function checkTrackRules(pieces, level) {
	const cfg = getDifficulty(level);
	const errors = [];
	const ids = pieces.map(entryId);
	if (ids[0] !== "start") errors.push("first piece is not the start pad");
	if (ids[ids.length - 1] !== "finish") errors.push("last piece is not the finish");
	if (ids.filter((id) => id === "start" || id === "finish").length !== 2) errors.push("start/finish appear more than once");
	let run = 0;
	ids.forEach((id, i) => {
		if (id === "start" || id === "finish") return;
		const p = getPiece(id);
		if (id !== "checkpoint" && id !== "straight" && !(id in cfg.pieces)) errors.push(`${id} not allowed at level ${level}`);
		if (p.gap) {
			const before = id === "launch" ? [ids[i - 2], ids[i - 1]] : [ids[i - 1]];
			const want = id === "launch" ? ["checkpoint", "boost"] : ["checkpoint"];
			if (before.join() !== want.join()) errors.push(`${id} at #${i} is not preceded by ${want.join(" + ")}`);
		}
		if (id === "gap-open" && level <= 3) errors.push(`open gap at level ${level}`);
		if (p.hazard && !cfg.hazards.includes(id)) errors.push(`hazard ${id} not allowed at level ${level}`);
		if (p.gap && cfg.gaps === "none") errors.push(`gap ${id} at level ${level}`);
		if (isChallenge(id)) {
			run++;
			if (run > Math.max(1, cfg.maxChallengeRun)) errors.push(`${run} challenges in a row at #${i}`);
		} else if (!NEUTRAL.has(id)) run = 0;
	});
	return errors;
}
/**
* Geometry checks on a laid-out track: length, checkpoint spacing, a
* continuous on-road AI path, no self-overlap. Returns problems ([] = ok).
*/
function validateLayout(layout, level) {
	const cfg = getDifficulty(level);
	const errors = [];
	const finishS = layout.finish ? layout.finish.s : layout.length;
	if (!layout.finish) errors.push("no finish line");
	if (Math.abs(finishS - cfg.length) > cfg.length * .08) errors.push(`finish at ${finishS.toFixed(1)} m, want ${cfg.length}`);
	const cps = layout.checkpoints.map((c) => c.s);
	cps.push(finishS);
	for (let i = 1; i < cps.length; i++) {
		const a = cps[i - 1];
		const b = cps[i];
		let longest = 0;
		for (const p of layout.pieces) if (p.s1 > a && p.s0 < b) longest = Math.max(longest, p.s1 - p.s0);
		const allowed = Math.max(RACE_TUNING.checkpointSpacing + 3 + longest / 2, longest + 16);
		if (b - a > allowed) errors.push(`${(b - a).toFixed(1)} m without a checkpoint at s=${a.toFixed(1)}`);
	}
	const step = .25;
	const lane = {
		min: 0,
		max: 0
	};
	const prevOff = [
		null,
		null,
		null
	];
	const lanes = [
		-1,
		0,
		1
	];
	for (let s = 0; s <= Math.min(layout.length, finishS + 10); s += step) {
		layout.laneAt(s, lane);
		if (lane.min > lane.max + 1e-6) errors.push(`empty AI lane at s=${s.toFixed(1)}`);
		const f = layout.spline.sampleAt(s);
		lanes.forEach((l, k) => {
			const off = layout.aiOffsetAt(s, l);
			if (f.floor && Math.abs(off) > f.width / 2 - .3) errors.push(`AI lane ${l} off the road at s=${s.toFixed(1)}`);
			if (prevOff[k] !== null && Math.abs(off - prevOff[k]) > step * 3.5) errors.push(`AI lane ${l} jumps at s=${s.toFixed(1)}`);
			prevOff[k] = off;
		});
		if (errors.length > 20) break;
	}
	const st = layout.strips;
	for (let i = 0; i < st.length; i += 2) {
		const a = st[i];
		for (let j = i + 1; j < st.length; j += 2) {
			const b = st[j];
			if (b.s0 - a.s1 < 30) continue;
			const dx = (a.a.x + a.b.x - b.a.x - b.b.x) / 2;
			const dz = (a.a.z + a.b.z - b.a.z - b.b.z) / 2;
			const dy = (a.a.y + a.b.y - b.a.y - b.b.y) / 2;
			const need = (Math.max(a.widthA, a.widthB) + Math.max(b.widthA, b.widthB)) / 2 + 3;
			if (Math.hypot(dx, dz) < need && Math.abs(dy) < 6) {
				errors.push(`track overlaps itself at s=${a.s0.toFixed(0)} / ${b.s0.toFixed(0)}`);
				return errors;
			}
		}
	}
	return errors;
}
//#endregion
//#region src/race/AiRacer.js
var MAX_LATERAL_SPEED = 3.5;
var STOP_AFTER_FINISH = 11;
var AiDriver = class {
	/**
	* @param {object} o
	* @param {object} o.track Track or TrackLayout
	* @param {{s:number, lateral:number}} o.slot start slot
	* @param {object} o.level difficulty entry (speedCap, aiSpeed, leadCap, behindCap)
	* @param {import('../core/Rng.js').Rng} o.rng this racer's own stream
	* @param {object} [o.tuning] RACE_TUNING overrides
	*/
	constructor({ track, slot, level, rng, tuning = {} }) {
		this.track = track;
		this.level = level;
		this.tuning = {
			...RACE_TUNING,
			...tuning
		};
		const t = this.tuning;
		this.skill = 1 + rng.range(-t.aiSkillSpread, t.aiSkillSpread);
		this.baseSpeed = level.speedCap * level.aiSpeed * this.skill;
		this.s = slot.s;
		this.speed = 0;
		this.lateral = slot.lateral;
		const r = track.laneAt(slot.s);
		const half = (r.max - r.min) / 2 || 1;
		this.lane = clamp((slot.lateral - (r.min + r.max) / 2) / half, -.8, .8);
		this.wobbleFreq = rng.range(.25, .55);
		this.wobblePhase = rng.range(0, Math.PI * 2);
		this.time = 0;
		this.finished = false;
		this.finishTime = null;
		this.finishS = track.finish ? track.finish.s : track.length;
	}
	/** Target speed for the current gap to the player (rubber-banding). */
	targetSpeed(playerS, playerRate, playerFinished = false) {
		const base = this.baseSpeed;
		const t = this.tuning;
		if (this.s > this.finishS) {
			const left = this.finishS + STOP_AFTER_FINISH - this.s;
			return Math.max(0, Math.min(base, left * 1.2));
		}
		if (playerFinished) return base;
		const gap = this.s - playerS;
		const { leadCap, behindCap } = this.level;
		if (gap > leadCap) {
			const k = smoothstep((gap - leadCap) / 2);
			const minFraction = this.level.aiMinFraction ?? t.aiMinFraction;
			const match = clamp(playerRate, base * minFraction, base);
			return lerp(base, match, k);
		}
		if (gap < -behindCap) {
			const k = smoothstep((-gap - behindCap) / 10);
			return base * lerp(1, t.aiCatchUp, k);
		}
		return base;
	}
	/**
	* Advance one fixed step.
	* @param {number} dt
	* @param {number} playerS player's distance along the track
	* @param {number} playerRate player's progress speed (m/s along the track)
	* @param {boolean} [playerFinished]
	* @returns {number} distance moved (m)
	*/
	step(dt, playerS, playerRate, playerFinished = false) {
		this.time += dt;
		const target = this.targetSpeed(playerS, playerRate, playerFinished);
		const a = this.tuning.aiAccel;
		this.speed += clamp(target - this.speed, -a * 1.5 * dt, a * dt);
		const ds = this.speed * dt;
		this.s = Math.min(this.s + ds, this.track.length - .5);
		if (!this.finished && this.s >= this.finishS) {
			this.finished = true;
			this.finishTime = this.time;
		}
		const wob = this.tuning.aiWobble * Math.sin(this.time * this.wobbleFreq * Math.PI * 2 + this.wobblePhase);
		const want = this.track.aiOffsetAt(this.s, clamp(this.lane + wob, -1, 1));
		const maxD = MAX_LATERAL_SPEED * dt;
		this.lateral += clamp(want - this.lateral, -maxD, maxD);
		return ds;
	}
	/** World position of the ball center. */
	position(out = {
		x: 0,
		y: 0,
		z: 0
	}) {
		const sp = this.track.spline;
		sp.positionAt(this.s, out);
		const r = sp.rightAt(this.s, this._r || (this._r = {
			x: 0,
			y: 0,
			z: 0
		}));
		out.x += r.x * this.lateral;
		out.z += r.z * this.lateral;
		out.y += BALL_RADIUS;
		return out;
	}
};
var AiRacer = class {
	/**
	* @param {object} o AiDriver options plus
	* @param {object} o.physics
	* @param {THREE.Object3D} o.scene
	* @param {string} o.skin skin id
	* @param {boolean} [o.solid=true] give it a kinematic body the player can bump
	*/
	constructor({ physics, scene, skin, solid = true, ...driverOpts }) {
		this.driver = new AiDriver(driverOpts);
		this.skin = skin;
		this.physics = physics;
		this.pos = new Vector3();
		this.prev = new Vector3();
		this.driver.position(this.pos);
		this.prev.copy(this.pos);
		this.body = null;
		if (solid && physics) this.body = physics.addKinematic({
			position: this.pos,
			shapes: [{
				type: "ball",
				radius: BALL_RADIUS
			}],
			friction: .3,
			restitution: .4,
			tag: "ai",
			data: this
		}).body;
		this.mesh = new Mesh(makeBallGeometry(BALL_RADIUS), makeSkinMaterial(skin));
		this.mesh.name = "ai-ball";
		this.mesh.position.copy(this.pos);
		this.shadow = new Mesh(new CircleGeometry(BALL_RADIUS * .95, 16).rotateX(-Math.PI / 2), new MeshBasicMaterial({
			color: 0,
			transparent: true,
			opacity: .28,
			depthWrite: false
		}));
		this.shadow.renderOrder = 1;
		scene.add(this.mesh, this.shadow);
		this._axis = new Vector3();
		this._q = new Quaternion();
		this._r = {
			x: 0,
			y: 0,
			z: 0
		};
		this._roll = 0;
	}
	get s() {
		return this.driver.s;
	}
	get finished() {
		return this.driver.finished;
	}
	/** One fixed step (before physics.step). */
	update(dt, playerS, playerRate, playerFinished) {
		this.prev.copy(this.pos);
		this._roll += this.driver.step(dt, playerS, playerRate, playerFinished);
		this.driver.position(this.pos);
		if (this.body) this.body.setNextKinematicTranslation(this.pos);
	}
	render(alpha) {
		this.mesh.position.lerpVectors(this.prev, this.pos, alpha);
		if (this._roll) {
			const r = this.driver.track.spline.rightAt(this.driver.s, this._r);
			this._axis.set(-r.x, 0, -r.z);
			this._q.setFromAxisAngle(this._axis, this._roll / BALL_RADIUS);
			this.mesh.quaternion.premultiply(this._q);
			this._roll = 0;
		}
		const f = this.driver.track.spline.sampleAt(this.driver.s, this._frame || (this._frame = {}));
		this.shadow.visible = f.floor;
		this.shadow.position.set(this.mesh.position.x, f.position.y + .03, this.mesh.position.z);
	}
	dispose() {
		this.mesh.removeFromParent();
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
		this.shadow.removeFromParent();
		this.shadow.geometry.dispose();
		this.shadow.material.dispose();
		if (this.body && !this.physics.disposed && this.physics.bodies.has(this.body)) this.physics.remove(this.body);
	}
};
//#endregion
//#region src/race/RaceSim.js
var LOOK_AHEAD = 3;
var AI_SKINS = [
	"blue",
	"yellow",
	"green",
	"red",
	"soccer",
	"stripes",
	"polka",
	"checker"
];
var RaceSim = class {
	/**
	* @param {object} o
	* @param {object} o.physics
	* @param {THREE.Object3D} o.scene
	* @param {number} o.difficulty 1..5
	* @param {string} o.seed this race's seed
	* @param {string} [o.skin='red'] player skin
	* @param {Ball} [o.ball] reuse an existing player ball (series)
	* @param {(name:string, data?:object) => void} [o.onEvent]
	* @param {object} [o.tuning] RACE_TUNING overrides
	*/
	constructor({ physics, scene, difficulty, seed, skin = "red", ball = null, onEvent = () => {}, tuning = {} }) {
		this.physics = physics;
		this.scene = scene;
		this.level = getDifficulty(difficulty);
		this.seed = String(seed);
		this.tuning = {
			...RACE_TUNING,
			...tuning
		};
		this.onEvent = onEvent;
		this.time = 0;
		this.started = false;
		this.finished = false;
		this.place = 0;
		this.falls = 0;
		this._events = [];
		this.gen = generateTrack({
			difficulty: this.level.level,
			seed: this.seed
		});
		this.track = buildTrack({
			physics,
			scene,
			pieces: this.gen.pieces,
			options: this.gen.options,
			handlers: {
				onCheckpoint: (cp) => this._events.push(["checkpoint", cp]),
				onFinish: () => this._events.push(["finishLine"]),
				onBoost: (zone, b) => {
					b.boost(8, zone.feature.forward);
					this._events.push(["boost", zone]);
				},
				onBumper: () => this._events.push(["bumper"]),
				onHazardHit: (info) => this._events.push(["hazard", info.type])
			}
		});
		const slot = this.track.startSlots[0];
		this.ownsBall = !ball;
		this.ball = ball || new Ball({
			physics,
			scene,
			position: slot.position,
			skin
		});
		this.ball.setTuning({
			speedCap: this.level.speedCap,
			autoRoll: this.level.autoRoll,
			cruise: this.level.cruise
		});
		this.s = slot.s;
		this.maxS = slot.s;
		this.rate = 0;
		this.checkpoint = this.track.checkpoints[0];
		this.fallsHere = 0;
		this.stuckS = slot.s;
		this.stuckT = 0;
		this.fallTimer = 0;
		this.forward = new Vector3(slot.forward.x, 0, slot.forward.z);
		this._ahead = new Vector3();
		this._pos = new Vector3();
		this.ball.respawn(slot.position, this.forward);
		const rng = new Rng(`ai:${this.seed}`);
		const skins = rng.shuffle(AI_SKINS.filter((id) => id !== skin && SKINS.some((s) => s.id === id)));
		this.racers = [];
		for (let i = 0; i < this.level.opponents; i++) this.racers.push(new AiRacer({
			physics,
			scene,
			skin: skins[i % skins.length],
			solid: this.level.level <= 2,
			track: this.track,
			slot: this.track.startSlots[1 + i],
			level: this.level,
			rng: rng.fork(`racer${i}`),
			tuning: this.tuning
		}));
		this.setFrozen(true);
	}
	/** Countdown: hold everything still. */
	setFrozen(frozen) {
		this.frozen = frozen;
		this.ball.setFrozen(frozen);
	}
	/** GO! */
	start() {
		this.started = true;
		this.setFrozen(false);
	}
	get length() {
		return this.track.finish ? this.track.finish.s : this.track.length;
	}
	/** Current place (1 = leading) by distance along the track. */
	currentPlace() {
		if (this.finished) return this.place;
		let p = 1;
		for (const r of this.racers) if (r.finished || r.s > this.s) p++;
		return p;
	}
	/**
	* One fixed step, before physics.step.
	* @param {number} dt
	* @param {{x:number,y:number}} move player input
	*/
	update(dt, move) {
		const t = this.track;
		t.update(dt);
		if (this.frozen) {
			this.ball.update(dt, null, this.forward);
			for (const r of this.racers) r.update(0, this.s, 0, false);
			return;
		}
		this.time += dt;
		const pos = this.ball.getPosition(this._pos);
		const near = t.nearest(pos, this.s);
		this.near = near;
		const prevS = this.s;
		if (near.dist < 12) this.s = near.s;
		if (!this.fallTimer) {
			const inst = Math.max(0, (this.s - prevS) / dt);
			this.rate += (Math.min(inst, 30) - this.rate) * Math.min(1, dt * 3);
		} else this.rate *= 1 - Math.min(1, dt * 3);
		this.maxS = Math.max(this.maxS, this.s);
		t.spline.forwardAt(Math.min(t.length, this.s + LOOK_AHEAD), this._ahead);
		this.forward.lerp(this._ahead, .1).normalize();
		this.ball.update(dt, this.finished ? null : move, this.forward);
		if (!this.fallTimer && this.ball.isGrounded() && Math.abs(near.height) < 1.5) {
			const cp = t.checkpointBefore(this.s);
			if (cp.s > this.checkpoint.s) this._reachCheckpoint(cp);
		}
		let stuck = false;
		if (this.level.autoRoll && !this.fallTimer) {
			this.stuckT += dt;
			if (this.s > this.stuckS + 1.5) {
				this.stuckS = this.s;
				this.stuckT = 0;
			}
			stuck = this.stuckT > this.tuning.stuckTime;
		}
		const falling = stuck || near.height < -this.tuning.fallDepth || near.dist > 14;
		if (!this.fallTimer && falling && !this.finished) {
			this.fallTimer = this.tuning.respawnDelay;
			this.fallStuck = stuck;
			this.falls++;
			this.fallsHere++;
			this.onEvent("fall");
		} else if (this.fallTimer && !this.fallStuck && this.ball.isGrounded() && near.height > -1 && near.dist < 8) {
			this.fallTimer = 0;
			this.falls--;
			this.fallsHere--;
			this.onEvent("recover");
		} else if (this.fallTimer) {
			this.fallTimer -= dt;
			if (this.fallTimer <= 0) this.respawn();
		}
		if (!this.finished && this.s >= this.length && Math.abs(near.height) < 2) this._finish();
		for (const r of this.racers) {
			const was = r.finished;
			r.update(dt, this.s, this.rate, this.finished);
			if (!was && r.finished) this.onEvent("aiFinish", { racer: r });
		}
	}
	/** After physics.step: handle sensor events queued during the step. */
	postStep() {
		const q = this._events;
		this._events = [];
		for (const [name, data] of q) if (name === "checkpoint") {
			if (!this.fallTimer && data.s > this.checkpoint.s) this._reachCheckpoint(data);
		} else if (name === "finishLine") {
			if (!this.finished && !this.frozen) this._finish();
		} else if (!this.finished || name === "bumper") this.onEvent(name, data);
	}
	_reachCheckpoint(cp) {
		this.checkpoint = cp;
		this.fallsHere = 0;
		this.onEvent("checkpoint", { checkpoint: cp });
	}
	_finish() {
		this.finished = true;
		this.finishTime = this.time;
		this.fallTimer = 0;
		let place = 1;
		for (const r of this.racers) if (r.finished) place++;
		this.place = place;
		this.ball.setTuning({ autoRoll: false });
		this.onEvent("finish", { place });
	}
	/**
	* Put the ball back at the last checkpoint. Mercy: after `mercyFalls`
	* falls in a row there, move on to the next checkpoint so a kid is never
	* stuck on one obstacle (plan pillar: always finish).
	*/
	respawn() {
		if (this.fallsHere >= this.tuning.mercyFalls) {
			const next = this.track.checkpoints.find((c) => c.s > this.checkpoint.s + 1 && c.s < this.length);
			if (next) {
				this.checkpoint = next;
				this.fallsHere = 0;
			}
		}
		const sp = this.track.respawnAt(this.checkpoint);
		this.fallTimer = 0;
		this.s = sp.s;
		this.stuckS = sp.s;
		this.stuckT = 0;
		this.forward.set(sp.forward.x, 0, sp.forward.z);
		this.ball.respawn(sp.position, this.forward);
		this.onEvent("respawn", {
			position: sp.position,
			forward: this.forward
		});
	}
	/** Debug: jump to the start of the next piece. */
	skipToNextPiece() {
		const p = this.track.pieceAt(this.s);
		const next = this.track.pieces[Math.min(this.track.pieces.length - 1, p.index + 1)];
		const f = this.track.spline.sampleAt(next.s0 + .5);
		this.s = this.stuckS = f.s;
		this.stuckT = 0;
		this.forward.set(f.forward.x, 0, f.forward.z);
		const pos = {
			x: f.position.x,
			y: f.position.y + .8,
			z: f.position.z
		};
		this.ball.respawn(pos, this.forward);
		this.onEvent("respawn", {
			position: pos,
			forward: this.forward
		});
	}
	render(alpha, frameDt) {
		this.track.render(alpha);
		this.ball.render(alpha, frameDt);
		for (const r of this.racers) r.render(alpha);
	}
	dispose() {
		for (const r of this.racers) r.dispose();
		this.racers = [];
		this.track.dispose();
		if (this.ownsBall) this.ball.dispose();
	}
};
//#endregion
//#region src/race/icons.js
var MEDAL_COLORS = {
	gold: "#ffc61a",
	silver: "#c9d3de",
	bronze: "#d98b4a",
	ribbon: "#ff5fa2"
};
var svg = (body, cls = "icon") => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
/** Medal on a ribbon with the place number (ribbon = rosette for 4th+). */
function medal(kind, place = null) {
	const c = MEDAL_COLORS[kind] || MEDAL_COLORS.ribbon;
	const label = place ? `<text x="50" y="72" text-anchor="middle" font-size="30" font-weight="900" fill="#1d1d2b" font-family="system-ui, sans-serif">${place}</text>` : "";
	if (kind === "ribbon") return svg(`
      <path d="M36 58 L24 96 L38 88 L44 99 L52 66 Z M64 58 L76 96 L62 88 L56 99 L48 66 Z" fill="#e8307e" stroke="#fff" stroke-width="3"/>
      <g fill="${c}" stroke="#fff" stroke-width="3">
        ${[
		0,
		45,
		90,
		135,
		180,
		225,
		270,
		315
	].map((a) => `<circle cx="${50 + 22 * Math.cos(a * Math.PI / 180)}" cy="${44 + 22 * Math.sin(a * Math.PI / 180)}" r="11"/>`).join("")}
      </g>
      <circle cx="50" cy="44" r="22" fill="${c}" stroke="#fff" stroke-width="4"/>
      ${place ? `<text x="50" y="55" text-anchor="middle" font-size="30" font-weight="900" fill="#fff" font-family="system-ui, sans-serif">${place}</text>` : ""}`);
	return svg(`
    <path d="M30 2 L44 40 L56 40 L42 2 Z" fill="#2e6be8"/>
    <path d="M70 2 L56 40 L44 40 L58 2 Z" fill="#e8302e"/>
    <circle cx="50" cy="62" r="34" fill="${c}" stroke="#fff" stroke-width="5"/>
    <circle cx="50" cy="62" r="25" fill="none" stroke="#fff" stroke-width="3" opacity="0.6"/>
    ${label}`);
}
/** Trophy cup in a medal color. */
function cup(kind) {
	const c = MEDAL_COLORS[kind] || MEDAL_COLORS.gold;
	if (kind === "ribbon") return medal("ribbon");
	return svg(`
    <path d="M26 20 H10 Q8 44 32 48 M74 20 H90 Q92 44 68 48" fill="none" stroke="${c}" stroke-width="7"/>
    <path d="M24 10 H76 V36 A26 26 0 0 1 24 36 Z" fill="${c}" stroke="#fff" stroke-width="4"/>
    <rect x="44" y="60" width="12" height="16" fill="${c}"/>
    <rect x="30" y="74" width="40" height="18" rx="4" fill="${c}" stroke="#fff" stroke-width="4"/>
    <path d="M34 18 Q34 40 46 50" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
    <path d="M50 22 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 z" fill="#fff" opacity="0.85"/>`);
}
/** Checkered finish flag (end of the progress bar). */
var flag = svg(`
  <rect x="14" y="8" width="7" height="88" rx="3" fill="#1d1d2b"/>
  <g transform="translate(21 10)">
    <rect width="66" height="44" fill="#fff" stroke="#1d1d2b" stroke-width="3"/>
    ${[
	0,
	1,
	2,
	3,
	4,
	5
].flatMap((i) => [
	0,
	1,
	2,
	3
].map((j) => (i + j) % 2 ? `<rect x="${i * 11}" y="${j * 11}" width="11" height="11" fill="#1d1d2b"/>` : "")).join("")}
  </g>`);
/** Big "next race" arrow. */
var next = svg(`<path d="M22 14 L80 50 L22 86 Z" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>`);
/** House (home). */
var home = svg(`
  <path d="M50 12 L90 48 H78 V88 H22 V48 H10 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
  <rect x="42" y="62" width="16" height="26" fill="#fff" opacity="0.85"/>`);
/** Checkpoint tick. */
var check = svg(`<path d="M18 52 L40 74 L84 26" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`);
//#endregion
//#region src/race/RaceHud.js
var SUFFIX = [
	"",
	"st",
	"nd",
	"rd",
	"th"
];
var CONFETTI_COLORS = [
	"#e8302e",
	"#ff8a1f",
	"#ffd21f",
	"#2fb84a",
	"#2e6be8",
	"#8a3ee8",
	"#ff5fa2",
	"#22d3ee"
];
function el$1(tag, cls, html) {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (html) e.innerHTML = html;
	return e;
}
var RaceHud = class {
	/**
	* @param {HTMLElement} root ctx.ui
	* @param {{races:number}} o
	*/
	constructor(root, { races }) {
		this.root = root;
		this.races = races;
		this.progress = el$1("div", "race-progress");
		this.bar = el$1("div", "race-progress__track");
		this.fill = el$1("div", "race-progress__fill");
		this.bar.appendChild(this.fill);
		this.progress.append(this.bar, el$1("div", "race-progress__flag", flag));
		this.series = el$1("div", "race-series");
		this.place = el$1("div", "race-place");
		this.fade = el$1("div", "race-fade");
		this.fx = el$1("div", "race-fx");
		root.append(this.fade, this.progress, this.series, this.place, this.fx);
		this.dots = [];
		this.lastPlace = 0;
		this.timers = /* @__PURE__ */ new Set();
	}
	/** New race: racer dots (player first) and series pips. */
	setupRace({ playerSkin, aiSkins, raceIndex, medals }) {
		for (const d of this.dots) d.remove();
		this.dots = [];
		aiSkins.forEach((id) => {
			const d = el$1("div", "race-dot");
			d.style.background = getSkin(id).colors[0];
			this.bar.appendChild(d);
			this.dots.push(d);
		});
		const me = el$1("div", "race-dot race-dot--player");
		try {
			me.appendChild(drawSkinIcon(playerSkin, 64));
		} catch {
			me.style.background = getSkin(playerSkin).colors[0];
		}
		this.bar.appendChild(me);
		this.dots.unshift(me);
		this.series.innerHTML = "";
		this.series.hidden = this.races <= 1;
		for (let i = 0; i < this.races; i++) {
			const pip = el$1("i");
			if (medals[i]) pip.style.background = MEDAL_COLORS[medals[i]];
			if (i === raceIndex) pip.className = "current";
			this.series.appendChild(pip);
		}
		this.lastPlace = 0;
		this.setPlace(1);
		this.setProgress(0, []);
		this.clearFx();
		this.setVisible(true);
	}
	setVisible(on) {
		for (const e of [
			this.progress,
			this.series,
			this.place
		]) e.style.visibility = on ? "" : "hidden";
	}
	/** @param {number} player 0..1 @param {number[]} ai 0..1 each */
	setProgress(player, ai) {
		const pct = (f) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(1)}%`;
		this.fill.style.width = pct(player);
		if (this.dots[0]) this.dots[0].style.left = pct(player);
		for (let i = 0; i < ai.length; i++) if (this.dots[i + 1]) this.dots[i + 1].style.left = pct(ai[i]);
	}
	setPlace(place) {
		if (place === this.lastPlace) return;
		this.lastPlace = place;
		const medal = medalForPlace(place);
		this.place.style.background = MEDAL_COLORS[medal];
		this.place.innerHTML = `${place}<sup>${SUFFIX[Math.min(4, place)]}</sup>`;
		this.place.setAttribute("aria-label", `Place ${place}`);
		this.place.classList.remove("bump");
		this.place.offsetWidth;
		this.place.classList.add("bump");
	}
	_transient(node, ms) {
		this.fx.appendChild(node);
		const t = setTimeout(() => {
			node.remove();
			this.timers.delete(t);
		}, ms);
		this.timers.add(t);
		return node;
	}
	clearFx() {
		for (const t of this.timers) clearTimeout(t);
		this.timers.clear();
		this.fx.innerHTML = "";
		this.fade.style.opacity = "0";
	}
	/** '3' | '2' | '1' | 'GO!' */
	countdown(text) {
		const b = el$1("div", `race-banner${text === "GO!" ? " race-banner--go" : ""}`);
		b.appendChild(el$1("span", "", text));
		this._transient(b, 1100);
	}
	checkpoint() {
		this._transient(el$1("div", "race-check", check), 1e3);
	}
	boost() {
		this._transient(el$1("div", "race-boost"), 900);
	}
	/** 0..1 white fade (falling / respawn). */
	setFade(v) {
		this.fade.style.opacity = String(Math.max(0, Math.min(1, v)));
	}
	finish() {
		const b = el$1("div", "race-banner race-banner--finish");
		b.appendChild(el$1("span", "", "FINISH"));
		this._transient(b, 2600);
		this.confetti();
	}
	/** DOM confetti burst (deterministic look, no Math.random needed). */
	confetti(n = 70, parent = this.fx) {
		const box = el$1("div", "race-confetti");
		for (let i = 0; i < n; i++) {
			const c = el$1("i");
			const h = (i * 2654435761 >>> 0) / 4294967296;
			const h2 = (i * 40503 + 17) % 97 / 97;
			c.style.left = `${(h * 100).toFixed(1)}%`;
			c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
			c.style.animationDuration = `${(1.8 + h2 * 1.6).toFixed(2)}s`;
			c.style.animationDelay = `${(h2 * .6).toFixed(2)}s`;
			c.style.setProperty("--dx", `${((h2 - .5) * 30).toFixed(1)}vw`);
			c.style.setProperty("--rot", `${Math.round((h - .5) * 1440)}deg`);
			box.appendChild(c);
		}
		parent.appendChild(box);
		const t = setTimeout(() => {
			box.remove();
			this.timers.delete(t);
		}, 4e3);
		this.timers.add(t);
	}
	dispose() {
		this.clearFx();
		for (const e of [
			this.progress,
			this.series,
			this.place,
			this.fade,
			this.fx
		]) e.remove();
	}
};
//#endregion
//#region src/race/Scenery.js
/**
* @param {THREE.Object3D} scene
* @param {{strips: Array<{a:{x,y,z}}>}} track
* @param {string} seed
* @returns {{mesh: THREE.InstancedMesh, dispose: () => void}}
*/
function buildScenery(scene, track, seed) {
	const rng = new Rng(`scenery:${seed}`);
	const pts = track.strips.map((st) => st.a);
	let minY = Infinity;
	for (const p of pts) minY = Math.min(minY, p.y);
	const boxes = [];
	const clouds = Math.min(60, 18 + Math.round(pts.length / 2));
	let made = 0;
	for (let i = 0; i < clouds * 4 && made < clouds && boxes.length < 355; i++) {
		const anchor = rng.pick(pts);
		const a = rng.range(0, Math.PI * 2);
		const below = rng.chance(.6);
		const r = below ? rng.range(4, 45) : rng.range(45, 110);
		const x = anchor.x + Math.cos(a) * r;
		const z = anchor.z + Math.sin(a) * r;
		const y = below ? minY - rng.range(22, 34) : anchor.y + rng.range(-16, 6);
		if (!below && tooClose(pts, x, z, 30)) continue;
		cloud(boxes, rng, x, y, z, below ? rng.range(1.3, 2.4) : rng.range(1.2, 2.2));
		made++;
	}
	const geo = new BoxGeometry(1, 1, 1);
	const mat = new MeshLambertMaterial({
		color: 16777215,
		emissive: 9415108,
		flatShading: true
	});
	const mesh = new InstancedMesh(geo, mat, boxes.length);
	mesh.name = "scenery";
	const m = new Matrix4();
	const q = new Quaternion();
	boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(b.p, q, b.s)));
	mesh.instanceMatrix.needsUpdate = true;
	mesh.computeBoundingSphere();
	scene.add(mesh);
	return {
		mesh,
		dispose() {
			mesh.removeFromParent();
			geo.dispose();
			mat.dispose();
			mesh.dispose();
		}
	};
}
function tooClose(pts, x, z, dist) {
	const d2 = dist * dist;
	for (const p of pts) if ((p.x - x) ** 2 + (p.z - z) ** 2 < d2) return true;
	return false;
}
/** A flat, lumpy cloud: a wide base slab plus a few puffs on top. */
function cloud(boxes, rng, x, y, z, scale) {
	const w = 6 * scale;
	const d = 4 * scale;
	boxes.push({
		p: new Vector3(x, y, z),
		s: new Vector3(w, 1.2 * scale, d)
	});
	const puffs = rng.int(2, 4);
	for (let i = 0; i < puffs; i++) {
		const s = rng.range(1.6, 2.8) * scale;
		boxes.push({
			p: new Vector3(x + rng.range(-w / 3, w / 3), y + .3 * scale + s / 2, z + rng.range(-d / 4, d / 4)),
			s: new Vector3(s, s, s)
		});
	}
}
//#endregion
//#region src/race/Results.js
function el(tag, cls, html) {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (html) e.innerHTML = html;
	return e;
}
function ballPicture(skin, size) {
	try {
		return drawSkinIcon(skin, size);
	} catch {
		const c = el("canvas");
		c.style.background = getSkin(skin).colors[0];
		return c;
	}
}
/** Medal row for a series: earned medals, then empty slots. */
function medalRow(medals, races) {
	const row = el("div", "race-medals");
	for (let i = 0; i < races; i++) if (medals[i]) {
		const icon = el("span", "", medal(medals[i])).firstElementChild;
		icon.style.animationDelay = `${.15 * i}s`;
		row.appendChild(icon);
	} else row.appendChild(el("span", "todo"));
	return row;
}
/**
* A panel that continues on a button tap (or a tap anywhere) after a delay.
* @returns {{el:HTMLElement, dispose:() => void}}
*/
function panel(root, { children, button, color, label, tapDelay, audio, onContinue }) {
	const p = el("div", "race-panel");
	p.setAttribute("data-ui", "");
	p.append(...children);
	const btn = el("button", `rb-btn rb-btn--round rb-btn--${color} race-panel__btn`, button);
	btn.type = "button";
	btn.setAttribute("aria-label", label);
	btn.disabled = true;
	p.appendChild(btn);
	root.appendChild(p);
	let done = false;
	let ready = false;
	const go = (e) => {
		e?.preventDefault?.();
		e?.stopPropagation?.();
		if (!ready || done) return;
		done = true;
		audio?.play("click");
		onContinue();
	};
	const timer = setTimeout(() => {
		ready = true;
		btn.disabled = false;
		btn.classList.add("rb-pop");
	}, tapDelay * 1e3);
	btn.addEventListener("click", go);
	let armed = false;
	p.addEventListener("pointerdown", () => armed = ready);
	p.addEventListener("pointerup", (e) => {
		if (armed) go(e);
		armed = false;
	});
	return {
		el: p,
		dispose() {
			clearTimeout(timer);
			p.remove();
		}
	};
}
/**
* @param {HTMLElement} root
* @param {object} o
* @param {number} o.place 1..4
* @param {Array<{skin:string, me:boolean}>} o.order finishing order (all racers)
* @param {string[]} o.medals series medals so far (including this race)
* @param {number} o.races series length
* @param {boolean} o.isLast last race of the series
*/
function showRaceResult(root, { place, order, medals, races, isLast, tapDelay = 1.2, audio, onNext }) {
	const big = el("div", "race-panel__medal", medal(medalForPlace(place), place));
	big.setAttribute("aria-label", `Place ${place}`);
	const podium = el("div", "race-panel__row race-podium");
	const heights = [
		92,
		70,
		54,
		40
	];
	order.forEach((r, i) => {
		const slot = el("div", `race-podium__slot${r.me ? " me" : ""}`);
		slot.appendChild(ballPicture(r.skin, 96));
		const step = el("div", "race-podium__step", String(i + 1));
		step.style.height = `${heights[Math.min(3, i)]}px`;
		step.style.background = MEDAL_COLORS[medalForPlace(i + 1)];
		slot.appendChild(step);
		podium.appendChild(slot);
	});
	const children = [big, podium];
	if (races > 1) children.push(medalRow(medals, races));
	return panel(root, {
		children,
		button: isLast ? cup("gold") : next,
		color: "green",
		label: isLast ? "See my trophy" : "Next race",
		tapDelay,
		audio,
		onContinue: onNext
	});
}
/**
* @param {HTMLElement} root
* @param {{medals:string[], cup:string, seed?:string}} o
*/
function showTrophy(root, { medals, cup: cup$1, seed = null, tapDelay = 1.2, audio, onDone }) {
	const big = el("div", "race-panel__cup", cup(cup$1));
	big.setAttribute("aria-label", `${cup$1} cup`);
	const children = [big, medalRow(medals, medals.length)];
	if (seed) {
		const code = el("div", "race-seed");
		code.textContent = seed;
		code.setAttribute("aria-label", "Race code");
		children.push(code);
	}
	return panel(root, {
		children,
		button: home,
		color: "blue",
		label: "Home",
		tapDelay,
		audio,
		onContinue: onDone
	});
}
//#endregion
//#region src/race/RaceMode.js
var COUNTDOWN = [
	{
		t: .5,
		text: "3"
	},
	{
		t: 1.5,
		text: "2"
	},
	{
		t: 2.5,
		text: "1"
	},
	{
		t: 3.5,
		text: "GO!"
	}
];
var RaceMode = class {
	async start(ctx, config) {
		this.ctx = ctx;
		this.config = config;
		this.level = getDifficulty(config.difficulty);
		this.races = config.races;
		this.skin = ctx.save.get().skins?.selected || "red";
		this.medals = [];
		this.places = [];
		this.panel = null;
		this.fade = 0;
		this._frame = 0;
		this._aiFrac = [];
		this.ball = new Ball({
			physics: ctx.physics,
			scene: ctx.scene,
			position: {
				x: 0,
				y: 1,
				z: 0
			},
			skin: this.skin
		});
		this.ball.onLand = (impact) => {
			if (this.state === "racing") ctx.audio.play("thump", {
				volume: Math.min(.6, impact / 18),
				pitch: 1.6
			});
		};
		this.cam = new ChaseCamera(ctx.camera, { mode: "track" });
		this.hud = new RaceHud(ctx.ui, { races: this.races });
		const first = Math.min(this.races, Math.max(1, Math.round(Number(config.startRace)) || 1)) - 1;
		this._startRace(first);
		const d = ctx.debug;
		d.watch("race", () => `${this.index + 1}/${this.races} d${this.level.level}`);
		d.watch("seed", () => this.seed);
		d.watch("piece", () => this.sim && `${this.sim.track.pieceAt(this.sim.s).id}`);
		d.watch("s", () => this.sim && `${this.sim.s.toFixed(0)}/${this.sim.length.toFixed(0)}`);
		d.watch("place", () => this.sim?.currentPlace());
		d.watch("speed", () => this.ball.groundSpeed);
		d.watch("ai", () => this.sim?.racers.map((r) => r.s.toFixed(0)).join(" "));
		d.watch("falls", () => this.sim?.falls);
	}
	_startRace(index, seedOverride = null) {
		const { ctx } = this;
		this._closePanel();
		this.sim?.dispose();
		this.scenery?.dispose();
		this.index = index;
		this.seed = seedOverride || raceSeed(this.config.seed, index);
		this.sim = new RaceSim({
			physics: ctx.physics,
			scene: ctx.scene,
			difficulty: this.level.level,
			seed: this.seed,
			skin: this.skin,
			ball: this.ball,
			onEvent: (name, data) => this._onSimEvent(name, data)
		});
		this.scenery = buildScenery(ctx.scene, this.sim.track, this.seed);
		this.state = "countdown";
		this.stateT = 0;
		this.countStep = 0;
		this.fade = 0;
		this.cam.snap(this.ball.getPosition(), this.sim.forward);
		this.hud.setupRace({
			playerSkin: this.skin,
			aiSkins: this.sim.racers.map((r) => r.skin),
			raceIndex: index,
			medals: this.medals
		});
	}
	_onSimEvent(name, data) {
		const { audio } = this.ctx;
		switch (name) {
			case "checkpoint":
				this.hud.checkpoint();
				audio.play("beep", {
					pitch: 1.5,
					volume: .7
				});
				break;
			case "boost":
				this.hud.boost();
				audio.play("whoosh");
				break;
			case "bumper":
				audio.play("boing", {
					volume: .5,
					pitch: 1.3
				});
				break;
			case "hazard":
				audio.play("thump");
				break;
			case "respawn":
				this.cam.snap(data.position, data.forward);
				audio.play("boing");
				break;
			case "finish": this._onFinish(data.place);
		}
	}
	_onFinish(place) {
		const medal = medalForPlace(place);
		this.places[this.index] = place;
		this.medals[this.index] = medal;
		this.state = "finished";
		this.stateT = 0;
		this.hud.setPlace(place);
		this.hud.finish();
		this.ctx.audio.play("confetti");
		this.ctx.events.emit("raceFinished", {
			difficulty: this.level.level,
			raceIndex: this.index,
			races: this.races,
			place,
			medal
		});
	}
	/** Finishing order for the podium: [{skin, me}] with the player at its place. */
	_finishOrder() {
		const ais = this.sim.racers.slice().sort((a, b) => {
			if (a.finished !== b.finished) return a.finished ? -1 : 1;
			if (a.finished) return a.driver.finishTime - b.driver.finishTime;
			return b.s - a.s;
		}).map((r) => ({
			skin: r.skin,
			me: false
		}));
		ais.splice(this.sim.place - 1, 0, {
			skin: this.skin,
			me: true
		});
		return ais;
	}
	_showResults() {
		const { ctx } = this;
		this.state = "results";
		this.hud.setVisible(false);
		const place = this.sim.place;
		ctx.audio.play("fanfare", { pitch: place === 1 ? 1 : place === 2 ? .94 : .88 });
		const isLast = this.index >= this.races - 1;
		this.panel = showRaceResult(ctx.ui, {
			place,
			order: this._finishOrder(),
			medals: this.medals,
			races: this.races,
			isLast,
			tapDelay: RACE_TUNING.tapDelay,
			audio: ctx.audio,
			onNext: () => isLast ? this._showTrophy() : this._startRace(this.index + 1)
		});
		if (place === 1) this.hud.confetti(50, this.panel.el);
	}
	_showTrophy() {
		const { ctx } = this;
		this._closePanel();
		this.state = "trophy";
		const medals = this.medals.filter(Boolean);
		const cup = cupForPlaces(this.places.filter(Boolean));
		ctx.events.emit("seriesComplete", {
			difficulty: this.level.level,
			races: this.races,
			medals,
			cup
		});
		ctx.audio.play("fanfare");
		ctx.audio.play("confetti");
		this.panel = showTrophy(ctx.ui, {
			medals,
			cup,
			seed: this.config.seed,
			tapDelay: RACE_TUNING.tapDelay,
			audio: ctx.audio,
			onDone: () => this._goHome()
		});
		this.hud.confetti(90, this.panel.el);
	}
	_goHome() {
		const { router, onExit } = this.ctx;
		if (router?.has?.("home")) router.go("home");
		else onExit();
	}
	_closePanel() {
		this.panel?.dispose();
		this.panel = null;
	}
	update(dt) {
		this.stateT += dt;
		if (this.state === "countdown") {
			const step = COUNTDOWN[this.countStep];
			if (step && this.stateT >= step.t) {
				this.countStep++;
				this.hud.countdown(step.text);
				if (step.text === "GO!") {
					this.ctx.audio.play("go");
					this.sim.start();
					this.state = "racing";
				} else this.ctx.audio.play("beep");
			}
		} else if (this.state === "finished" && this.stateT >= RACE_TUNING.finishBannerTime) this._showResults();
		const move = this.state === "racing" ? this.ctx.input.getMove() : null;
		this.sim.update(dt, move);
	}
	postStep(dt) {
		this.sim.postStep(dt);
	}
	render(alpha, frameDt) {
		const dt = Math.min(frameDt || 0, .1);
		const look = this.ctx.input.consumeLook();
		if (look.dx || look.dy) this.cam.addLook(look.dx, look.dy);
		const sim = this.sim;
		sim.render(alpha, frameDt);
		this.cam.setForward(sim.forward);
		this.cam.update(dt, {
			position: this.ball.position,
			velocity: this.ball.velocity
		});
		const target = sim.fallTimer > 0 ? .85 * (1 - sim.fallTimer / RACE_TUNING.respawnDelay) : 0;
		this.fade += (target - this.fade) * Math.min(1, dt * (target > this.fade ? 10 : 4));
		this.hud.setFade(this.fade < .01 ? 0 : this.fade);
		if (this._frame++ % 2 === 0 && this.state !== "results" && this.state !== "trophy") {
			const len = sim.length;
			const ai = this._aiFrac;
			ai.length = sim.racers.length;
			for (let i = 0; i < ai.length; i++) ai[i] = sim.racers[i].s / len;
			this.hud.setProgress(sim.finished ? 1 : sim.s / len, ai);
			if (this.state === "racing") this.hud.setPlace(sim.currentPlace());
		}
	}
	respawn() {
		if (this.state === "racing" && !this.sim.finished) this.sim.respawn();
	}
	nextPiece() {
		if (this.state === "racing" && !this.sim.finished) this.sim.skipToNextPiece();
	}
	regenerate() {
		this.config = {
			...this.config,
			seed: randomEmojiSeed()
		};
		this._startRace(this.index);
	}
	dispose() {
		this._closePanel();
		this.hud?.dispose();
		this.sim?.dispose();
		this.sim = null;
		this.scenery?.dispose();
		this.ball?.dispose();
	}
};
//#endregion
export { RaceMode as default };
