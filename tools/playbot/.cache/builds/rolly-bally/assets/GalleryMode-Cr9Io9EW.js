import { C as LineSegments, D as MeshBasicMaterial, E as Mesh, N as Vector3, S as LineBasicMaterial, _ as Float32BufferAttribute, d as BufferGeometry, p as Color, u as BufferAttribute, v as Group, x as Line, y as IcosahedronGeometry } from "./index-Cs7XvCIe.js";
import { i as hasPiece, t as PIECES } from "./Catalog-CUbTmyD8.js";
import { r as Ball, t as ChaseCamera } from "./ChaseCamera-CIJzGBRJ.js";
import { t as buildTrack } from "./TrackBuilder-C-0t_KFI.js";
//#region src/track-gallery/icons.js
var GALLERY_ICONS = {
	prev: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M44 10 L16 32 L44 54 Z" fill="currentColor"/></svg>`,
	next: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M20 10 L48 32 L20 54 Z" fill="currentColor"/></svg>`,
	width: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M6 32 H58" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <path d="M16 20 L4 32 L16 44 M48 20 L60 32 L48 44" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
	rails: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M8 18 V52 M24 18 V52 M40 18 V52 M56 18 V52" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <path d="M4 26 H60 M4 42 H60" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  </svg>`,
	eye: `<svg class="icon" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M4 32 Q32 4 60 32 Q32 60 4 32 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="9" fill="currentColor"/>
  </svg>`
};
//#endregion
//#region src/track-gallery/GalleryMode.js
var WIDTHS = [
	8,
	6,
	5,
	4,
	3
];
var RAILS = [
	"full",
	"curves",
	"none"
];
var GHOST_SPEED = 5;
/** The piece in context: a lead-in (with a boost before a launch) and a run-out. */
function galleryPieces(id) {
	const before = id === "start" ? [] : id === "launch" ? [{
		id: "straight",
		len: 6
	}, "boost"] : [{
		id: "straight",
		len: 8
	}];
	const after = id === "finish" ? [] : [{
		id: "straight",
		len: 8
	}, "finish"];
	return {
		list: [
			...before,
			id,
			...after
		],
		focus: before.length
	};
}
var GalleryMode = class {
	async start(ctx, config) {
		this.ctx = ctx;
		const raw = ctx.params?.raw || {};
		const pieceId = config.piece && hasPiece(config.piece) ? config.piece : raw.piece && hasPiece(raw.piece) ? raw.piece : PIECES[0].id;
		this.index = PIECES.findIndex((p) => p.id === pieceId);
		const w = Number(raw.w);
		this.widthIndex = Math.max(0, WIDTHS.indexOf(WIDTHS.includes(w) ? w : 8));
		this.railsIndex = Math.max(0, RAILS.indexOf(raw.rails));
		this.overlayOn = raw.overlay !== "0";
		this.hits = 0;
		this._tmp = new Vector3();
		this._fwd = new Vector3(0, 0, -1);
		this._aheadF = new Vector3();
		this.s = 0;
		this.falling = 0;
		this.ghostS = 0;
		this.ball = new Ball({
			physics: ctx.physics,
			scene: ctx.scene,
			position: {
				x: 0,
				y: 1,
				z: 0
			},
			skin: ctx.save.get().skins.selected
		});
		this.ball.setTuning({
			speedCap: Number(raw.cap) || 10,
			autoRoll: raw.auto === "1"
		});
		this.cam = new ChaseCamera(ctx.camera, { mode: "track" });
		this._buildHud();
		this._rebuild();
		this._onKey = (e) => this._key(e);
		window.addEventListener("keydown", this._onKey);
		ctx.debug.watch("piece", () => `${this.focus?.id} ${(this.s - (this.focus?.s0 ?? 0)).toFixed(1)}m`);
		ctx.debug.watch("lat", () => this._near?.lateral?.toFixed(2));
		ctx.debug.watch("speed", () => this.ball.speed);
		ctx.debug.watch("hits", () => this.hits);
	}
	_rebuild() {
		const { ctx } = this;
		this.track?.dispose();
		this._disposeOverlay();
		const piece = PIECES[this.index];
		const { list, focus } = galleryPieces(piece.id);
		const sfx = (name) => ctx.audio.play(name);
		this.track = buildTrack({
			physics: ctx.physics,
			scene: ctx.scene,
			pieces: list,
			options: {
				width: WIDTHS[this.widthIndex],
				rails: RAILS[this.railsIndex]
			},
			handlers: {
				onBoost: (zone, ball) => {
					ball.boost(8, zone.feature.forward);
					sfx("whoosh");
				},
				onBumper: () => sfx("boing"),
				onCheckpoint: (c) => {
					if (!c.start) sfx("beep");
				},
				onFinish: () => sfx("fanfare"),
				onHazardHit: () => {
					this.hits++;
					sfx("thump");
				}
			}
		});
		this.focus = this.track.pieces[focus];
		this._buildOverlay();
		this._updateHud();
		this.respawn(true);
	}
	_spawn() {
		const t = this.track;
		if (this.focus.id === "start") {
			const slot = t.startSlots[0];
			return {
				position: slot.position,
				forward: slot.forward,
				s: slot.s
			};
		}
		return t.respawnAt(t.checkpoints[0]);
	}
	_buildOverlay() {
		const { spline } = this.track;
		const t = this.track;
		const lift = .06;
		const pts = [];
		const cols = [];
		const onColor = new Color("#ff00c8");
		const offColor = new Color("#222222");
		for (let s = 0; s <= spline.length; s += .5) {
			const p = spline.positionAt(s);
			pts.push(p.x, p.y + lift, p.z);
			const c = s >= this.focus.s0 && s <= this.focus.s1 ? onColor : offColor;
			cols.push(c.r, c.g, c.b);
		}
		const g = new BufferGeometry();
		g.setAttribute("position", new Float32BufferAttribute(pts, 3));
		g.setAttribute("color", new Float32BufferAttribute(cols, 3));
		const line = new Line(g, new LineBasicMaterial({
			vertexColors: true,
			depthTest: false,
			transparent: true
		}));
		line.renderOrder = 10;
		const lanePts = [];
		const r = {
			x: 0,
			y: 0,
			z: 0
		};
		const lane = {
			min: 0,
			max: 0
		};
		for (const key of ["min", "max"]) {
			let prev = null;
			for (let s = 0; s <= spline.length; s += .5) {
				const p = spline.positionAt(s);
				spline.rightAt(s, r);
				t.laneAt(s, lane);
				const q = [
					p.x + r.x * lane[key],
					p.y + lift,
					p.z + r.z * lane[key]
				];
				if (prev) lanePts.push(...prev, ...q);
				prev = q;
			}
		}
		const lg = new BufferGeometry();
		lg.setAttribute("position", new Float32BufferAttribute(lanePts, 3));
		const lanes = new LineSegments(lg, new LineBasicMaterial({
			color: 58879,
			depthTest: false,
			transparent: true
		}));
		lanes.renderOrder = 10;
		const wg = new BufferGeometry();
		const wire = new LineSegments(wg, new LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			opacity: .8
		}));
		wire.frustumCulled = false;
		wire.renderOrder = 11;
		const ghost = new Mesh(new IcosahedronGeometry(.5, 1), new MeshBasicMaterial({
			color: 58879,
			transparent: true,
			opacity: .45,
			depthWrite: false
		}));
		this.overlay = new Group();
		this.overlay.name = "gallery-overlay";
		this.overlay.add(line, lanes, wire, ghost);
		this.wire = wire;
		this.ghost = ghost;
		this.overlay.visible = this.overlayOn;
		this.ctx.scene.add(this.overlay);
	}
	_refreshWire() {
		const { vertices, colors } = this.ctx.physics.world.debugRender();
		const g = this.wire.geometry;
		const n = vertices.length / 3;
		const rgb = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) {
			rgb[i * 3] = colors[i * 4];
			rgb[i * 3 + 1] = colors[i * 4 + 1];
			rgb[i * 3 + 2] = colors[i * 4 + 2];
		}
		g.setAttribute("position", new BufferAttribute(vertices, 3));
		g.setAttribute("color", new BufferAttribute(rgb, 3));
	}
	_disposeOverlay() {
		if (!this.overlay) return;
		this.overlay.traverse((o) => {
			o.geometry?.dispose();
			o.material?.dispose();
		});
		this.overlay.removeFromParent();
		this.overlay = null;
	}
	_buildHud() {
		const ui = this.ctx.ui;
		this.caption = document.createElement("div");
		this.caption.className = "gal-caption rb-caption";
		ui.appendChild(this.caption);
		const bar = document.createElement("div");
		bar.className = "gal-buttons";
		const mk = (icon, color, label, onTap) => {
			const b = document.createElement("button");
			b.className = `rb-btn rb-btn--round rb-btn--${color}`;
			b.setAttribute("aria-label", label);
			b.innerHTML = icon;
			b.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				onTap();
				this.ctx.audio.play("click");
			});
			bar.appendChild(b);
			return b;
		};
		this.btnOverlay = mk(GALLERY_ICONS.eye, "white", "Show colliders", () => this.toggleOverlay());
		this.btnRails = mk(GALLERY_ICONS.rails, "red", "Rails", () => this.cycleRails());
		this.btnWidth = mk(GALLERY_ICONS.width, "yellow", "Width", () => this.cycleWidth());
		mk(GALLERY_ICONS.prev, "blue", "Previous piece", () => this.prevPiece());
		mk(GALLERY_ICONS.next, "green", "Next piece", () => this.nextPiece());
		for (const b of [this.btnRails, this.btnWidth]) {
			const badge = document.createElement("span");
			badge.className = "gal-badge";
			b.appendChild(badge);
		}
		ui.appendChild(bar);
	}
	_updateHud() {
		const p = PIECES[this.index];
		this.caption.innerHTML = `${p.name}<small>${this.index + 1}/${PIECES.length} · ${p.id} · width ${WIDTHS[this.widthIndex]} · rails ${RAILS[this.railsIndex]}</small>`;
		this.btnWidth.querySelector(".gal-badge").textContent = WIDTHS[this.widthIndex];
		this.btnRails.querySelector(".gal-badge").textContent = RAILS[this.railsIndex][0].toUpperCase();
		this.btnOverlay.setAttribute("aria-pressed", String(this.overlayOn));
	}
	_key(e) {
		if (e.repeat) return;
		const debug = this.ctx.debug.enabled;
		const k = e.key.toLowerCase();
		if (k === "arrowright" || k === "n" && !debug) this.nextPiece();
		else if (k === "arrowleft" || k === "p") this.prevPiece();
		else if (k === "w" && !e.metaKey && !e.ctrlKey) this.cycleWidth();
		else if (k === "l") this.cycleRails();
		else if (k === "o") this.toggleOverlay();
		else if (k === "r" && !debug) this.respawn();
	}
	nextPiece() {
		this.index = (this.index + 1) % PIECES.length;
		this._rebuild();
	}
	prevPiece() {
		this.index = (this.index - 1 + PIECES.length) % PIECES.length;
		this._rebuild();
	}
	cycleWidth() {
		this.widthIndex = (this.widthIndex + 1) % WIDTHS.length;
		this._rebuild();
	}
	/** Debug G: same as the width button. */
	regenerate() {
		this.cycleWidth();
	}
	cycleRails() {
		this.railsIndex = (this.railsIndex + 1) % RAILS.length;
		this._rebuild();
	}
	toggleOverlay() {
		this.overlayOn = !this.overlayOn;
		if (this.overlay) this.overlay.visible = this.overlayOn;
		this._updateHud();
	}
	respawn(silent = false) {
		const sp = this._spawn();
		this._fwd.set(sp.forward.x, 0, sp.forward.z);
		this.s = sp.s;
		this.falling = 0;
		this.ball.respawn(sp.position, this._fwd);
		this.cam.snap(sp.position, this._fwd);
		this.ghostS = sp.s;
		if (!silent) this.ctx.audio.play("boing");
	}
	update(dt) {
		const t = this.track;
		t.update(dt);
		const pos = this.ball.getPosition(this._tmp);
		const near = t.nearest(pos, this.s);
		this._near = near;
		if (near.dist < 8) this.s = near.s;
		t.spline.forwardAt(Math.min(t.length, this.s + 3), this._aheadF);
		this._fwd.lerp(this._aheadF, .08).normalize();
		this.cam.setForward(this._fwd);
		this.ball.update(dt, this.ctx.input.getMove(), this._fwd);
		if (!this.falling && near.height < -8) this.falling = .6;
		if (this.falling) {
			this.falling -= dt;
			if (this.falling <= 0) this.respawn();
		}
		this.ghostS += GHOST_SPEED * dt;
		if (this.ghostS > t.length) this.ghostS = 0;
	}
	render(alpha, frameDt) {
		const look = this.ctx.input.consumeLook();
		if (look.dx || look.dy) this.cam.addLook(look.dx, look.dy);
		this.track.render(alpha);
		this.ball.render(alpha, frameDt);
		this.cam.update(Math.min(frameDt, .1), {
			position: this.ball.position,
			velocity: this.ball.velocity
		});
		if (this.overlay?.visible) {
			this._refreshWire();
			const lane = Math.sin(this.track.time * .7);
			const p = this.track.aiPointAt(this.ghostS, lane);
			this.ghost.position.set(p.x, p.y + .5, p.z);
		}
	}
	dispose() {
		window.removeEventListener("keydown", this._onKey);
		this.track?.dispose();
		this._disposeOverlay();
		this.ball?.dispose();
	}
};
//#endregion
export { GalleryMode as default, galleryPieces };
