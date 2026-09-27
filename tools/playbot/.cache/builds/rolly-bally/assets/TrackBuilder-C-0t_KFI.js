import { E as Mesh, N as Vector3, O as MeshLambertMaterial, T as Matrix4, _ as Float32BufferAttribute, d as BufferGeometry, h as Euler, i as BlockMesh, j as Quaternion, l as BoxGeometry, o as getPalette, p as Color, u as BufferAttribute, v as Group, y as IcosahedronGeometry } from "./index-Cs7XvCIe.js";
import { a as resolveOptions, c as axisAngleQuat, d as forwardXZ, f as lerp, g as yawQuat, h as smoothstep, l as clamp, m as rightXZ, n as buildPieceDef, p as mulQuat, s as PROFILES } from "./Catalog-CUbTmyD8.js";
//#region src/track/TrackSpline.js
var TrackSpline = class {
	/**
	* @param {Array<{x,y,z,yaw,width,widthEnd?,floor,piece}>} points center line
	*   samples in order. Point i describes the segment [i, i+1]; its width runs
	*   from `width` to `widthEnd` (default: the next point's width), so a bridge
	*   can narrow abruptly.
	*/
	constructor(points) {
		if (points.length < 2) throw new Error("TrackSpline needs at least 2 points");
		this.points = points;
		const s = new Float64Array(points.length);
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			s[i] = s[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
		}
		this.s = s;
		this.length = s[s.length - 1];
	}
	/** Index i of the segment [i, i+1] containing s (clamped). */
	indexAt(s) {
		const arr = this.s;
		if (s <= 0) return 0;
		if (s >= this.length) return arr.length - 2;
		let lo = 0;
		let hi = arr.length - 1;
		while (hi - lo > 1) {
			const mid = lo + hi >> 1;
			if (arr[mid] <= s) lo = mid;
			else hi = mid;
		}
		return lo;
	}
	_t(i, s) {
		const len = this.s[i + 1] - this.s[i];
		return len > 1e-9 ? clamp((s - this.s[i]) / len, 0, 1) : 0;
	}
	positionAt(s, out = {
		x: 0,
		y: 0,
		z: 0
	}) {
		const i = this.indexAt(s);
		const t = this._t(i, s);
		const a = this.points[i];
		const b = this.points[i + 1];
		out.x = a.x + (b.x - a.x) * t;
		out.y = a.y + (b.y - a.y) * t;
		out.z = a.z + (b.z - a.z) * t;
		return out;
	}
	yawAt(s) {
		const i = this.indexAt(s);
		const t = this._t(i, s);
		return this.points[i].yaw + (this.points[i + 1].yaw - this.points[i].yaw) * t;
	}
	_widthIn(i, t) {
		const a = this.points[i];
		const end = a.widthEnd ?? this.points[i + 1].width;
		return a.width + (end - a.width) * t;
	}
	widthAt(s) {
		const i = this.indexAt(s);
		return this._widthIn(i, this._t(i, s));
	}
	/** Horizontal unit forward (y = 0). */
	forwardAt(s, out = {
		x: 0,
		y: 0,
		z: 0
	}) {
		const f = forwardXZ(this.yawAt(s));
		out.x = f.x;
		out.y = 0;
		out.z = f.z;
		return out;
	}
	/** Horizontal unit right (y = 0). */
	rightAt(s, out = {
		x: 0,
		y: 0,
		z: 0
	}) {
		const r = rightXZ(this.yawAt(s));
		out.x = r.x;
		out.y = 0;
		out.z = r.z;
		return out;
	}
	/** Full frame at s. `floor` is false over gaps (the line keeps going through the air). */
	sampleAt(s, out = {}) {
		const i = this.indexAt(s);
		const t = this._t(i, s);
		const a = this.points[i];
		const b = this.points[i + 1];
		const sc = clamp(s, 0, this.length);
		out.s = sc;
		out.position = this.positionAt(sc, out.position || {
			x: 0,
			y: 0,
			z: 0
		});
		out.yaw = a.yaw + (b.yaw - a.yaw) * t;
		const f = forwardXZ(out.yaw);
		const r = rightXZ(out.yaw);
		out.forward = Object.assign(out.forward || {}, {
			x: f.x,
			y: 0,
			z: f.z
		});
		out.right = Object.assign(out.right || {}, {
			x: r.x,
			y: 0,
			z: r.z
		});
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const dz = b.z - a.z;
		const len = Math.hypot(dx, dy, dz) || 1;
		out.tangent = Object.assign(out.tangent || {}, {
			x: dx / len,
			y: dy / len,
			z: dz / len
		});
		out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
		out.width = this._widthIn(i, t);
		out.floor = a.floor;
		out.piece = a.piece;
		return out;
	}
	/**
	* Closest point on the center line to p.
	* @param {{x,y,z}} p
	* @param {number} [hintS=-1] last known s; searches a window around it (fast,
	*   and avoids snapping to a different part of the track that passes nearby).
	*   Negative = search everything.
	* @returns {{s, index, dist, lateral, height}} lateral = signed offset along
	*   right (m), height = p.y minus the center line height.
	*/
	nearest(p, hintS = -1, back = 8, ahead = 30) {
		let lo = 0;
		let hi = this.points.length - 2;
		if (hintS >= 0) {
			lo = Math.max(0, this.indexAt(hintS - back));
			hi = Math.min(hi, this.indexAt(hintS + ahead));
		}
		let best = -1;
		let bestD = Infinity;
		let bestT = 0;
		const pts = this.points;
		for (let i = lo; i <= hi; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			const abx = b.x - a.x;
			const aby = b.y - a.y;
			const abz = b.z - a.z;
			const l2 = abx * abx + aby * aby + abz * abz;
			let t = l2 > 1e-12 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2 : 0;
			t = clamp(t, 0, 1);
			const dx = p.x - (a.x + abx * t);
			const dy = p.y - (a.y + aby * t);
			const dz = p.z - (a.z + abz * t);
			const d = dx * dx + dy * dy + dz * dz;
			if (d < bestD) {
				bestD = d;
				best = i;
				bestT = t;
			}
		}
		const s = this.s[best] + (this.s[best + 1] - this.s[best]) * bestT;
		const c = this.positionAt(s);
		const r = rightXZ(this.yawAt(s));
		return {
			s,
			index: best,
			dist: Math.sqrt(bestD),
			lateral: (p.x - c.x) * r.x + (p.z - c.z) * r.z,
			height: p.y - c.y
		};
	}
	/** Fraction of the track completed at p (0..1). */
	progress(p, hintS = -1) {
		return this.nearest(p, hintS).s / this.length;
	}
};
var LANE_MARGIN = .8;
var LANE_RAMP = 2.5;
var BALL_SPAWN_HEIGHT = .8;
/** Parabola h(u)·rise that leaves at `slope` (dy/dx) and ends at rise. */
function arcProfile(rise, len, slope) {
	if (Math.abs(rise) < 1e-9) return (u) => u;
	const c = (rise - slope * len) / (len * len);
	return (u) => (slope * len * u + c * len * len * u * u) / rise;
}
function railsFor(sec, mode) {
	if (sec.floor === false || sec.rails === false) return false;
	if (sec.rails === "always" || sec.rails === true) return true;
	if (mode === "full") return true;
	if (mode === "curves") return Math.abs(sec.turn || 0) > 1e-6;
	return false;
}
var TrackLayout = class {
	/**
	* @param {Array<string|object>} entries piece ids or {id, ...params}
	* @param {object} [opts] {width, rails: 'full'|'curves'|'none', hazardSpeed, start: {x,y,z,yaw}}
	*/
	constructor(entries, opts = {}) {
		if (!entries || entries.length === 0) throw new Error("TrackLayout needs at least one piece");
		this.options = resolveOptions(opts);
		const start = opts.start || {
			x: 0,
			y: 0,
			z: 0,
			yaw: 0
		};
		this.strips = [];
		this.pieces = [];
		let x = start.x;
		let y = start.y;
		let z = start.z;
		let yaw = start.yaw || 0;
		let s = 0;
		entries.map((e) => buildPieceDef(e, this.options)).forEach((def, pi) => {
			const entry = {
				x,
				y,
				z,
				yaw
			};
			const s0 = s;
			def.sections.forEach((sec, si) => {
				const len = sec.len;
				const n = Math.max(1, Math.ceil(len / 1 - 1e-9));
				const turn = sec.turn || 0;
				const rise = sec.rise || 0;
				const wA = sec.width ?? this.options.width;
				const wB = sec.widthEnd ?? wA;
				const prof = sec.startSlope != null ? arcProfile(rise, len, sec.startSlope) : PROFILES[sec.profile || "linear"];
				const rails = railsFor(sec, this.options.rails);
				const floor = sec.floor !== false;
				const y0 = y;
				const yaw0 = yaw;
				const dTheta = turn / n;
				const chord = Math.abs(dTheta) > 1e-9 ? 2 * (len / turn) * Math.sin(dTheta / 2) : len / n;
				for (let i = 0; i < n; i++) {
					const u0 = i / n;
					const u1 = (i + 1) / n;
					const yawA = yaw0 + turn * u0;
					const yawB = yaw0 + turn * u1;
					const yawM = (yawA + yawB) / 2;
					const f = forwardXZ(yawM);
					const a = {
						x,
						y,
						z
					};
					x += f.x * chord;
					z += f.z * chord;
					y = i === n - 1 ? y0 + rise : y0 + rise * prof(u1);
					const b = {
						x,
						y,
						z
					};
					const dy = b.y - a.y;
					const l3 = Math.hypot(chord, dy);
					this.strips.push({
						a,
						b,
						yawA,
						yawB,
						yaw: yawM,
						pitch: Math.atan2(dy, chord),
						len: l3,
						hlen: chord,
						widthA: lerp(wA, wB, u0),
						widthB: lerp(wA, wB, u1),
						rails,
						floor,
						color: sec.color || null,
						edge: sec.edge !== false,
						piece: pi,
						section: si,
						s0: s,
						s1: s + l3
					});
					s += l3;
				}
				yaw = yaw0 + turn;
				y = y0 + rise;
			});
			this.pieces.push({
				index: pi,
				id: def.piece.id,
				name: def.piece.name,
				kind: def.piece.kind,
				hazard: !!def.piece.hazard,
				gap: !!def.piece.gap,
				params: def.params,
				options: def.options,
				s0,
				s1: s,
				entry,
				exit: {
					x,
					y,
					z,
					yaw
				},
				def
			});
		});
		this.strips.forEach((st, i) => {
			const prev = this.strips[i - 1];
			const next = this.strips[i + 1];
			st.capStart = st.floor && (!prev || !prev.floor || Math.abs(prev.widthB - st.widthA) > .01);
			st.capEnd = st.floor && (!next || !next.floor || Math.abs(next.widthA - st.widthB) > .01);
		});
		const pts = this.strips.map((st) => ({
			...st.a,
			yaw: st.yawA,
			width: st.widthA,
			widthEnd: st.widthB,
			floor: st.floor,
			piece: st.piece
		}));
		const last = this.strips[this.strips.length - 1];
		pts.push({
			...last.b,
			yaw: last.yawB,
			width: last.widthB,
			floor: last.floor,
			piece: last.piece
		});
		this.spline = new TrackSpline(pts);
		this.length = this.spline.length;
		this._placeFeatures();
	}
	_frame(s) {
		const f = this.spline.sampleAt(s);
		return {
			s: f.s,
			position: { ...f.position },
			forward: { ...f.forward },
			right: { ...f.right },
			yaw: f.yaw,
			pitch: f.pitch,
			width: f.width
		};
	}
	_placeFeatures() {
		this.features = [];
		this.checkpoints = [];
		this.startSlots = [];
		this.boostZones = [];
		this.hazardZones = [];
		this.gapZones = [];
		this.lanes = [];
		this.finish = null;
		for (const p of this.pieces) {
			const pieceLen = p.s1 - p.s0;
			for (const f of p.def.features) {
				const s = p.s0 + clamp(f.s, 0, pieceLen);
				const frame = this._frame(s);
				const wf = {
					...f,
					...frame,
					piece: p.index
				};
				this.features.push(wf);
				if (f.type === "checkpoint") this.checkpoints.push(wf);
				else if (f.type === "finish") this.finish = wf;
				else if (f.type === "boost") this.boostZones.push({
					s0: s - f.len / 2,
					s1: s + f.len / 2,
					piece: p.index,
					feature: wf
				});
				else if (f.type === "gapMarker") this.gapZones.push({
					s0: s,
					s1: s + f.len,
					piece: p.index,
					bridged: !!f.bridge
				});
				else if (f.type === "hazard") {
					const [before, after] = f.zone || [3, 3];
					this.hazardZones.push({
						s0: s - before,
						s1: s + after,
						type: f.hazard,
						piece: p.index,
						feature: wf
					});
				} else if (f.type === "bumper") this.hazardZones.push({
					s0: s - 1,
					s1: s + 1,
					type: "bumper",
					piece: p.index,
					feature: wf
				});
				else if (f.type === "start") for (const slot of f.slots) {
					const fr = this._frame(p.s0 + slot.s);
					this.startSlots.push({
						s: fr.s,
						lateral: slot.lateral,
						forward: fr.forward,
						yaw: fr.yaw,
						position: {
							x: fr.position.x + fr.right.x * slot.lateral,
							y: fr.position.y + BALL_SPAWN_HEIGHT,
							z: fr.position.z + fr.right.z * slot.lateral
						}
					});
				}
			}
			for (const l of p.def.lanes) this.lanes.push({
				s0: p.s0 + l.s0,
				s1: p.s0 + l.s1,
				min: Math.min(l.min, l.max),
				max: Math.max(l.min, l.max)
			});
		}
		this.checkpoints.sort((a, b) => a.s - b.s);
		this.checkpoints.forEach((c, i) => c.index = i);
		if (this.checkpoints.length === 0) {
			const c = this._frame(Math.min(2, this.length / 2));
			this.checkpoints.push({
				type: "checkpoint",
				...c,
				piece: 0,
				index: 0,
				implicit: true
			});
		}
		this.lanes.sort((a, b) => a.s0 - b.s0);
		this.hazardZones.sort((a, b) => a.s0 - b.s0);
	}
	nearest(p, hintS = -1) {
		return this.spline.nearest(p, hintS);
	}
	pieceAt(s) {
		for (const p of this.pieces) if (s < p.s1) return p;
		return this.pieces[this.pieces.length - 1];
	}
	/** Latest checkpoint at or before s (the first one if none). */
	checkpointBefore(s) {
		let best = this.checkpoints[0];
		for (const c of this.checkpoints) if (c.s <= s + 1e-6) best = c;
		else break;
		return best;
	}
	/** Spawn position (ball center) + facing for a checkpoint (or s). */
	respawnAt(checkpointOrS) {
		const c = typeof checkpointOrS === "number" ? this.checkpointBefore(checkpointOrS) : checkpointOrS;
		return {
			position: {
				x: c.position.x,
				y: c.position.y + BALL_SPAWN_HEIGHT,
				z: c.position.z
			},
			forward: { ...c.forward },
			s: c.s
		};
	}
	isOverGap(s) {
		return this.gapZones.some((g) => s >= g.s0 && s <= g.s1);
	}
	inHazard(s) {
		return this.hazardZones.find((h) => s >= h.s0 && s <= h.s1) || null;
	}
	/**
	* Lateral range {min, max} where an AI ball can roll safely at s: inside
	* the road (minus LANE_MARGIN) and around static obstacles (piece lanes,
	* blended in over LANE_RAMP meters).
	*/
	laneAt(s, out = {
		min: 0,
		max: 0
	}) {
		const half = Math.max(0, this.spline.widthAt(s) / 2 - LANE_MARGIN);
		let min = -half;
		let max = half;
		let wSum = 0;
		let zMin = 0;
		let zMax = 0;
		let kMax = 0;
		for (const z of this.lanes) {
			if (z.s0 - 2.5 > s) break;
			if (s > z.s1 + 2.5) continue;
			const k = s < z.s0 ? smoothstep((s - (z.s0 - LANE_RAMP)) / LANE_RAMP) : s > z.s1 ? smoothstep((z.s1 + LANE_RAMP - s) / LANE_RAMP) : 1;
			if (k <= 0) continue;
			const w = k / (1.002 - k);
			wSum += w;
			zMin += z.min * w;
			zMax += z.max * w;
			if (k > kMax) kMax = k;
		}
		if (wSum > 0) {
			min = lerp(min, zMin / wSum, kMax);
			max = lerp(max, zMax / wSum, kMax);
		}
		out.min = min;
		out.max = max;
		return out;
	}
	/** Lateral offset (m) for an AI in lane ∈ [-1, 1] (0 = middle of the safe range). */
	aiOffsetAt(s, lane = 0) {
		const r = this.laneAt(s, this._laneTmp || (this._laneTmp = {
			min: 0,
			max: 0
		}));
		const l = clamp(lane, -1, 1);
		return (r.min + r.max) / 2 + l * (r.max - r.min) / 2;
	}
	/** World position of the AI path at s for a lane (center-line height). */
	aiPointAt(s, lane = 0, out = {
		x: 0,
		y: 0,
		z: 0
	}) {
		const off = this.aiOffsetAt(s, lane);
		this.spline.positionAt(s, out);
		const r = this.spline.rightAt(s, this._rTmp || (this._rTmp = {
			x: 0,
			y: 0,
			z: 0
		}));
		out.x += r.x * off;
		out.z += r.z * off;
		return out;
	}
};
//#endregion
//#region node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
/**
* Merges a set of geometries into a single instance. All geometries must have compatible attributes.
*
* @param {Array<BufferGeometry>} geometries - The geometries to merge.
* @param {boolean} [useGroups=false] - Whether to use groups or not.
* @return {?BufferGeometry} The merged geometry. Returns `null` if the merge does not succeed.
*/
function mergeGeometries(geometries, useGroups = false) {
	const isIndexed = geometries[0].index !== null;
	const attributesUsed = new Set(Object.keys(geometries[0].attributes));
	const morphAttributesUsed = new Set(Object.keys(geometries[0].morphAttributes));
	const attributes = {};
	const morphAttributes = {};
	const morphTargetsRelative = geometries[0].morphTargetsRelative;
	const mergedGeometry = new BufferGeometry();
	let offset = 0;
	for (let i = 0; i < geometries.length; ++i) {
		const geometry = geometries[i];
		let attributesCount = 0;
		if (isIndexed !== (geometry.index !== null)) {
			console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.");
			return null;
		}
		for (const name in geometry.attributes) {
			if (!attributesUsed.has(name)) {
				console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". All geometries must have compatible attributes; make sure \"" + name + "\" attribute exists among all geometries, or in none of them.");
				return null;
			}
			if (attributes[name] === void 0) attributes[name] = [];
			attributes[name].push(geometry.attributes[name]);
			attributesCount++;
		}
		if (attributesCount !== attributesUsed.size) {
			console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". Make sure all geometries have the same number of attributes.");
			return null;
		}
		if (morphTargetsRelative !== geometry.morphTargetsRelative) {
			console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". .morphTargetsRelative must be consistent throughout all geometries.");
			return null;
		}
		for (const name in geometry.morphAttributes) {
			if (!morphAttributesUsed.has(name)) {
				console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ".  .morphAttributes must be consistent throughout all geometries.");
				return null;
			}
			if (morphAttributes[name] === void 0) morphAttributes[name] = [];
			morphAttributes[name].push(geometry.morphAttributes[name]);
		}
		if (useGroups) {
			let count;
			if (isIndexed) count = geometry.index.count;
			else if (geometry.attributes.position !== void 0) count = geometry.attributes.position.count;
			else {
				console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + i + ". The geometry must have either an index or a position attribute");
				return null;
			}
			mergedGeometry.addGroup(offset, count, i);
			offset += count;
		}
	}
	if (isIndexed) {
		let indexOffset = 0;
		const mergedIndex = [];
		for (let i = 0; i < geometries.length; ++i) {
			const index = geometries[i].index;
			for (let j = 0; j < index.count; ++j) mergedIndex.push(index.getX(j) + indexOffset);
			indexOffset += geometries[i].attributes.position.count;
		}
		mergedGeometry.setIndex(mergedIndex);
	}
	for (const name in attributes) {
		const mergedAttribute = mergeAttributes(attributes[name]);
		if (!mergedAttribute) {
			console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + name + " attribute.");
			return null;
		}
		mergedGeometry.setAttribute(name, mergedAttribute);
	}
	for (const name in morphAttributes) {
		const numMorphTargets = morphAttributes[name][0].length;
		if (numMorphTargets === 0) continue;
		mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
		mergedGeometry.morphAttributes[name] = [];
		for (let i = 0; i < numMorphTargets; ++i) {
			const morphAttributesToMerge = [];
			for (let j = 0; j < morphAttributes[name].length; ++j) morphAttributesToMerge.push(morphAttributes[name][j][i]);
			const mergedMorphAttribute = mergeAttributes(morphAttributesToMerge);
			if (!mergedMorphAttribute) {
				console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + name + " morphAttribute.");
				return null;
			}
			mergedGeometry.morphAttributes[name].push(mergedMorphAttribute);
		}
	}
	return mergedGeometry;
}
/**
* Merges a set of attributes into a single instance. All attributes must have compatible properties and types.
* Instances of {@link InterleavedBufferAttribute} are not supported.
*
* @param {Array<BufferAttribute>} attributes - The attributes to merge.
* @return {?BufferAttribute} The merged attribute. Returns `null` if the merge does not succeed.
*/
function mergeAttributes(attributes) {
	let TypedArray;
	let itemSize;
	let normalized;
	let gpuType = -1;
	let arrayLength = 0;
	for (let i = 0; i < attributes.length; ++i) {
		const attribute = attributes[i];
		if (TypedArray === void 0) TypedArray = attribute.array.constructor;
		if (TypedArray !== attribute.array.constructor) {
			console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.");
			return null;
		}
		if (itemSize === void 0) itemSize = attribute.itemSize;
		if (itemSize !== attribute.itemSize) {
			console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.");
			return null;
		}
		if (normalized === void 0) normalized = attribute.normalized;
		if (normalized !== attribute.normalized) {
			console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.");
			return null;
		}
		if (gpuType === -1) gpuType = attribute.gpuType;
		if (gpuType !== attribute.gpuType) {
			console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.");
			return null;
		}
		arrayLength += attribute.count * itemSize;
	}
	const array = new TypedArray(arrayLength);
	const result = new BufferAttribute(array, itemSize, normalized);
	let offset = 0;
	for (let i = 0; i < attributes.length; ++i) {
		const attribute = attributes[i];
		if (attribute.isInterleavedBufferAttribute) {
			const tupleOffset = offset / itemSize;
			for (let j = 0, l = attribute.count; j < l; j++) for (let c = 0; c < itemSize; c++) {
				const value = attribute.getComponent(j, c);
				result.setComponent(j + tupleOffset, c, value);
			}
		} else array.set(attribute.array, offset);
		offset += attribute.count * itemSize;
	}
	if (gpuType !== void 0) result.gpuType = gpuType;
	return result;
}
//#endregion
//#region src/track/hazards/parts.js
var _c$1 = new Color();
function shadeFor(ny, nx) {
	if (ny > .5) return 1;
	if (ny < -.5) return .6;
	return Math.abs(nx) > .5 ? .8 : .9;
}
function colorize(geometry, color, palette) {
	const g = geometry.index ? geometry.toNonIndexed() : geometry;
	g.deleteAttribute("uv");
	g.computeVertexNormals();
	const n = g.attributes.normal;
	const v = palette[color] ?? color;
	_c$1.set(v);
	const colors = new Float32Array(n.count * 3);
	for (let i = 0; i < n.count; i++) {
		const s = shadeFor(n.getY(i), n.getX(i));
		colors[i * 3] = _c$1.r * s;
		colors[i * 3 + 1] = _c$1.g * s;
		colors[i * 3 + 2] = _c$1.b * s;
	}
	g.setAttribute("color", new BufferAttribute(colors, 3));
	return g;
}
function makePartsGeometry(parts, palette = "race") {
	const pal = getPalette(palette);
	const geos = parts.map((p) => {
		let g;
		if (p.sphere) {
			g = new IcosahedronGeometry(p.radius, p.detail ?? 1);
			g.translate(p.sphere[0], p.sphere[1], p.sphere[2]);
		} else {
			g = new BoxGeometry(p.size[0], p.size[1], p.size[2]);
			if (p.rotation) g.applyQuaternion(new Quaternion(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w));
			g.translate(p.box[0], p.box[1], p.box[2]);
		}
		return colorize(g, p.color, pal);
	});
	const merged = mergeGeometries(geos, false);
	geos.forEach((g) => g.dispose());
	merged.computeBoundingSphere();
	return merged;
}
/** Shared flat-shaded material for hazard meshes. */
function makeHazardMaterial() {
	return new MeshLambertMaterial({
		vertexColors: true,
		flatShading: true
	});
}
//#endregion
//#region src/track/hazards/Hazard.js
var Hazard = class {
	/**
	* @param {object} o
	* @param {object} o.physics Physics
	* @param {THREE.Object3D} o.scene
	* @param {object} o.frame track frame at the hazard {position, yaw, forward, right, width}
	* @param {object} o.params piece params {phase, speed, side...}
	* @param {number} [o.hazardSpeed=1]
	* @param {THREE.Material} o.material shared hazard material
	* @param {object} [o.blocks] BlockMesh for static parts
	* @param {(info) => void} [o.onHit] called when the player ball is hit
	*/
	constructor({ physics, scene, frame, params = {}, hazardSpeed = 1, material, blocks, onHit }) {
		const Cls = this.constructor;
		this.type = Cls.type;
		this.physics = physics;
		this.cfg = Cls.config(frame, frame.width, params, hazardSpeed);
		const p0 = Cls.pose(this.cfg, 0);
		this.staticBodies = [];
		if (blocks) this._static(this.cfg, blocks, physics);
		const { body, colliders } = physics.addKinematic({
			position: p0.position,
			rotation: p0.rotation,
			shapes: this._shapes(this.cfg),
			friction: this.cfg.friction ?? .5,
			restitution: this.cfg.restitution ?? .3,
			tag: "hazard",
			data: this,
			events: true,
			onCollide: ({ other, otherInfo, started }) => {
				if (otherInfo?.tag !== "ball") return;
				if (started && onHit && Cls.reportsHits !== false) onHit({
					type: this.type,
					hazard: this,
					ball: otherInfo.data
				});
				this._contact(other.parent(), started);
			}
		});
		this.body = body;
		this.colliders = colliders;
		this.mesh = new Mesh(makePartsGeometry(this._parts(this.cfg)), material);
		this.mesh.name = `hazard-${this.type}`;
		scene.add(this.mesh);
		this.render(0);
	}
	_static() {}
	/** Player ball body contact started/ended (subclasses may track riders). */
	_contact() {}
	_fixed(physics, opts) {
		const r = physics.addFixedCuboid({
			friction: .4,
			restitution: .3,
			tag: "hazard-static",
			...opts
		});
		this.staticBodies.push(r.body);
		return r;
	}
	pose(t) {
		return this.constructor.pose(this.cfg, t);
	}
	/** Set the kinematic target for time t (call before the physics step). */
	update(t) {
		const p = this.pose(t);
		this.body.setNextKinematicTranslation(p.position);
		this.body.setNextKinematicRotation(p.rotation);
	}
	/** Pose the mesh for render time t. */
	render(t) {
		const p = this.pose(t);
		this.mesh.position.set(p.position.x, p.position.y, p.position.z);
		this.mesh.quaternion.set(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w);
	}
	dispose() {
		this.mesh.removeFromParent();
		this.mesh.geometry.dispose();
		if (!this.physics.disposed) {
			this.physics.remove(this.body);
			for (const b of this.staticBodies) this.physics.remove(b);
		}
	}
};
//#endregion
//#region src/track/hazards/Hammer.js
var HAMMER_PERIOD = 3.2;
var ARM_Y = .55;
var Hammer = class Hammer extends Hazard {
	static type = "hammer";
	static config(frame, width, params = {}, hazardSpeed = 1) {
		const side = params.side === -1 ? -1 : 1;
		const off = side * (width / 2 + .9);
		const speed = (params.speed ?? 1) * hazardSpeed;
		return {
			side,
			yaw: frame.yaw,
			pivot: {
				x: frame.position.x + frame.right.x * off,
				y: frame.position.y,
				z: frame.position.z + frame.right.z * off
			},
			length: width + 1.4,
			omega: 2 * Math.PI * speed / HAMMER_PERIOD,
			phase: params.phase ?? 0,
			restitution: .4
		};
	}
	/** Opening angle: 0 = across the road, PI/2 = open (along the edge). */
	static angle(cfg, t) {
		return Math.PI / 2 * (.5 + .5 * Math.sin(cfg.omega * t + cfg.phase));
	}
	static pose(cfg, t) {
		const phi = Hammer.angle(cfg, t);
		const psi = cfg.side > 0 ? cfg.yaw + Math.PI - phi : cfg.yaw + phi;
		return {
			position: cfg.pivot,
			rotation: yawQuat(psi)
		};
	}
	_shapes(cfg) {
		const L = cfg.length;
		const armEnd = L - 1.3;
		return [{
			type: "cuboid",
			halfExtents: {
				x: (armEnd - .4) / 2,
				y: .3,
				z: .25
			},
			offset: {
				x: (armEnd + .4) / 2,
				y: ARM_Y,
				z: 0
			}
		}, {
			type: "cuboid",
			halfExtents: {
				x: .65,
				y: .7,
				z: .6
			},
			offset: {
				x: L - .65,
				y: .8,
				z: 0
			}
		}];
	}
	_parts(cfg) {
		const L = cfg.length;
		const armEnd = L - 1.3;
		return [
			{
				box: [
					(armEnd + .4) / 2,
					ARM_Y,
					0
				],
				size: [
					armEnd - .4,
					.6,
					.5
				],
				color: "wood"
			},
			{
				box: [
					L - .65,
					.8,
					0
				],
				size: [
					1.3,
					1.4,
					1.2
				],
				color: "hazard"
			},
			{
				box: [
					L - .65,
					.8,
					0
				],
				size: [
					1.4,
					.3,
					1.3
				],
				color: "white"
			},
			{
				box: [
					0,
					1,
					0
				],
				size: [
					1,
					.5,
					1
				],
				color: "yellow"
			}
		];
	}
	_static(cfg, blocks, physics) {
		const p = cfg.pivot;
		blocks.addBox({
			x: p.x,
			y: p.y + 1.35,
			z: p.z
		}, {
			x: .8,
			y: 2.7,
			z: .8
		}, "metal", { yaw: cfg.yaw });
		blocks.addBox({
			x: p.x,
			y: p.y + 2.85,
			z: p.z
		}, {
			x: 1.1,
			y: .3,
			z: 1.1
		}, "hazard", { yaw: cfg.yaw });
		blocks.addBox({
			x: p.x,
			y: p.y - 3,
			z: p.z
		}, {
			x: .8,
			y: 6,
			z: .8
		}, "pillar", { yaw: cfg.yaw });
		this._fixed(physics, {
			position: {
				x: p.x,
				y: p.y + 1.35,
				z: p.z
			},
			halfExtents: {
				x: .35,
				y: 1.35,
				z: .35
			},
			yaw: cfg.yaw
		});
	}
};
//#endregion
//#region src/track/hazards/WreckingBall.js
var WRECK_PIVOT_HEIGHT = 6.5;
var WRECK_RADIUS = .8;
var WreckingBall = class WreckingBall extends Hazard {
	static type = "wreckingBall";
	static config(frame, width, params = {}, hazardSpeed = 1) {
		const chain = 5.6;
		const speed = (params.speed ?? 1) * hazardSpeed;
		const reach = width / 2 + 1;
		return {
			yaw: frame.yaw,
			forward: { ...frame.forward },
			right: { ...frame.right },
			width,
			pivot: {
				x: frame.position.x,
				y: frame.position.y + WRECK_PIVOT_HEIGHT,
				z: frame.position.z
			},
			chain,
			amplitude: Math.asin(Math.min(.95, reach / chain)),
			omega: Math.sqrt(20 / chain) * speed,
			phase: params.phase ?? 0,
			restitution: .5
		};
	}
	static angle(cfg, t) {
		return cfg.amplitude * Math.sin(cfg.omega * t + cfg.phase);
	}
	static pose(cfg, t) {
		const q = mulQuat(axisAngleQuat(cfg.forward, WreckingBall.angle(cfg, t)), yawQuat(cfg.yaw));
		return {
			position: cfg.pivot,
			rotation: q
		};
	}
	/** World position of the ball's center at time t (for tests / AI). */
	static ballCenter(cfg, t) {
		const th = WreckingBall.angle(cfg, t);
		const f = cfg.forward;
		const down = {
			x: 0,
			y: -cfg.chain,
			z: 0
		};
		const c = Math.cos(th);
		const s = Math.sin(th);
		const cross = {
			x: f.y * down.z - f.z * down.y,
			y: f.z * down.x - f.x * down.z,
			z: f.x * down.y - f.y * down.x
		};
		return {
			x: cfg.pivot.x + down.x * c + cross.x * s,
			y: cfg.pivot.y + down.y * c + cross.y * s,
			z: cfg.pivot.z + down.z * c + cross.z * s
		};
	}
	_shapes(cfg) {
		return [{
			type: "ball",
			radius: WRECK_RADIUS,
			offset: {
				x: 0,
				y: -cfg.chain,
				z: 0
			}
		}];
	}
	_parts(cfg) {
		const parts = [{
			sphere: [
				0,
				-cfg.chain,
				0
			],
			radius: WRECK_RADIUS,
			color: "hazard",
			detail: 1
		}];
		const links = Math.floor((cfg.chain - WRECK_RADIUS) / .45);
		for (let i = 0; i < links; i++) {
			const alt = i % 2;
			parts.push({
				box: [
					0,
					-.25 - i * .45,
					0
				],
				size: alt ? [
					.14,
					.45,
					.3
				] : [
					.3,
					.45,
					.14
				],
				color: "metal"
			});
		}
		parts.push({
			box: [
				0,
				-cfg.chain + WRECK_RADIUS + .05,
				0
			],
			size: [
				.5,
				.2,
				.5
			],
			color: "black"
		});
		return parts;
	}
	_static(cfg, blocks, physics) {
		const hw = cfg.width / 2 + .9 + WRECK_RADIUS;
		const base = cfg.pivot.y - WRECK_PIVOT_HEIGHT;
		const H = 6.9;
		for (const side of [-1, 1]) {
			const x = cfg.pivot.x + cfg.right.x * side * hw;
			const z = cfg.pivot.z + cfg.right.z * side * hw;
			blocks.addBox({
				x,
				y: base + H / 2,
				z
			}, {
				x: .8,
				y: H,
				z: .8
			}, "metal", { yaw: cfg.yaw });
			blocks.addBox({
				x,
				y: base - 3,
				z
			}, {
				x: .8,
				y: 6,
				z: .8
			}, "pillar", { yaw: cfg.yaw });
			this._fixed(physics, {
				position: {
					x,
					y: base + H / 2,
					z
				},
				halfExtents: {
					x: .4,
					y: H / 2,
					z: .4
				},
				yaw: cfg.yaw
			});
		}
		blocks.addBox({
			x: cfg.pivot.x,
			y: base + H + .3,
			z: cfg.pivot.z
		}, {
			x: 2 * hw + .8,
			y: .6,
			z: .8
		}, "hazard", { yaw: cfg.yaw });
	}
};
//#endregion
//#region src/track/hazards/Spinner.js
var SPINNER_OMEGA = 1.3;
var Spinner = class Spinner extends Hazard {
	static type = "spinner";
	static config(frame, width, params = {}, hazardSpeed = 1) {
		const speed = (params.speed ?? 1) * hazardSpeed;
		return {
			yaw: frame.yaw,
			center: { ...frame.position },
			barLength: Math.max(1.5, width - .5),
			omega: SPINNER_OMEGA * speed * (params.dir === -1 ? -1 : 1),
			phase: params.phase ?? 0,
			restitution: .4
		};
	}
	static angle(cfg, t) {
		return cfg.phase + cfg.omega * t;
	}
	static pose(cfg, t) {
		return {
			position: cfg.center,
			rotation: yawQuat(cfg.yaw + Spinner.angle(cfg, t))
		};
	}
	_shapes(cfg) {
		return [{
			type: "cuboid",
			halfExtents: {
				x: cfg.barLength / 2,
				y: .25,
				z: .3
			},
			offset: {
				x: 0,
				y: .5,
				z: 0
			}
		}, {
			type: "cylinder",
			halfHeight: .8,
			radius: .45,
			offset: {
				x: 0,
				y: .8,
				z: 0
			}
		}];
	}
	_parts(cfg) {
		const L = cfg.barLength;
		return [
			{
				box: [
					0,
					.5,
					0
				],
				size: [
					L,
					.5,
					.6
				],
				color: "hazard"
			},
			{
				box: [
					L / 2 - .3,
					.5,
					0
				],
				size: [
					.6,
					.54,
					.64
				],
				color: "white"
			},
			{
				box: [
					-L / 2 + .3,
					.5,
					0
				],
				size: [
					.6,
					.54,
					.64
				],
				color: "white"
			},
			{
				box: [
					0,
					.8,
					0
				],
				size: [
					.9,
					1.6,
					.9
				],
				color: "metal"
			},
			{
				box: [
					0,
					1.7,
					0
				],
				size: [
					1.1,
					.25,
					1.1
				],
				color: "yellow"
			}
		];
	}
};
var PLATFORM_THICKNESS = .6;
//#endregion
//#region src/track/hazards/index.js
var HAZARDS = {
	hammer: Hammer,
	wreckingBall: WreckingBall,
	spinner: Spinner,
	movingPlatform: class MovingPlatform extends Hazard {
		static type = "movingPlatform";
		static reportsHits = false;
		static config(frame, width, params = {}, hazardSpeed = 1) {
			const speed = (params.speed ?? 1) * hazardSpeed;
			const platformWidth = Math.max(2.5, width * .6);
			return {
				yaw: frame.yaw,
				center: { ...frame.position },
				right: { ...frame.right },
				width,
				platformWidth,
				length: params.length ?? 6.9,
				travel: Math.max(0, width / 2 + platformWidth / 2 - .8),
				omega: 2 * Math.PI * speed / 5,
				phase: params.phase ?? 0,
				friction: 1,
				restitution: .05
			};
		}
		/** Lateral offset of the platform center from the road center (m). */
		static offset(cfg, t) {
			return cfg.travel * Math.sin(cfg.omega * t + cfg.phase);
		}
		/** Lateral velocity (m/s) of the platform. */
		static velocity(cfg, t) {
			return cfg.travel * cfg.omega * Math.cos(cfg.omega * t + cfg.phase);
		}
		static pose(cfg, t) {
			const o = MovingPlatform.offset(cfg, t);
			return {
				position: {
					x: cfg.center.x + cfg.right.x * o,
					y: cfg.center.y,
					z: cfg.center.z + cfg.right.z * o
				},
				rotation: yawQuat(cfg.yaw)
			};
		}
		_contact(body, started) {
			if (started && body) (this.known || (this.known = /* @__PURE__ */ new Set())).add(body);
		}
		_isRiding(body, t) {
			const c = this.cfg;
			const p = body.translation();
			const o = MovingPlatform.pose(c, t).position;
			const dx = p.x - o.x;
			const dz = p.z - o.z;
			const lat = dx * c.right.x + dz * c.right.z;
			const along = dx * -c.right.z + dz * c.right.x;
			const h = p.y - o.y;
			return Math.abs(lat) <= c.platformWidth / 2 + .3 && Math.abs(along) <= c.length / 2 + .3 && h > 0 && h < .9;
		}
		update(t) {
			super.update(t);
			const v = MovingPlatform.velocity(this.cfg, t);
			const { right } = this.cfg;
			if (this.known && this.lastT !== void 0) {
				if (!this.riding) this.riding = /* @__PURE__ */ new Set();
				for (const body of this.known) {
					if (!this.physics.bodies.has(body)) {
						this.known.delete(body);
						continue;
					}
					if (!this._isRiding(body, this.lastT)) {
						this.riding.delete(body);
						continue;
					}
					let dv = v - this.lastV;
					if (!this.riding.has(body)) {
						this.riding.add(body);
						const lv = body.linvel();
						dv += this.lastV - (lv.x * right.x + lv.z * right.z);
						const w = body.angvel();
						const fx = -right.z;
						const fz = right.x;
						const k = w.x * fx + w.z * fz;
						body.setAngvel({
							x: w.x - k * fx,
							y: w.y,
							z: w.z - k * fz
						}, true);
					}
					const m = body.mass();
					body.applyImpulse({
						x: right.x * dv * m,
						y: 0,
						z: right.z * dv * m
					}, true);
				}
			}
			this.lastT = t;
			this.lastV = v;
		}
		_shapes(cfg) {
			return [{
				type: "cuboid",
				halfExtents: {
					x: cfg.platformWidth / 2,
					y: PLATFORM_THICKNESS / 2,
					z: cfg.length / 2
				},
				offset: {
					x: 0,
					y: -.6 / 2,
					z: 0
				}
			}];
		}
		_parts(cfg) {
			const w = cfg.platformWidth;
			const L = cfg.length;
			const parts = [{
				box: [
					0,
					-.6 / 2,
					0
				],
				size: [
					w,
					PLATFORM_THICKNESS,
					L
				],
				color: "platform"
			}];
			for (const sx of [-1, 1]) parts.push({
				box: [
					sx * (w / 2 - .15),
					-.29,
					0
				],
				size: [
					.32,
					.64,
					L + .02
				],
				color: "yellow"
			});
			for (const sx of [-1, 1]) {
				parts.push({
					box: [
						sx * .55,
						.02,
						0
					],
					size: [
						.5,
						.06,
						.25
					],
					color: "white"
				});
				parts.push({
					box: [
						sx * .85,
						.02,
						0
					],
					size: [
						.12,
						.06,
						.7
					],
					color: "white"
				});
			}
			return parts;
		}
	}
};
//#endregion
//#region src/track/TrackBuilder.js
var ROAD_THICKNESS = .6;
var RAIL_HEIGHT = .7;
var BUMPER_KICK = 3;
var _c = new Color();
function hashJitter(i, amount = .04) {
	return 1 + ((Math.imul(i + 1, 2654435761) >>> 0) % 1e3 / 1e3 - .5) * 2 * amount;
}
var Track = class extends TrackLayout {
	/**
	* Build meshes, colliders and hazards.
	* @param {object} o {physics, scene, handlers?, palette?='race'}
	*/
	build({ physics, scene, handlers = {}, palette = "race" }) {
		this.physics = physics;
		this.scene = scene;
		this.handlers = handlers;
		this.bodies = [];
		this.hazards = [];
		this.time = 0;
		this.prevTime = 0;
		this.group = new Group();
		this.group.name = "track";
		scene.add(this.group);
		this.blocks = new BlockMesh({ palette });
		this.palette = this.blocks.palette;
		this._buildRoad();
		this._buildRails();
		this._buildPillars();
		this._buildFeatures();
		this.group.add(this.blocks.build());
		return this;
	}
	_keep(r) {
		this.bodies.push(r.body);
		return r;
	}
	_buildRoad() {
		const pos = [];
		const col = [];
		const colliderV = [];
		const colliderI = [];
		const T = ROAD_THICKNESS;
		const pal = this.palette;
		const pushTri = (p1, p2, p3, color) => {
			pos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
			for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
		};
		const pushQuad = (p1, p2, p3, p4, out, colorKey, shade, jitter) => {
			const v = pal[colorKey] ?? colorKey;
			_c.set(v).multiplyScalar(shade * jitter);
			const nx = (p2.y - p1.y) * (p3.z - p1.z) - (p2.z - p1.z) * (p3.y - p1.y);
			const ny = (p2.z - p1.z) * (p3.x - p1.x) - (p2.x - p1.x) * (p3.z - p1.z);
			const nz = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
			if (nx * out.x + ny * out.y + nz * out.z >= 0) {
				pushTri(p1, p2, p3, _c);
				pushTri(p1, p3, p4, _c);
			} else {
				pushTri(p1, p3, p2, _c);
				pushTri(p1, p4, p3, _c);
			}
		};
		const down = (p) => ({
			x: p.x,
			y: p.y - T,
			z: p.z
		});
		const across = (L, R, t) => ({
			x: L.x + (R.x - L.x) * t,
			y: L.y + (R.y - L.y) * t,
			z: L.z + (R.z - L.z) * t
		});
		let lastRow = -1;
		const addRow = (L, R) => {
			colliderV.push(L.x, L.y, L.z, R.x, R.y, R.z);
			return colliderV.length / 3 - 2;
		};
		this.strips.forEach((st, i) => {
			if (!st.floor) {
				lastRow = -1;
				return;
			}
			const rA = rightXZ(st.yawA);
			const rB = rightXZ(st.yawB);
			const hA = st.widthA / 2;
			const hB = st.widthB / 2;
			const aL = {
				x: st.a.x - rA.x * hA,
				y: st.a.y,
				z: st.a.z - rA.z * hA
			};
			const aR = {
				x: st.a.x + rA.x * hA,
				y: st.a.y,
				z: st.a.z + rA.z * hA
			};
			const bL = {
				x: st.b.x - rB.x * hB,
				y: st.b.y,
				z: st.b.z - rB.z * hB
			};
			const bR = {
				x: st.b.x + rB.x * hB,
				y: st.b.y,
				z: st.b.z + rB.z * hB
			};
			const fwd = {
				x: st.b.x - st.a.x,
				y: 0,
				z: st.b.z - st.a.z
			};
			const up = {
				x: 0,
				y: 1,
				z: 0
			};
			const j = hashJitter(i);
			const main = st.color || (Math.floor(st.s0 / 2) % 2 ? "trackAlt" : "track");
			const e = st.edge && Math.min(st.widthA, st.widthB) >= 1.5 ? .3 : 0;
			if (e) {
				const tA = e / st.widthA;
				const tB = e / st.widthB;
				const aL2 = across(aL, aR, tA);
				const aR2 = across(aL, aR, 1 - tA);
				const bL2 = across(bL, bR, tB);
				const bR2 = across(bL, bR, 1 - tB);
				pushQuad(aL, aL2, bL2, bL, up, "edge", 1, 1);
				pushQuad(aL2, aR2, bR2, bL2, up, main, 1, j);
				pushQuad(aR2, aR, bR, bR2, up, "edge", 1, 1);
			} else pushQuad(aL, aR, bR, bL, up, main, 1, j);
			pushQuad(aL, bL, down(bL), down(aL), {
				x: -rA.x,
				y: 0,
				z: -rA.z
			}, e ? "edge" : main, .8, 1);
			pushQuad(aR, bR, down(bR), down(aR), {
				x: rA.x,
				y: 0,
				z: rA.z
			}, e ? "edge" : main, .8, 1);
			pushQuad(down(aL), down(aR), down(bR), down(bL), {
				x: 0,
				y: -1,
				z: 0
			}, e ? "edge" : main, .6, 1);
			if (st.capStart) pushQuad(aL, aR, down(aR), down(aL), {
				x: -fwd.x,
				y: 0,
				z: -fwd.z
			}, e ? "edge" : main, .9, 1);
			if (st.capEnd) pushQuad(bL, bR, down(bR), down(bL), fwd, e ? "edge" : main, .9, 1);
			const rowA = st.capStart || lastRow < 0 ? addRow(aL, aR) : lastRow;
			const rowB = addRow(bL, bR);
			colliderI.push(rowA, rowA + 1, rowB + 1, rowA, rowB + 1, rowB);
			lastRow = st.capEnd ? -1 : rowB;
			for (const [L, R, capOn] of [[
				aL,
				aR,
				st.capStart
			], [
				bL,
				bR,
				st.capEnd
			]]) {
				if (!capOn) continue;
				const base = colliderV.length / 3;
				const dL = down(L);
				const dR = down(R);
				colliderV.push(L.x, L.y, L.z, R.x, R.y, R.z, dR.x, dR.y, dR.z, dL.x, dL.y, dL.z);
				colliderI.push(base, base + 1, base + 2, base, base + 2, base + 3);
			}
		});
		const g = new BufferGeometry();
		g.setAttribute("position", new Float32BufferAttribute(pos, 3));
		g.setAttribute("color", new Float32BufferAttribute(col, 3));
		g.computeVertexNormals();
		g.computeBoundingSphere();
		this.roadMaterial = new MeshLambertMaterial({
			vertexColors: true,
			flatShading: true
		});
		this.roadMesh = new Mesh(g, this.roadMaterial);
		this.roadMesh.name = "road";
		this.group.add(this.roadMesh);
		if (colliderI.length) this.roadCollider = this._keep(this.physics.addFixedTrimesh(new Float32Array(colliderV), new Uint32Array(colliderI), {
			friction: .9,
			restitution: .1,
			tag: "track"
		})).collider;
	}
	_buildRails() {
		const q = new Quaternion();
		const e = new Euler(0, 0, 0, "YXZ");
		const m = new Matrix4();
		const unit = new BoxGeometry(1, 1, 1);
		const up = unit.attributes.position;
		const ui = unit.index.array;
		const v = new Vector3();
		const verts = [];
		const idx = [];
		this.strips.forEach((st) => {
			if (!st.rails || !st.floor) return;
			const rA = rightXZ(st.yawA);
			const rB = rightXZ(st.yawB);
			for (const side of [-1, 1]) {
				const oA = side * (st.widthA / 2 + .15);
				const oB = side * (st.widthB / 2 + .15);
				const pa = {
					x: st.a.x + rA.x * oA,
					y: st.a.y,
					z: st.a.z + rA.z * oA
				};
				const pb = {
					x: st.b.x + rB.x * oB,
					y: st.b.y,
					z: st.b.z + rB.z * oB
				};
				const dx = pb.x - pa.x;
				const dy = pb.y - pa.y;
				const dz = pb.z - pa.z;
				const h = Math.hypot(dx, dz);
				const len = Math.hypot(h, dy);
				e.set(Math.atan2(dy, h), Math.atan2(-dx, -dz), 0);
				q.setFromEuler(e);
				const c = new Vector3((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + RAIL_HEIGHT / 2 - .1, (pa.z + pb.z) / 2);
				const size = new Vector3(.3, .8999999999999999, len + .04);
				const color = Math.floor(st.s0 / 2) % 2 ? "rail" : "railPost";
				this.blocks.addBox(c, size, color, {
					rotation: q.clone(),
					jitter: 0
				});
				m.compose(c, q, size);
				const base = verts.length / 3;
				for (let k = 0; k < up.count; k++) {
					v.fromBufferAttribute(up, k).applyMatrix4(m);
					verts.push(v.x, v.y, v.z);
				}
				for (let k = 0; k < ui.length; k++) idx.push(base + ui[k]);
			}
		});
		unit.dispose();
		if (idx.length) this._keep(this.physics.addFixedTrimesh(new Float32Array(verts), new Uint32Array(idx), {
			friction: .2,
			restitution: .3,
			tag: "rail"
		}));
	}
	_buildPillars() {
		let next = 6;
		for (const st of this.strips) {
			if (st.s0 < next || !st.floor) continue;
			next = st.s0 + 12;
			const h = 30;
			const m = {
				x: (st.a.x + st.b.x) / 2,
				y: Math.min(st.a.y, st.b.y),
				z: (st.a.z + st.b.z) / 2
			};
			this.blocks.addBox({
				x: m.x,
				y: m.y - ROAD_THICKNESS - h / 2,
				z: m.z
			}, {
				x: 1.2,
				y: h,
				z: 1.2
			}, "pillar", { yaw: st.yaw });
		}
	}
	_at(f, lateral = 0, up = 0) {
		return {
			x: f.position.x + f.right.x * lateral,
			y: f.position.y + up,
			z: f.position.z + f.right.z * lateral
		};
	}
	_arch(f, postColor, bannerA, bannerB) {
		const hw = f.width / 2 + .7;
		for (const side of [-1, 1]) {
			const p = this._at(f, side * hw, 2.25);
			this.blocks.addBox(p, {
				x: .8,
				y: 4.5,
				z: .8
			}, postColor, { yaw: f.yaw });
			this._keep(this.physics.addFixedCuboid({
				position: p,
				halfExtents: {
					x: .4,
					y: 2.25,
					z: .4
				},
				yaw: f.yaw,
				tag: "rail"
			}));
		}
		const n = Math.max(4, Math.round(hw * 2));
		for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
			const off = -hw + (i + .5) * 2 * hw / n;
			this.blocks.addBox(this._at(f, off, 4.75 + j * .5), {
				x: 2 * hw / n,
				y: .5,
				z: .6
			}, (i + j) % 2 ? bannerB : bannerA, {
				yaw: f.yaw,
				jitter: 0
			});
		}
	}
	_floorBand(f, rows, colorA, colorB) {
		const n = Math.max(2, Math.round(f.width));
		for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
			const off = -f.width / 2 + (i + .5) * f.width / n;
			const p = this._at(f, off, .015);
			const fw = (r - (rows - 1) / 2) * .6;
			p.x += f.forward.x * fw;
			p.z += f.forward.z * fw;
			this.blocks.addBox(p, {
				x: f.width / n,
				y: .03,
				z: .6
			}, (i + r) % 2 ? colorB : colorA, {
				yaw: f.yaw,
				jitter: 0
			});
		}
	}
	_sensorAcross(f, depth, onEnter) {
		this._keep(this.physics.addSensorCuboid({
			position: this._at(f, 0, 2),
			halfExtents: {
				x: f.width / 2 + .5,
				y: 2.5,
				z: depth / 2
			},
			yaw: f.yaw,
			tag: "sensor",
			onCollide: ({ otherInfo, started }) => {
				if (started && otherInfo?.tag === "ball") onEnter(otherInfo.data);
			}
		}));
	}
	_buildFeatures() {
		const h = this.handlers;
		const hazardMaterial = this.hazardMaterial = makeHazardMaterial();
		for (const f of this.features) switch (f.type) {
			case "checkpoint":
				if (!f.start) {
					this._arch(f, "checkpoint", "checkpoint", "white");
					this._floorBand(f, 1, "checkpoint", "white");
				}
				this._sensorAcross(f, 1, (ball) => h.onCheckpoint?.(f, ball));
				break;
			case "finish":
				this._arch(f, "white", "finish", "finishDark");
				this._floorBand(f, 2, "finish", "finishDark");
				this._sensorAcross(f, 1, (ball) => h.onFinish?.(f, ball));
				break;
			case "startLine":
				this._floorBand(f, 1, "white", "finishDark");
				break;
			case "boost":
				this._buildBoost(f);
				break;
			case "bumper":
				this._buildBumper(f);
				break;
			case "wall":
				this._buildWall(f);
				break;
			case "hazard": {
				const Cls = HAZARDS[f.hazard];
				if (!Cls) break;
				const hz = new Cls({
					physics: this.physics,
					scene: this.group,
					frame: f,
					params: f.params,
					hazardSpeed: this.options.hazardSpeed,
					material: hazardMaterial,
					blocks: this.blocks,
					onHit: (info) => h.onHazardHit?.(info)
				});
				this.hazards.push(hz);
				this.bodies.push(hz.body, ...hz.staticBodies);
				break;
			}
		}
	}
	_buildBoost(f) {
		const zone = this.boostZones.find((z) => z.feature === f);
		const n = Math.max(2, Math.round(f.len / 1.3));
		const arm = Math.min(1.6, f.width * .28);
		for (let i = 0; i < n; i++) {
			const along = -f.len / 2 + (i + .5) * (f.len / n);
			for (const side of [-1, 1]) {
				const lat = side * arm * .42;
				const p = this._at(f, lat, .02);
				p.x += f.forward.x * (along - .25);
				p.z += f.forward.z * (along - .25);
				const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), f.yaw - side * .9);
				this.blocks.addBox(p, {
					x: arm,
					y: .04,
					z: .35
				}, "boost", {
					rotation: q,
					jitter: 0
				});
			}
		}
		const center = this._at(f, 0, .75);
		this._keep(this.physics.addSensorCuboid({
			position: center,
			halfExtents: {
				x: f.width / 2,
				y: .9,
				z: f.len / 2
			},
			yaw: f.yaw,
			tag: "boost",
			data: zone,
			onCollide: ({ otherInfo, started }) => {
				if (!started || otherInfo?.tag !== "ball") return;
				const ball = otherInfo.data;
				if (this.handlers.onBoost) this.handlers.onBoost(zone, ball);
				else ball?.boost?.(8, f.forward);
			}
		}));
	}
	_buildBumper(f) {
		const half = f.half ?? .45;
		const H = 1.1;
		const p = this._at(f, f.lateral, H / 2);
		const rot = yawQuat(f.yaw + Math.PI / 4);
		this.blocks.addBox(p, {
			x: half * 2,
			y: H,
			z: half * 2
		}, "bumper", { rotation: rot });
		this.blocks.addBox({
			x: p.x,
			y: p.y + H / 2 + .1,
			z: p.z
		}, {
			x: half * 2 - .2,
			y: .2,
			z: half * 2 - .2
		}, "white", {
			rotation: rot,
			jitter: 0
		});
		this._keep(this.physics.addFixedCuboid({
			position: p,
			halfExtents: {
				x: half,
				y: H / 2,
				z: half
			},
			rotation: rot,
			friction: .2,
			restitution: .9,
			tag: "bumper",
			events: true,
			onCollide: ({ otherInfo, started }) => {
				if (!started || otherInfo?.tag !== "ball") return;
				const ball = otherInfo.data;
				if (ball?.body) {
					const t = ball.body.translation();
					const dx = t.x - p.x;
					const dz = t.z - p.z;
					const d = Math.hypot(dx, dz) || 1;
					ball.push({
						x: dx / d * BUMPER_KICK,
						y: .6,
						z: dz / d * BUMPER_KICK
					});
				}
				this.handlers.onBumper?.(ball);
			}
		}));
	}
	_buildWall(f) {
		const w = f.width + .6;
		const p = this._at(f, 0, .6);
		this.blocks.addBox(p, {
			x: w,
			y: 1.2,
			z: .6
		}, "bumper", { yaw: f.yaw });
		this._keep(this.physics.addFixedCuboid({
			position: p,
			halfExtents: {
				x: w / 2,
				y: .6,
				z: .3
			},
			yaw: f.yaw,
			restitution: .5,
			tag: "bumper",
			events: true,
			onCollide: ({ otherInfo, started }) => {
				if (started && otherInfo?.tag === "ball") this.handlers.onBumper?.(otherInfo.data);
			}
		}));
	}
	/** Advance hazard time and set kinematic targets. Call before physics.step. */
	update(dt) {
		this.prevTime = this.time;
		this.time += dt;
		for (const h of this.hazards) h.update(this.time);
	}
	/** Pose hazard meshes between the last two steps (alpha ∈ [0,1]). */
	render(alpha = 1) {
		const t = this.prevTime + (this.time - this.prevTime) * alpha;
		for (const h of this.hazards) h.render(t);
	}
	/** Jump hazards to time t (e.g. restart). */
	setTime(t) {
		this.time = this.prevTime = t;
		for (const h of this.hazards) {
			const p = h.pose(t);
			h.body.setTranslation(p.position, true);
			h.body.setRotation(p.rotation, true);
			h.render(t);
		}
	}
	dispose() {
		for (const h of this.hazards || []) h.dispose();
		this.hazards = [];
		if (this.physics && !this.physics.disposed) {
			const seen = /* @__PURE__ */ new Set();
			for (const b of this.bodies || []) {
				if (seen.has(b)) continue;
				seen.add(b);
				if (this.physics.bodies.has(b)) this.physics.remove(b);
			}
		}
		this.bodies = [];
		this.blocks?.dispose();
		this.roadMesh?.geometry.dispose();
		this.roadMaterial?.dispose();
		this.hazardMaterial?.dispose();
		this.group?.removeFromParent();
	}
};
/**
* Lay out and build a track.
* @param {object} o
* @param {object} o.physics
* @param {THREE.Object3D} o.scene
* @param {Array<string|object>} o.pieces piece ids or {id, ...params}
* @param {object} [o.options] {width, rails, hazardSpeed, start}
* @param {object} [o.handlers]
* @returns {Track}
*/
function buildTrack({ physics, scene, pieces, options = {}, handlers = {}, palette }) {
	return new Track(pieces, options).build({
		physics,
		scene,
		handlers,
		palette
	});
}
//#endregion
export { TrackLayout as n, buildTrack as t };
