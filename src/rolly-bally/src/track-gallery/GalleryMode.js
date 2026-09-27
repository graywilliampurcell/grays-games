// Track piece gallery (?gallery=1[&piece=hammer][&w=6][&rails=curves][&auto=1][&cap=10]).
// Shows one catalog piece at a time with a short lead-in and run-out, the
// center-line spline, the AI safe lanes, a ghost AI ball and a wireframe of
// every physics collider. Roll the ball on it to feel it.
//
// Buttons (bottom-right): previous / next piece, width, rails, overlay.
// Keys: ←/→ (or P/N) piece, W width, L rails, O overlay, R respawn.

import * as THREE from 'three';
import './gallery.css';
import { Ball } from '../ball/Ball.js';
import { ChaseCamera } from '../core/ChaseCamera.js';
import { buildTrack } from '../track/TrackBuilder.js';
import { PIECES, hasPiece } from '../track/Catalog.js';
import { GALLERY_ICONS } from './icons.js';

const WIDTHS = [8, 6, 5, 4, 3];
const RAILS = ['full', 'curves', 'none'];
const FALL_DEPTH = 8;
const GHOST_SPEED = 5; // m/s

/** The piece in context: a lead-in (with a boost before a launch) and a run-out. */
export function galleryPieces(id) {
  const before = id === 'start' ? [] : id === 'launch' ? [{ id: 'straight', len: 6 }, 'boost'] : [{ id: 'straight', len: 8 }];
  const after = id === 'finish' ? [] : [{ id: 'straight', len: 8 }, 'finish'];
  return { list: [...before, id, ...after], focus: before.length };
}

export default class GalleryMode {
  async start(ctx, config) {
    this.ctx = ctx;
    const raw = ctx.params?.raw || {};
    const pieceId = config.piece && hasPiece(config.piece) ? config.piece : raw.piece && hasPiece(raw.piece) ? raw.piece : PIECES[0].id;
    this.index = PIECES.findIndex((p) => p.id === pieceId);
    const w = Number(raw.w);
    this.widthIndex = Math.max(0, WIDTHS.indexOf(WIDTHS.includes(w) ? w : 8));
    this.railsIndex = Math.max(0, RAILS.indexOf(raw.rails));
    this.overlayOn = raw.overlay !== '0';
    this.hits = 0;

    this._tmp = new THREE.Vector3();
    this._fwd = new THREE.Vector3(0, 0, -1);
    this._aheadF = new THREE.Vector3();
    this.s = 0;
    this.falling = 0;
    this.ghostS = 0;

    this.ball = new Ball({ physics: ctx.physics, scene: ctx.scene, position: { x: 0, y: 1, z: 0 }, skin: ctx.save.get().skins.selected });
    this.ball.setTuning({ speedCap: Number(raw.cap) || 10, autoRoll: raw.auto === '1' });
    this.cam = new ChaseCamera(ctx.camera, { mode: 'track' });

    this._buildHud();
    this._rebuild();

    this._onKey = (e) => this._key(e);
    window.addEventListener('keydown', this._onKey);

    ctx.debug.watch('piece', () => `${this.focus?.id} ${(this.s - (this.focus?.s0 ?? 0)).toFixed(1)}m`);
    ctx.debug.watch('lat', () => this._near?.lateral?.toFixed(2));
    ctx.debug.watch('speed', () => this.ball.speed);
    ctx.debug.watch('hits', () => this.hits);
  }

  // ------------------------------------------------------------ build

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
      options: { width: WIDTHS[this.widthIndex], rails: RAILS[this.railsIndex] },
      handlers: {
        onBoost: (zone, ball) => {
          ball.boost(8, zone.feature.forward);
          sfx('whoosh');
        },
        onBumper: () => sfx('boing'),
        onCheckpoint: (c) => {
          if (!c.start) sfx('beep');
        },
        onFinish: () => sfx('fanfare'),
        onHazardHit: () => {
          this.hits++;
          sfx('thump');
        },
      },
    });
    this.focus = this.track.pieces[focus];
    this._buildOverlay();
    this._updateHud();
    this.respawn(true);
  }

  _spawn() {
    const t = this.track;
    if (this.focus.id === 'start') {
      const slot = t.startSlots[0];
      return { position: slot.position, forward: slot.forward, s: slot.s };
    }
    return t.respawnAt(t.checkpoints[0]);
  }

  _buildOverlay() {
    const { spline } = this.track;
    const t = this.track;
    const lift = 0.06;
    const pts = [];
    const cols = [];
    const onColor = new THREE.Color('#ff00c8');
    const offColor = new THREE.Color('#222222');
    for (let s = 0; s <= spline.length; s += 0.5) {
      const p = spline.positionAt(s);
      pts.push(p.x, p.y + lift, p.z);
      const c = s >= this.focus.s0 && s <= this.focus.s1 ? onColor : offColor;
      cols.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    line.renderOrder = 10;

    // AI safe lanes (the edges of laneAt).
    const lanePts = [];
    const r = { x: 0, y: 0, z: 0 };
    const lane = { min: 0, max: 0 };
    for (const key of ['min', 'max']) {
      let prev = null;
      for (let s = 0; s <= spline.length; s += 0.5) {
        const p = spline.positionAt(s);
        spline.rightAt(s, r);
        t.laneAt(s, lane);
        const q = [p.x + r.x * lane[key], p.y + lift, p.z + r.z * lane[key]];
        if (prev) lanePts.push(...prev, ...q);
        prev = q;
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lanePts, 3));
    const lanes = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x00e5ff, depthTest: false, transparent: true }));
    lanes.renderOrder = 10;

    // Collider wireframe (refreshed each frame so hazards move).
    const wg = new THREE.BufferGeometry();
    const wire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }));
    wire.frustumCulled = false;
    wire.renderOrder = 11;

    // Ghost AI ball following the lane center with a slow weave.
    const ghost = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 1),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.45, depthWrite: false }),
    );

    this.overlay = new THREE.Group();
    this.overlay.name = 'gallery-overlay';
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
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
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

  // ------------------------------------------------------------ HUD

  _buildHud() {
    const ui = this.ctx.ui;
    this.caption = document.createElement('div');
    this.caption.className = 'gal-caption rb-caption';
    ui.appendChild(this.caption);

    const bar = document.createElement('div');
    bar.className = 'gal-buttons';
    const mk = (icon, color, label, onTap) => {
      const b = document.createElement('button');
      b.className = `rb-btn rb-btn--round rb-btn--${color}`;
      b.setAttribute('aria-label', label);
      b.innerHTML = icon;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTap();
        this.ctx.audio.play('click');
      });
      bar.appendChild(b);
      return b;
    };
    this.btnOverlay = mk(GALLERY_ICONS.eye, 'white', 'Show colliders', () => this.toggleOverlay());
    this.btnRails = mk(GALLERY_ICONS.rails, 'red', 'Rails', () => this.cycleRails());
    this.btnWidth = mk(GALLERY_ICONS.width, 'yellow', 'Width', () => this.cycleWidth());
    mk(GALLERY_ICONS.prev, 'blue', 'Previous piece', () => this.prevPiece());
    mk(GALLERY_ICONS.next, 'green', 'Next piece', () => this.nextPiece());
    for (const b of [this.btnRails, this.btnWidth]) {
      const badge = document.createElement('span');
      badge.className = 'gal-badge';
      b.appendChild(badge);
    }
    ui.appendChild(bar);
  }

  _updateHud() {
    const p = PIECES[this.index];
    this.caption.innerHTML = `${p.name}<small>${this.index + 1}/${PIECES.length} · ${p.id} · width ${WIDTHS[this.widthIndex]} · rails ${RAILS[this.railsIndex]}</small>`;
    this.btnWidth.querySelector('.gal-badge').textContent = WIDTHS[this.widthIndex];
    this.btnRails.querySelector('.gal-badge').textContent = RAILS[this.railsIndex][0].toUpperCase();
    this.btnOverlay.setAttribute('aria-pressed', String(this.overlayOn));
  }

  _key(e) {
    if (e.repeat) return;
    const debug = this.ctx.debug.enabled; // the host already maps R/N/G in debug
    const k = e.key.toLowerCase();
    if (k === 'arrowright' || (k === 'n' && !debug)) this.nextPiece();
    else if (k === 'arrowleft' || k === 'p') this.prevPiece();
    else if (k === 'w' && !e.metaKey && !e.ctrlKey) this.cycleWidth();
    else if (k === 'l') this.cycleRails();
    else if (k === 'o') this.toggleOverlay();
    else if (k === 'r' && !debug) this.respawn();
  }

  // ------------------------------------------------------------ actions

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
    if (!silent) this.ctx.audio.play('boing');
  }

  // ------------------------------------------------------------ loop

  update(dt) {
    const t = this.track;
    t.update(dt);
    const pos = this.ball.getPosition(this._tmp);
    const near = t.nearest(pos, this.s);
    this._near = near;
    if (near.dist < 8) this.s = near.s;

    t.spline.forwardAt(Math.min(t.length, this.s + 3), this._aheadF);
    this._fwd.lerp(this._aheadF, 0.08).normalize();
    this.cam.setForward(this._fwd);
    this.ball.update(dt, this.ctx.input.getMove(), this._fwd);

    if (!this.falling && near.height < -FALL_DEPTH) this.falling = 0.6;
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
    this.cam.update(Math.min(frameDt, 0.1), { position: this.ball.position, velocity: this.ball.velocity });
    if (this.overlay?.visible) {
      this._refreshWire();
      const lane = Math.sin(this.track.time * 0.7);
      const p = this.track.aiPointAt(this.ghostS, lane);
      this.ghost.position.set(p.x, p.y + 0.5, p.z);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    this.track?.dispose();
    this._disposeOverlay();
    this.ball?.dispose();
  }
}
