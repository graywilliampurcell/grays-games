import { t as PIECES } from "./Catalog-CUbTmyD8.js";
import { i as nearestStrip, r as forwardOf } from "./pathBuilder-BnVEtb7h.js";
//#region src/debug/testHookUtils.js
var TEST_DT = 1 / 60;
var DEADZONE = .12;
var r3 = (v) => Math.round(v * 1e3) / 1e3;
/** {x, y, z} rounded to mm (stable, compact JSON). */
function vec(v) {
	return v ? {
		x: r3(v.x),
		y: r3(v.y),
		z: r3(v.z)
	} : null;
}
function round(v, k = 1e3) {
	return typeof v === "number" && Number.isFinite(v) ? Math.round(v * k) / k : v;
}
/**
* Bot input → the move vector Input.update() would produce.
* Accepts {x, y, jump}; x/y clamped to the unit disc, NaN → 0.
* `active` mirrors Input.isActive() (above the stick deadzone).
*/
function normalizeTestInput(input) {
	const x = Number(input?.x) || 0;
	const y = Number(input?.y) || 0;
	const len = Math.hypot(x, y);
	const k = len > 1 ? 1 / len : 1;
	return {
		x: x * k,
		y: y * k,
		jump: !!input?.jump,
		active: len * k > DEADZONE
	};
}
/**
* Walk a polyline of center-line points [{x,y,z,width?}] with cumulative
* arc lengths `sArr` and return `count` samples every `spacing` m from s0.
* Used for the "path ahead" in state() so a bot can steer along the track.
*/
function samplePolyline(points, sArr, s0, count = 12, spacing = 2) {
	const out = [];
	if (!points || points.length < 2) return out;
	const total = sArr[sArr.length - 1];
	let i = 0;
	for (let k = 0; k < count; k++) {
		const s = Math.min(total, Math.max(0, s0 + k * spacing));
		while (i < sArr.length - 2 && sArr[i + 1] < s) i++;
		const a = points[i];
		const b = points[i + 1];
		const len = sArr[i + 1] - sArr[i];
		const t = len > 1e-9 ? Math.min(1, Math.max(0, (s - sArr[i]) / len)) : 0;
		const p = {
			s: r3(s),
			x: r3(a.x + (b.x - a.x) * t),
			y: r3(a.y + (b.y - a.y) * t),
			z: r3(a.z + (b.z - a.z) * t)
		};
		if (a.width !== void 0) p.width = r3(a.width);
		out.push(p);
		if (s >= total) break;
	}
	return out;
}
/** Cumulative 3D arc length of a point list. */
function arcLengths(points) {
	const s = new Array(points.length).fill(0);
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		s[i] = s[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
	}
	return s;
}
/** Make any value JSON-safe (drops functions / THREE objects → plain numbers). */
function plain(value) {
	if (value === null || value === void 0) return value ?? null;
	if (typeof value === "number") return round(value);
	if (typeof value !== "object") return typeof value === "function" ? void 0 : value;
	if (Array.isArray(value)) return value.map(plain);
	if ("x" in value && "y" in value && "z" in value && typeof value.x === "number") return vec(value);
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		const p = plain(v);
		if (p !== void 0) out[k] = p;
	}
	return out;
}
/** Event log with a simulated clock. */
var EventLog = class {
	constructor(now = () => 0) {
		this.now = now;
		this.list = [];
	}
	push(type, details = {}) {
		const e = {
			t: round(this.now(), 1e4),
			type,
			...plain(details)
		};
		this.list.push(e);
		return e;
	}
	clear() {
		this.list.length = 0;
	}
};
//#endregion
//#region src/debug/testHooks.js
function installTestHooks(app) {
	const { game, input, router, events: bus, debug } = app;
	let simTime = 0;
	let realtime = false;
	let testInput = null;
	const log = new EventLog(() => simTime);
	const ttCache = /* @__PURE__ */ new WeakMap();
	if (!debug.enabled) {
		debug.set = (k, v) => debug.fields.set(k, v);
		debug.watch = (k, fn) => debug.fields.set(k, fn);
		window.addEventListener("keydown", (e) => {
			if (e.repeat) return;
			const k = e.key.toLowerCase();
			if (k === "r") debugAction("respawn");
			else if (k === "n") debugAction("nextPiece");
			else if (k === "g") debugAction("regenerate");
		});
	}
	const origInputUpdate = input.update.bind(input);
	input.update = () => {
		origInputUpdate();
		if (testInput && input.enabled) {
			input.move = {
				x: testInput.x,
				y: testInput.y
			};
			input.source = testInput.active ? "test" : "none";
		}
		return input.move;
	};
	const loop = game.loop;
	const origTick = loop.tick.bind(loop);
	loop.tick = (frameDt) => {
		if (realtime) return origTick(frameDt);
		draw(0);
		return 0;
	};
	function draw(frameDt = 0) {
		if (!game.mode || !game.scene || game.contextLost) return;
		game.renderer.render(game.scene, game.camera);
		debug.frame(frameDt, game.renderer);
	}
	const origUpdate = game._update.bind(game);
	game._update = (dt) => {
		const active = game.mode && !game.paused;
		origUpdate(dt);
		if (active) simTime += dt;
		poll();
	};
	let watched = { mode: null };
	const origRun = game.runMode.bind(game);
	game.runMode = async (name, config, opts) => {
		const mode = await origRun(name, config, opts);
		attach(mode, name);
		log.push("start", {
			mode: name,
			seed: mode?.config?.seed ?? game.ctx?.config?.seed ?? null
		});
		return mode;
	};
	const origGo = router.go.bind(router);
	router.go = (name, params) => {
		const p = origGo(name, params);
		p.then(() => log.push("screen", { name: router.current?.name ?? name }));
		return p;
	};
	bus.on("starCollected", (p) => log.push("star", p));
	bus.on("raceFinished", (p) => log.push("raceFinished", p));
	bus.on("seriesComplete", (p) => log.push("seriesComplete", p));
	function attach(mode, name) {
		watched = {
			mode,
			name
		};
		if (!mode) return;
		if (name === "race" && mode._onSimEvent) {
			const orig = mode._onSimEvent.bind(mode);
			mode._onSimEvent = (ev, data) => {
				const d = {};
				if (ev === "checkpoint") Object.assign(d, {
					index: data.checkpoint.index,
					s: data.checkpoint.s
				});
				else if (ev === "respawn") d.pos = data.position;
				else if (ev === "finish") d.place = data.place;
				else if (ev === "hazard") d.hazard = data;
				else if (ev === "aiFinish") d.racer = mode.sim?.racers.indexOf(data.racer);
				log.push(ev, d);
				if (ev === "fall") log.push("fail", { reason: mode.sim?.fallStuck ? "stuck" : "fall" });
				if (ev === "finish") log.push("win", { place: data.place });
				orig(ev, data);
			};
		}
		if ((name === "test-track" || name === "playground" || name === "gallery") && mode.respawn) {
			const orig = mode.respawn.bind(mode);
			mode.respawn = (...args) => {
				const r = orig(...args);
				log.push("respawn", { pos: mode.ball?.getPosition() });
				return r;
			};
		}
	}
	function poll() {
		const mode = game.mode;
		if (!mode || mode !== watched.mode) return;
		const w = watched;
		if (w.name === "test-track") {
			const falling = mode.falling > 0;
			const finished = mode.finished > 0;
			if (falling && !w.falling) {
				log.push("fall");
				log.push("fail", { reason: "fall" });
			}
			if (w.checkpoint !== void 0 && mode.checkpoint > w.checkpoint) log.push("checkpoint", { index: mode.checkpoint });
			if (finished && !w.finished) {
				log.push("finish");
				log.push("win");
			}
			Object.assign(w, {
				falling,
				finished,
				checkpoint: mode.checkpoint
			});
		} else if (w.name === "race") {
			if (mode.index !== w.index) log.push("raceStart", {
				raceIndex: mode.index,
				raceSeed: mode.seed
			});
			if (mode.state !== w.state) {
				log.push("raceState", { state: mode.state });
				if (mode.state === "racing") log.push("message", { text: "GO!" });
			}
			Object.assign(w, {
				index: mode.index,
				state: mode.state
			});
		} else if (w.name === "playground") {
			const out = mode.fade?.phase === "out";
			if (out && !w.out) {
				log.push("fall");
				log.push("fail", { reason: "fall-or-stuck" });
			}
			const stars = mode.world?.stars;
			if (stars && stars.stars.length > 0 && stars.remaining === 0 && w.remaining > 0) log.push("win", { stars: stars.stars.length });
			Object.assign(w, {
				out,
				remaining: stars?.remaining
			});
		} else if (w.name === "gallery") {
			const falling = mode.falling > 0;
			if (falling && !w.falling) {
				log.push("fall");
				log.push("fail", { reason: "fall" });
			}
			w.falling = falling;
		}
	}
	function testTrackLine(mode) {
		let c = ttCache.get(mode);
		if (!c) {
			const pts = mode.strips.map((st) => ({
				x: st.a.x,
				y: st.a.y,
				z: st.a.z,
				width: st.width,
				gap: !!st.gap
			}));
			const last = mode.strips[mode.strips.length - 1];
			pts.push({
				x: last.b.x,
				y: last.b.y,
				z: last.b.z,
				width: last.width,
				gap: false
			});
			const s = arcLengths(pts);
			const gaps = [];
			mode.strips.forEach((st, i) => {
				if (!st.gap) return;
				const g = gaps[gaps.length - 1];
				if (g && Math.abs(g.s1 - s[i]) < 1e-6) g.s1 = s[i + 1];
				else gaps.push({
					s0: s[i],
					s1: s[i + 1]
				});
			});
			const lastSeg = mode.segmentStarts[mode.segmentStarts.length - 1];
			c = {
				pts,
				s,
				gaps,
				finishS: s[Math.min(s.length - 1, lastSeg + 5)],
				checkpoints: mode.strips.map((st, i) => st.checkpoint ? {
					index: i,
					s: s[i],
					...vec(st.a)
				} : null).filter(Boolean)
			};
			ttCache.set(mode, c);
		}
		return c;
	}
	function testTrackState(mode, pos) {
		const c = testTrackLine(mode);
		const near = nearestStrip(mode.strips, pos, mode.progress);
		const i = near.index;
		const sNow = c.s[i] + (c.s[i + 1] - c.s[i]) * near.t;
		const st = mode.strips[i];
		const right = {
			x: Math.cos(st.yaw),
			z: -Math.sin(st.yaw)
		};
		const center = {
			x: st.a.x + (st.b.x - st.a.x) * near.t,
			y: st.a.y + (st.b.y - st.a.y) * near.t,
			z: st.a.z + (st.b.z - st.a.z) * near.t
		};
		return {
			s: round(sNow),
			length: round(c.s[c.s.length - 1]),
			finishS: round(c.finishS),
			progress: round(Math.min(1, sNow / c.finishS)),
			strip: i,
			piece: st.kind,
			segment: st.segment,
			halfWidth: st.width / 2,
			lateral: round((pos.x - center.x) * right.x + (pos.z - center.z) * right.z),
			height: round(pos.y - center.y),
			forward: vec(mode.forward),
			checkpoint: mode.checkpoint,
			checkpoints: c.checkpoints,
			gaps: c.gaps.map((g) => ({
				s0: round(g.s0),
				s1: round(g.s1)
			})),
			ahead: samplePolyline(c.pts, c.s, sNow, 12, 2),
			finished: mode.finished > 0,
			feel: mode.ball?.tuning ? {
				speedCap: mode.ball.tuning.speedCap,
				autoRoll: !!mode.ball.tuning.autoRoll
			} : null
		};
	}
	function trackState(track, s) {
		const sp = track.spline;
		return {
			s: round(s),
			length: round(track.finish ? track.finish.s : track.length),
			halfWidth: round(sp.widthAt(s) / 2),
			checkpoints: track.checkpoints.map((c) => ({
				index: c.index,
				s: round(c.s),
				...vec(c.position)
			})),
			gaps: track.gapZones.map((g) => ({
				s0: round(g.s0),
				s1: round(g.s1),
				bridged: g.bridged
			})),
			hazards: track.hazardZones.map((h) => ({
				s0: round(h.s0),
				s1: round(h.s1),
				type: h.type
			})),
			boosts: track.boostZones.map((b) => ({
				s0: round(b.s0),
				s1: round(b.s1)
			})),
			ahead: samplePolyline(sp.points, sp.s, s, 12, 2)
		};
	}
	function raceState(mode) {
		const sim = mode.sim;
		if (!sim) return null;
		const t = trackState(sim.track, sim.s);
		return {
			...t,
			state: mode.state,
			raceIndex: mode.index,
			races: mode.races,
			difficulty: mode.level?.level,
			raceSeed: mode.seed,
			progress: round(Math.min(1, sim.s / t.length)),
			maxS: round(sim.maxS),
			place: sim.currentPlace(),
			finished: sim.finished,
			falls: sim.falls,
			checkpoint: sim.checkpoint?.index,
			lateral: round(sim.near?.lateral),
			height: round(sim.near?.height),
			forward: vec(sim.forward),
			ais: sim.racers.map((r) => ({
				s: round(r.s),
				finished: !!r.finished
			}))
		};
	}
	function playgroundState(mode) {
		const w = mode.world;
		if (!w) return null;
		const d = w.data;
		return {
			size: d.n,
			minH: d.minH,
			maxH: d.maxH,
			spawn: vec(d.spawn),
			sessionStars: mode.sessionStars,
			total: w.stars.stars.length,
			remaining: w.stars.remaining,
			stars: w.stars.stars.map((s) => ({
				...vec(s),
				collected: s.state !== "idle"
			})),
			fading: !!mode.fade,
			camForward: vec(mode.cam?.getForward ? mode.cam.getForward(mode._fwd.clone()) : null)
		};
	}
	function galleryState(mode) {
		if (!mode.track) return null;
		return {
			piece: PIECES[mode.index]?.id,
			pieceIndex: mode.index,
			pieces: PIECES.length,
			...trackState(mode.track, mode.s)
		};
	}
	function state() {
		const mode = game.mode;
		const name = game.ctx?.modeName ?? null;
		const out = {
			t: round(simTime, 1e4),
			ready: api.ready,
			realtime,
			screen: router.current?.name ?? null,
			mode: name,
			seed: mode?.config?.seed ?? game.ctx?.config?.seed ?? null,
			config: plain(game.ctx?.config ?? null),
			paused: !!game.paused,
			input: {
				x: round(input.move.x),
				y: round(input.move.y),
				source: input.source
			},
			canJump: false,
			pos: null,
			vel: null,
			speed: 0,
			onGround: false,
			frozen: false,
			fell: false,
			won: false
		};
		const ball = mode?.ball;
		if (ball?.body && game.physics && !game.physics.disposed) try {
			out.pos = vec(ball.getPosition());
			out.vel = vec(ball.getVelocity());
			out.speed = round(ball.speed);
			out.onGround = ball.isGrounded();
			out.frozen = !!ball.frozen;
		} catch {}
		try {
			if (name === "race") {
				out.race = raceState(mode);
				out.won = !!mode.sim?.finished;
				out.fell = (mode.sim?.fallTimer || 0) > 0;
				out.frozen = out.frozen || !!mode.sim?.frozen;
			} else if (name === "test-track" && out.pos) {
				out.testTrack = testTrackState(mode, out.pos);
				out.won = mode.finished > 0;
				out.fell = mode.falling > 0;
			} else if (name === "playground") {
				out.playground = playgroundState(mode);
				out.won = !!out.playground && out.playground.total > 0 && out.playground.remaining === 0;
				out.fell = mode.fade?.phase === "out";
			} else if (name === "gallery") {
				out.gallery = galleryState(mode);
				out.fell = mode.falling > 0;
			}
		} catch (err) {
			out.error = String(err?.message || err);
		}
		const dbg = {};
		for (const [k, v] of debug.fields) try {
			dbg[k] = plain(typeof v === "function" ? v() : v);
		} catch (err) {
			dbg[k] = `! ${err.message}`;
		}
		out.debug = dbg;
		return out;
	}
	function step(n = 1) {
		const count = Math.max(0, Math.floor(Number(n) || 0));
		for (let i = 0; i < count; i++) {
			game._update(TEST_DT);
			if (game.mode && game.scene && !game.paused) game.mode.render(1, TEST_DT);
		}
		draw(TEST_DT);
		return state();
	}
	function setRealtime(on) {
		realtime = !!on;
		loop.accumulator = 0;
		loop._last = performance.now();
		return realtime;
	}
	function debugAction(name) {
		const m = game.mode;
		if (!m) return false;
		if (name === "respawn" && m.respawn) m.respawn();
		else if (name === "nextPiece" && m.nextPiece) m.nextPiece();
		else if (name === "regenerate" && m.regenerate) m.regenerate();
		else return false;
		return true;
	}
	/**
	* teleport({x, y, z}) or teleport({s}) (race / test-track / gallery: meters
	* along the center line; y is then placed just above the road).
	*/
	function teleport(target = {}) {
		const mode = game.mode;
		const name = game.ctx?.modeName;
		if (!mode?.ball) return state();
		let pos;
		let dir = null;
		const track = name === "race" ? mode.sim?.track : name === "gallery" ? mode.track : null;
		if (typeof target.s === "number" && track) {
			const f = track.spline.sampleAt(target.s);
			pos = {
				x: f.position.x,
				y: f.position.y + .8,
				z: f.position.z
			};
			dir = {
				x: f.forward.x,
				y: 0,
				z: f.forward.z
			};
		} else if (typeof target.s === "number" && name === "test-track") {
			const c = testTrackLine(mode);
			const [p] = samplePolyline(c.pts, c.s, target.s, 1);
			const i = Math.max(0, c.s.findIndex((v) => v > target.s) - 1);
			pos = {
				x: p.x,
				y: p.y + .8,
				z: p.z
			};
			dir = forwardOf(mode.strips[Math.min(i, mode.strips.length - 1)].yaw);
		} else pos = {
			x: Number(target.x) || 0,
			y: Number(target.y) || 0,
			z: Number(target.z) || 0
		};
		if (!dir) dir = name === "race" ? mode.sim.forward.clone() : mode.forward?.clone?.() || mode._fwd?.clone?.() || null;
		mode.ball.respawn(pos, dir);
		if (name === "race" && mode.sim) {
			const sim = mode.sim;
			sim.s = sim.stuckS = sim.track.nearest(pos, -1).s;
			sim.stuckT = 0;
			sim.fallTimer = 0;
			if (dir) sim.forward.set(dir.x, 0, dir.z).normalize();
		} else if (name === "test-track") {
			mode.progress = nearestStrip(mode.strips, pos, 0, 0, mode.strips.length).index;
			mode.falling = 0;
			if (dir) mode.forward.set(dir.x, 0, dir.z).normalize();
		} else if (name === "gallery") {
			mode.s = mode.track.nearest(pos, -1).s;
			mode.falling = 0;
		} else if (name === "playground") {
			mode.lastSafe.set(pos.x, pos.y, pos.z);
			mode.fade = null;
			mode.stuck?.reset();
		}
		if (dir && mode.cam) mode.cam.snap(pos, dir);
		log.push("teleport", { pos });
		return state();
	}
	async function restore() {
		const cur = router.current;
		if (!cur || cur.name !== "play") return state();
		api.ready = false;
		await router.go("play", cur.params);
		simTime = 0;
		api.ready = true;
		log.push("reset", { mode: game.ctx?.modeName ?? null });
		return state();
	}
	function isVisible(el) {
		if (el.checkVisibility) return el.checkVisibility({
			opacityProperty: true,
			visibilityProperty: true
		});
		return el.getClientRects().length > 0;
	}
	function text() {
		const root = document.getElementById("ui");
		const out = [];
		if (!root) return out;
		const push = (s) => {
			const v = String(s || "").replace(/\s+/g, " ").trim();
			if (v && out[out.length - 1] !== v) out.push(v);
		};
		const walk = (el) => {
			if (!isVisible(el)) return;
			push(el.getAttribute("aria-label"));
			for (const n of el.childNodes) if (n.nodeType === 3) push(n.textContent);
			else if (n.nodeType === 1 && n.tagName !== "svg" && n.tagName !== "SCRIPT" && n.tagName !== "STYLE") walk(n);
		};
		walk(root);
		return out;
	}
	/** Full center line for the current track (race / test-track / gallery). */
	function trackLine() {
		const mode = game.mode;
		const name = game.ctx?.modeName;
		const track = name === "race" ? mode?.sim?.track : name === "gallery" ? mode?.track : null;
		if (track) {
			const sp = track.spline;
			return sp.points.map((p, i) => ({
				s: round(sp.s[i]),
				...vec(p),
				width: round(p.width),
				yaw: round(p.yaw)
			}));
		}
		if (name === "test-track") {
			const c = testTrackLine(mode);
			return c.pts.map((p, i) => ({
				s: round(c.s[i]),
				...vec(p),
				width: p.width,
				gap: p.gap
			}));
		}
		return null;
	}
	const api = {
		name: "rolly-bally",
		version: 1,
		ready: false,
		dt: TEST_DT,
		step,
		render: () => draw(0),
		setRealtime,
		state,
		setInput(inp) {
			testInput = inp ? normalizeTestInput(inp) : null;
			return testInput;
		},
		clearInput() {
			testInput = null;
		},
		get events() {
			return log.list;
		},
		clearEvents: () => log.clear(),
		time: () => simTime,
		teleport,
		restore,
		text,
		track: trackLine,
		debugAction,
		app
	};
	window.__game = api;
	return { markReady() {
		api.ready = true;
		log.push("ready", {
			screen: router.current?.name ?? null,
			mode: game.ctx?.modeName ?? null
		});
	} };
}
//#endregion
export { installTestHooks };
