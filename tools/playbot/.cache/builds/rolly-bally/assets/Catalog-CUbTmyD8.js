//#region src/track/pieces/straight.js
var straight_default = {
	id: "straight",
	name: "Straight",
	kind: "path",
	build(o) {
		return { sections: [{ len: o.len ?? 12 }] };
	}
};
//#endregion
//#region src/track/math.js
var deg = (d) => d * Math.PI / 180;
function forwardXZ(yaw) {
	return {
		x: -Math.sin(yaw),
		z: -Math.cos(yaw)
	};
}
function rightXZ(yaw) {
	return {
		x: Math.cos(yaw),
		z: -Math.sin(yaw)
	};
}
function clamp(v, lo, hi) {
	return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a, b, t) {
	return a + (b - a) * t;
}
function smoothstep(t) {
	const u = clamp(t, 0, 1);
	return u * u * (3 - 2 * u);
}
/**
* Height profiles for sections that rise/fall: u in [0,1] → fraction of rise.
*  linear  constant slope (kinks at both ends)
*  smooth  smoothstep: starts and ends flat, steepest in the middle
*  kick    u²: starts flat and gets steeper (ski-jump / launch lip)
*/
var PROFILES = {
	linear: (u) => u,
	smooth: (u) => u * u * (3 - 2 * u),
	kick: (u) => u * u
};
/** Quaternion {x,y,z,w} for a yaw (about +Y). */
function yawQuat(yaw) {
	return {
		x: 0,
		y: Math.sin(yaw / 2),
		z: 0,
		w: Math.cos(yaw / 2)
	};
}
/** Quaternion product a*b (apply b first, then a). */
function mulQuat(a, b) {
	return {
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
	};
}
/** Quaternion for a rotation of `angle` about a unit axis {x,y,z}. */
function axisAngleQuat(axis, angle) {
	const s = Math.sin(angle / 2);
	return {
		x: axis.x * s,
		y: axis.y * s,
		z: axis.z * s,
		w: Math.cos(angle / 2)
	};
}
//#endregion
//#region src/track/pieces/curve.js
function makeCurve(id, name, angleDeg, len, dir) {
	return {
		id,
		name,
		kind: "curve",
		build(o) {
			const a = deg(o.angle ?? angleDeg);
			return { sections: [{
				len: o.len ?? len,
				turn: dir * a
			}] };
		}
	};
}
var curveGentleLeft = makeCurve("curve-gentle-left", "Gentle curve left", 45, 20, 1);
var curveGentleRight = makeCurve("curve-gentle-right", "Gentle curve right", 45, 20, -1);
var curveSharpLeft = makeCurve("curve-sharp-left", "Sharp curve left", 90, 16, 1);
var curveSharpRight = makeCurve("curve-sharp-right", "Sharp curve right", 90, 16, -1);
//#endregion
//#region src/track/pieces/ramp.js
function makeRamp(id, name, sign) {
	return {
		id,
		name,
		kind: "ramp",
		build(o) {
			const rise = Math.abs(o.rise ?? 3) * sign;
			return { sections: [{
				len: o.len ?? 12,
				rise,
				profile: "smooth"
			}] };
		}
	};
}
var rampUp = makeRamp("ramp-up", "Uphill ramp", 1);
var rampDown = makeRamp("ramp-down", "Downhill ramp", -1);
//#endregion
//#region src/track/pieces/launch.js
var KICK_LEN = 4;
var KICK_RISE = .8;
var GAP = 3.5;
var launch_default = {
	id: "launch",
	name: "Launch ramp + landing",
	kind: "gap",
	gap: true,
	build(o) {
		const w = o.width;
		const land = w + 2;
		return {
			sections: [
				{ len: 4 },
				{
					len: KICK_LEN,
					rise: KICK_RISE,
					profile: "kick",
					color: "orange",
					rails: false
				},
				{
					len: GAP,
					rise: -2,
					startSlope: 2 * KICK_RISE / KICK_LEN,
					floor: false,
					width: w,
					widthEnd: land
				},
				{
					len: 16,
					width: land
				},
				{
					len: 3,
					width: land,
					widthEnd: w
				}
			],
			features: [{
				type: "gapMarker",
				s: 8,
				len: GAP
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/gapBridged.js
var gapBridged_default = {
	id: "gap-bridged",
	name: "Gap (bridged)",
	kind: "gap",
	gap: true,
	build(o) {
		const w = o.width;
		const bridge = Math.min(w, Math.max(2.5, w * .55));
		const len = o.len ?? 3;
		return {
			sections: [
				{ len: 3 },
				{
					len,
					width: bridge,
					color: "wood",
					edge: false,
					rails: o.rails === "full" ? void 0 : false
				},
				{ len: 3 }
			],
			lanes: [{
				s0: 3,
				s1: 3 + len,
				min: -(bridge / 2 - .6),
				max: bridge / 2 - .6
			}],
			features: [{
				type: "gapMarker",
				s: 3,
				len,
				bridge
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/gapOpen.js
var OPEN_GAP = 2.2;
var KICK = {
	len: 2.5,
	rise: .35
};
var gapOpen_default = {
	id: "gap-open",
	name: "Gap (open)",
	kind: "gap",
	gap: true,
	build(o) {
		const len = o.len ?? OPEN_GAP;
		return {
			sections: [
				{ len: 3 },
				{
					len: KICK.len,
					rise: KICK.rise,
					profile: "kick",
					color: "orange"
				},
				{
					len,
					rise: -.9,
					startSlope: 2 * KICK.rise / KICK.len,
					floor: false
				},
				{ len: 5 }
			],
			features: [{
				type: "gapMarker",
				s: 3 + KICK.len,
				len
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/beam.js
function beamWidth(w) {
	return Math.min(w, Math.max(1.6, Math.min(2.4, w * .45)));
}
var beam_default = {
	id: "beam",
	name: "Narrow beam",
	kind: "beam",
	build(o) {
		const w = o.width;
		const bw = beamWidth(w);
		const len = o.len ?? 10;
		const half = Math.max(0, bw / 2 - .55);
		return {
			sections: [
				{
					len: 3,
					width: w,
					widthEnd: bw,
					rails: false
				},
				{
					len,
					width: bw,
					rails: false,
					color: "white"
				},
				{
					len: 3,
					width: bw,
					widthEnd: w,
					rails: false
				}
			],
			lanes: [{
				s0: 2,
				s1: 4 + len,
				min: -half,
				max: half
			}]
		};
	}
};
var start_default = {
	id: "start",
	name: "Wide pad (start)",
	kind: "gate",
	build(o) {
		const w = o.width;
		const W = Math.max(w, 10);
		const spread = Math.min(2.8, W / 2 - 1.2);
		return {
			sections: [{
				len: 9,
				width: W,
				color: "start"
			}, {
				len: 5,
				width: W,
				widthEnd: w
			}],
			features: [
				{
					type: "checkpoint",
					s: 6,
					start: true
				},
				{
					type: "startLine",
					s: 7.5
				},
				{
					type: "start",
					s: 6,
					slots: [
						{
							s: 6,
							lateral: 0
						},
						{
							s: 3,
							lateral: -spread
						},
						{
							s: 3,
							lateral: spread
						},
						{
							s: 3,
							lateral: 0
						}
					]
				}
			]
		};
	}
};
//#endregion
//#region src/track/pieces/finish.js
var finish_default = {
	id: "finish",
	name: "Finish gate",
	kind: "gate",
	build() {
		return {
			sections: [{
				len: 6,
				rails: "always"
			}, {
				len: 14,
				rails: "always"
			}],
			features: [{
				type: "finish",
				s: 4
			}, {
				type: "wall",
				s: 19.6
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/checkpoint.js
var checkpoint_default = {
	id: "checkpoint",
	name: "Checkpoint gate",
	kind: "gate",
	build() {
		return {
			sections: [{ len: 5 }],
			features: [{
				type: "checkpoint",
				s: 2.5
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/boost.js
var boost_default = {
	id: "boost",
	name: "Boost pad",
	kind: "boost",
	build(o) {
		return {
			sections: [{ len: o.len ?? 8 }],
			features: [{
				type: "boost",
				s: 4,
				len: 4
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/bumpers.js
var BUMPER_HALF = .45;
var BUMPER_REACH = BUMPER_HALF * Math.SQRT2;
function rowsFor(w) {
	if (w >= 5) return [
		{
			s: 3.5,
			lats: [w * .15]
		},
		{
			s: 7,
			lats: [-w * .3, w * .3]
		},
		{
			s: 10.5,
			lats: [-w * .15]
		}
	];
	return [{
		s: 4,
		lats: [w * .18]
	}, {
		s: 10,
		lats: [-w * .18]
	}];
}
/** Widest free lateral interval between posts (inside the road). */
function freeInterval(w, lats, margin = .6) {
	const edge = w / 2 - .2;
	const blocks = lats.map((l) => [l - BUMPER_REACH, l + BUMPER_REACH]).sort((a, b) => a[0] - b[0]);
	let best = null;
	let lo = -edge;
	for (const [b0, b1] of [...blocks, [edge, edge]]) {
		if (b0 - lo > (best ? best[1] - best[0] : -Infinity)) best = [lo, b0];
		lo = Math.max(lo, b1);
	}
	let min = best[0] + margin;
	let max = best[1] - margin;
	if (min > max) min = max = (best[0] + best[1]) / 2;
	return {
		min,
		max
	};
}
var bumpers_default = {
	id: "bumpers",
	name: "Static bumpers",
	kind: "hazard",
	hazard: true,
	build(o) {
		const w = o.width;
		const features = [];
		const lanes = [];
		for (const row of rowsFor(w)) {
			for (const lateral of row.lats) features.push({
				type: "bumper",
				s: row.s,
				lateral,
				half: BUMPER_HALF
			});
			lanes.push({
				s0: row.s - 1.2,
				s1: row.s + 1.2,
				...freeInterval(w, row.lats)
			});
		}
		return {
			sections: [{
				len: 14,
				rails: o.guard ? "always" : void 0
			}],
			features,
			lanes
		};
	}
};
//#endregion
//#region src/track/pieces/hammer.js
var hammer_default = {
	id: "hammer",
	name: "Swinging hammer",
	kind: "hazard",
	hazard: true,
	build(o) {
		return {
			sections: [{ len: 14 }],
			features: [{
				type: "hazard",
				hazard: "hammer",
				s: 6,
				zone: [2, 7],
				params: {
					side: o.side ?? 1,
					phase: o.phase ?? 0,
					speed: o.speed ?? 1
				}
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/wreckingBall.js
var wreckingBall_default = {
	id: "wrecking-ball",
	name: "Wrecking ball",
	kind: "hazard",
	hazard: true,
	build(o) {
		return {
			sections: [{ len: 12 }],
			features: [{
				type: "hazard",
				hazard: "wreckingBall",
				s: 6,
				zone: [2, 2],
				params: {
					phase: o.phase ?? 0,
					speed: o.speed ?? 1
				}
			}]
		};
	}
};
//#endregion
//#region src/track/pieces/spinner.js
var spinner_default = {
	id: "spinner",
	name: "Spinner",
	kind: "hazard",
	hazard: true,
	build(o) {
		return {
			sections: [{ len: 12 }],
			features: [{
				type: "hazard",
				hazard: "spinner",
				s: 6,
				zone: [4, 4],
				params: {
					phase: o.phase ?? 0,
					speed: o.speed ?? 1
				}
			}]
		};
	}
};
var movingPlatform_default = {
	id: "moving-platform",
	name: "Moving platform",
	kind: "hazard",
	hazard: true,
	gap: true,
	build(o) {
		return {
			sections: [
				{ len: 3 },
				{
					len: 7,
					floor: false
				},
				{ len: 3 }
			],
			features: [{
				type: "gapMarker",
				s: 3,
				len: 7
			}, {
				type: "hazard",
				hazard: "movingPlatform",
				s: 6.5,
				zone: [7 / 2, 7 / 2],
				params: {
					length: 6.9,
					phase: o.phase ?? 0,
					speed: o.speed ?? 1
				}
			}]
		};
	}
};
//#endregion
//#region src/track/Catalog.js
var MIN_LEVEL = {
	start: 1,
	finish: 1,
	checkpoint: 1,
	straight: 1,
	"curve-gentle-left": 1,
	"curve-gentle-right": 1,
	"ramp-up": 1,
	"ramp-down": 1,
	"curve-sharp-left": 2,
	"curve-sharp-right": 2,
	bumpers: 2,
	"gap-bridged": 3,
	hammer: 3,
	boost: 3,
	"gap-open": 4,
	beam: 4,
	"wrecking-ball": 4,
	launch: 5,
	spinner: 5,
	"moving-platform": 5
};
/** Every piece, in gallery order. */
var PIECES = [
	start_default,
	straight_default,
	curveGentleLeft,
	curveGentleRight,
	curveSharpLeft,
	curveSharpRight,
	rampUp,
	rampDown,
	checkpoint_default,
	boost_default,
	bumpers_default,
	gapBridged_default,
	gapOpen_default,
	beam_default,
	launch_default,
	hammer_default,
	wreckingBall_default,
	spinner_default,
	movingPlatform_default,
	finish_default
].map((p) => ({
	hazard: false,
	gap: false,
	...p,
	minLevel: MIN_LEVEL[p.id] ?? 1
}));
PIECES.map((p) => p.id);
var BY_ID = new Map(PIECES.map((p) => [p.id, p]));
function getPiece(id) {
	const p = BY_ID.get(id);
	if (!p) throw new Error(`Unknown track piece "${id}"`);
	return p;
}
function hasPiece(id) {
	return BY_ID.has(id);
}
/** Default track options; see resolveOptions. */
var DEFAULT_TRACK_OPTIONS = {
	width: 8,
	rails: "full",
	hazardSpeed: 1
};
function resolveOptions(opts = {}) {
	const o = {
		...DEFAULT_TRACK_OPTIONS,
		...opts
	};
	if (o.rails === true) o.rails = "full";
	if (o.rails === false) o.rails = "none";
	if (![
		"full",
		"curves",
		"none"
	].includes(o.rails)) o.rails = "full";
	o.width = Math.max(1.5, Number(o.width) || DEFAULT_TRACK_OPTIONS.width);
	return o;
}
/**
* Build one piece's definition.
* @param {string|{id:string}} entry piece id or {id, ...params}
* @param {object} opts track options (width, rails, hazardSpeed)
*/
function buildPieceDef(entry, opts) {
	const e = typeof entry === "string" ? { id: entry } : entry;
	const piece = getPiece(e.id);
	const o = {
		...resolveOptions(opts),
		...e
	};
	const def = piece.build(o);
	return {
		piece,
		params: e,
		options: o,
		sections: def.sections,
		features: def.features || [],
		lanes: def.lanes || []
	};
}
//#endregion
export { resolveOptions as a, axisAngleQuat as c, forwardXZ as d, lerp as f, yawQuat as g, smoothstep as h, hasPiece as i, clamp as l, rightXZ as m, buildPieceDef as n, BUMPER_HALF as o, mulQuat as p, getPiece as r, PROFILES as s, PIECES as t, deg as u };
