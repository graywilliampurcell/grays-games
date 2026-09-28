// Test-only bot hook: window.__game (tools/playbot/HOOK_CONTRACT.md).
// Loaded by main.js only when the URL has ?test=1; nothing here runs otherwise.
//
// It WRAPS the existing app (window.rollyBally from ?debug=1, the Loop, Input,
// modes' own events) rather than changing them:
//   - Game.loop.tick → draw only (no simulation) unless setRealtime(true).
//   - __game.step(n) runs n fixed 1/60 s updates (Game._update + mode.render
//     with dt = 1/60, exactly what a 60 fps frame does), then draws once.
//   - Input.update → the bot's setInput() vector replaces keys/touch/gamepad.
//   - debug.watch/set fields are recorded (state().debug) without the overlay;
//     R/N/G hotkeys work as with ?debug=1.
//
// URL: ?test=1 plus the usual ?mode=race|playground|test-track|gallery (or
// ?gallery=1), &seed=, &d=, &n=, &race=, playground &size= &theme= &bump= &stuff= &stars=.
// Without ?mode= the Home screen opens (bot taps through it).

import { PIECES } from '../track/Catalog.js';
import { nearestStrip, forwardOf } from '../test-track/pathBuilder.js';
import { TEST_DT, vec, round, plain, normalizeTestInput, samplePolyline, arcLengths, EventLog } from './testHookUtils.js';

export function installTestHooks(app) {
  const { game, input, router, events: bus, debug } = app;
  let simTime = 0;
  let realtime = false;
  let testInput = null; // normalized {x, y, jump, active} or null = real devices
  const log = new EventLog(() => simTime);
  const ttCache = new WeakMap(); // test-track mode → centerline

  // ------------------------------------------------------------ debug fields without the overlay
  if (!debug.enabled) {
    debug.set = (k, v) => debug.fields.set(k, v);
    debug.watch = (k, fn) => debug.fields.set(k, fn);
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'r') debugAction('respawn');
      else if (k === 'n') debugAction('nextPiece');
      else if (k === 'g') debugAction('regenerate');
    });
  }

  // ------------------------------------------------------------ input
  const origInputUpdate = input.update.bind(input);
  input.update = () => {
    origInputUpdate();
    if (testInput && input.enabled) {
      input.move = { x: testInput.x, y: testInput.y };
      input.source = testInput.active ? 'test' : 'none';
    }
    return input.move;
  };

  // ------------------------------------------------------------ loop: RAF draws only
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

  // ------------------------------------------------------------ events
  let watched = { mode: null };

  const origRun = game.runMode.bind(game);
  game.runMode = async (name, config, opts) => {
    const mode = await origRun(name, config, opts);
    attach(mode, name);
    log.push('start', { mode: name, seed: mode?.config?.seed ?? game.ctx?.config?.seed ?? null });
    return mode;
  };

  const origGo = router.go.bind(router);
  router.go = (name, params) => {
    const p = origGo(name, params);
    p.then(() => log.push('screen', { name: router.current?.name ?? name }));
    return p;
  };

  bus.on('starCollected', (p) => log.push('star', p));
  bus.on('raceFinished', (p) => log.push('raceFinished', p));
  bus.on('seriesComplete', (p) => log.push('seriesComplete', p));

  function attach(mode, name) {
    watched = { mode, name };
    if (!mode) return;
    if (name === 'race' && mode._onSimEvent) {
      const orig = mode._onSimEvent.bind(mode);
      mode._onSimEvent = (ev, data) => {
        const d = {};
        if (ev === 'checkpoint') Object.assign(d, { index: data.checkpoint.index, s: data.checkpoint.s });
        else if (ev === 'respawn') d.pos = data.position;
        else if (ev === 'finish') d.place = data.place;
        else if (ev === 'hazard') d.hazard = data;
        else if (ev === 'aiFinish') d.racer = mode.sim?.racers.indexOf(data.racer);
        log.push(ev, d);
        if (ev === 'fall') log.push('fail', { reason: mode.sim?.fallStuck ? 'stuck' : 'fall' });
        if (ev === 'finish') log.push('win', { place: data.place });
        orig(ev, data);
      };
    }
    if ((name === 'test-track' || name === 'playground' || name === 'gallery') && mode.respawn) {
      const orig = mode.respawn.bind(mode);
      mode.respawn = (...args) => {
        const r = orig(...args);
        log.push('respawn', { pos: mode.ball?.getPosition() });
        return r;
      };
    }
  }

  function poll() {
    const mode = game.mode;
    if (!mode || mode !== watched.mode) return;
    const w = watched;
    if (w.name === 'test-track') {
      const falling = mode.falling > 0;
      const finished = mode.finished > 0;
      if (falling && !w.falling) {
        log.push('fall');
        log.push('fail', { reason: 'fall' });
      }
      if (w.checkpoint !== undefined && mode.checkpoint > w.checkpoint) log.push('checkpoint', { index: mode.checkpoint });
      if (finished && !w.finished) {
        log.push('finish');
        log.push('win');
      }
      Object.assign(w, { falling, finished, checkpoint: mode.checkpoint });
    } else if (w.name === 'race') {
      if (mode.index !== w.index) log.push('raceStart', { raceIndex: mode.index, raceSeed: mode.seed });
      if (mode.state !== w.state) {
        log.push('raceState', { state: mode.state });
        if (mode.state === 'racing') log.push('message', { text: 'GO!' });
      }
      Object.assign(w, { index: mode.index, state: mode.state });
    } else if (w.name === 'playground') {
      const out = mode.fade?.phase === 'out';
      if (out && !w.out) {
        log.push('fall');
        log.push('fail', { reason: 'fall-or-stuck' });
      }
      const stars = mode.world?.stars;
      if (stars && stars.stars.length > 0 && stars.remaining === 0 && w.remaining > 0) log.push('win', { stars: stars.stars.length });
      Object.assign(w, { out, remaining: stars?.remaining });
    } else if (w.name === 'gallery') {
      const falling = mode.falling > 0;
      if (falling && !w.falling) {
        log.push('fall');
        log.push('fail', { reason: 'fall' });
      }
      w.falling = falling;
    }
  }

  // ------------------------------------------------------------ state
  function testTrackLine(mode) {
    let c = ttCache.get(mode);
    if (!c) {
      const pts = mode.strips.map((st) => ({ x: st.a.x, y: st.a.y, z: st.a.z, width: st.width, gap: !!st.gap }));
      const last = mode.strips[mode.strips.length - 1];
      pts.push({ x: last.b.x, y: last.b.y, z: last.b.z, width: last.width, gap: false });
      const s = arcLengths(pts);
      const gaps = [];
      mode.strips.forEach((st, i) => {
        if (!st.gap) return;
        const g = gaps[gaps.length - 1];
        if (g && Math.abs(g.s1 - s[i]) < 1e-6) g.s1 = s[i + 1];
        else gaps.push({ s0: s[i], s1: s[i + 1] });
      });
      const lastSeg = mode.segmentStarts[mode.segmentStarts.length - 1];
      c = {
        pts,
        s,
        gaps,
        finishS: s[Math.min(s.length - 1, lastSeg + 5)],
        checkpoints: mode.strips
          .map((st, i) => (st.checkpoint ? { index: i, s: s[i], ...vec(st.a) } : null))
          .filter(Boolean),
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
    const right = { x: Math.cos(st.yaw), z: -Math.sin(st.yaw) };
    const center = { x: st.a.x + (st.b.x - st.a.x) * near.t, y: st.a.y + (st.b.y - st.a.y) * near.t, z: st.a.z + (st.b.z - st.a.z) * near.t };
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
      gaps: c.gaps.map((g) => ({ s0: round(g.s0), s1: round(g.s1) })),
      ahead: samplePolyline(c.pts, c.s, sNow, 12, 2),
      finished: mode.finished > 0,
      feel: mode.ball?.tuning ? { speedCap: mode.ball.tuning.speedCap, autoRoll: !!mode.ball.tuning.autoRoll } : null,
    };
  }

  function trackState(track, s) {
    const sp = track.spline;
    return {
      s: round(s),
      length: round(track.finish ? track.finish.s : track.length),
      halfWidth: round(sp.widthAt(s) / 2),
      checkpoints: track.checkpoints.map((c) => ({ index: c.index, s: round(c.s), ...vec(c.position) })),
      gaps: track.gapZones.map((g) => ({ s0: round(g.s0), s1: round(g.s1), bridged: g.bridged })),
      hazards: track.hazardZones.map((h) => ({ s0: round(h.s0), s1: round(h.s1), type: h.type })),
      boosts: track.boostZones.map((b) => ({ s0: round(b.s0), s1: round(b.s1) })),
      ahead: samplePolyline(sp.points, sp.s, s, 12, 2),
    };
  }

  function raceState(mode) {
    const sim = mode.sim;
    if (!sim) return null;
    const t = trackState(sim.track, sim.s);
    return {
      ...t,
      state: mode.state, // countdown | racing | finished | results | trophy
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
      ais: sim.racers.map((r) => ({ s: round(r.s), finished: !!r.finished })),
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
      stars: w.stars.stars.map((s) => ({ ...vec(s), collected: s.state !== 'idle' })),
      fading: !!mode.fade,
      camForward: vec(mode.cam?.getForward ? mode.cam.getForward(mode._fwd.clone()) : null),
    };
  }

  function galleryState(mode) {
    if (!mode.track) return null;
    return { piece: PIECES[mode.index]?.id, pieceIndex: mode.index, pieces: PIECES.length, ...trackState(mode.track, mode.s) };
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
      input: { x: round(input.move.x), y: round(input.move.y), source: input.source },
      canJump: false,
      pos: null,
      vel: null,
      speed: 0,
      onGround: false,
      frozen: false,
      fell: false,
      won: false,
    };
    const ball = mode?.ball;
    if (ball?.body && game.physics && !game.physics.disposed) {
      try {
        const p = ball.getPosition();
        out.pos = vec(p);
        out.vel = vec(ball.getVelocity());
        out.speed = round(ball.speed);
        out.onGround = ball.isGrounded();
        out.frozen = !!ball.frozen;
      } catch {
        /* body gone mid-teardown */
      }
    }
    try {
      if (name === 'race') {
        out.race = raceState(mode);
        out.won = !!mode.sim?.finished;
        out.fell = (mode.sim?.fallTimer || 0) > 0;
        out.frozen = out.frozen || !!mode.sim?.frozen;
      } else if (name === 'test-track' && out.pos) {
        out.testTrack = testTrackState(mode, out.pos);
        out.won = mode.finished > 0;
        out.fell = mode.falling > 0;
      } else if (name === 'playground') {
        out.playground = playgroundState(mode);
        out.won = !!out.playground && out.playground.total > 0 && out.playground.remaining === 0;
        out.fell = mode.fade?.phase === 'out';
      } else if (name === 'gallery') {
        out.gallery = galleryState(mode);
        out.fell = mode.falling > 0;
      }
    } catch (err) {
      out.error = String(err?.message || err);
    }
    const dbg = {};
    for (const [k, v] of debug.fields) {
      try {
        dbg[k] = plain(typeof v === 'function' ? v() : v);
      } catch (err) {
        dbg[k] = `! ${err.message}`;
      }
    }
    out.debug = dbg;
    return out;
  }

  // ------------------------------------------------------------ actions
  function step(n = 1) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    for (let i = 0; i < count; i++) {
      game._update(TEST_DT);
      // What a 60 fps frame does after its update: camera, HUD, animations.
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
    if (name === 'respawn' && m.respawn) m.respawn();
    else if (name === 'nextPiece' && m.nextPiece) m.nextPiece();
    else if (name === 'regenerate' && m.regenerate) m.regenerate();
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
    const track = name === 'race' ? mode.sim?.track : name === 'gallery' ? mode.track : null;
    if (typeof target.s === 'number' && track) {
      const f = track.spline.sampleAt(target.s);
      pos = { x: f.position.x, y: f.position.y + 0.8, z: f.position.z };
      dir = { x: f.forward.x, y: 0, z: f.forward.z };
    } else if (typeof target.s === 'number' && name === 'test-track') {
      const c = testTrackLine(mode);
      const [p] = samplePolyline(c.pts, c.s, target.s, 1);
      const i = Math.max(0, c.s.findIndex((v) => v > target.s) - 1);
      pos = { x: p.x, y: p.y + 0.8, z: p.z };
      dir = forwardOf(mode.strips[Math.min(i, mode.strips.length - 1)].yaw);
    } else {
      pos = { x: Number(target.x) || 0, y: Number(target.y) || 0, z: Number(target.z) || 0 };
    }
    if (!dir) dir = name === 'race' ? mode.sim.forward.clone() : mode.forward?.clone?.() || mode._fwd?.clone?.() || null;
    mode.ball.respawn(pos, dir);
    if (name === 'race' && mode.sim) {
      const sim = mode.sim;
      const near = sim.track.nearest(pos, -1);
      sim.s = sim.stuckS = near.s;
      sim.stuckT = 0;
      sim.fallTimer = 0;
      if (dir) sim.forward.set(dir.x, 0, dir.z).normalize();
    } else if (name === 'test-track') {
      const near = nearestStrip(mode.strips, pos, 0, 0, mode.strips.length);
      mode.progress = near.index;
      mode.falling = 0;
      if (dir) mode.forward.set(dir.x, 0, dir.z).normalize();
    } else if (name === 'gallery') {
      mode.s = mode.track.nearest(pos, -1).s;
      mode.falling = 0;
    } else if (name === 'playground') {
      mode.lastSafe.set(pos.x, pos.y, pos.z);
      mode.fade = null;
      mode.stuck?.reset();
    }
    if (dir && mode.cam) mode.cam.snap(pos, dir);
    log.push('teleport', { pos });
    return state();
  }

  async function restore() {
    const cur = router.current;
    if (!cur || cur.name !== 'play') return state();
    api.ready = false;
    await router.go('play', cur.params);
    simTime = 0;
    api.ready = true;
    log.push('reset', { mode: game.ctx?.modeName ?? null });
    return state();
  }

  function isVisible(el) {
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    return el.getClientRects().length > 0;
  }

  function text() {
    const root = document.getElementById('ui');
    const out = [];
    if (!root) return out;
    const push = (s) => {
      const v = String(s || '').replace(/\s+/g, ' ').trim();
      if (v && out[out.length - 1] !== v) out.push(v);
    };
    const walk = (el) => {
      if (!isVisible(el)) return;
      push(el.getAttribute('aria-label'));
      for (const n of el.childNodes) {
        if (n.nodeType === 3) push(n.textContent);
        else if (n.nodeType === 1 && n.tagName !== 'svg' && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') walk(n);
      }
    };
    walk(root);
    return out;
  }

  /** Full center line for the current track (race / test-track / gallery). */
  function trackLine() {
    const mode = game.mode;
    const name = game.ctx?.modeName;
    const track = name === 'race' ? mode?.sim?.track : name === 'gallery' ? mode?.track : null;
    if (track) {
      const sp = track.spline;
      return sp.points.map((p, i) => ({ s: round(sp.s[i]), ...vec(p), width: round(p.width), yaw: round(p.yaw) }));
    }
    if (name === 'test-track') {
      const c = testTrackLine(mode);
      return c.pts.map((p, i) => ({ s: round(c.s[i]), ...vec(p), width: p.width, gap: p.gap }));
    }
    return null;
  }

  const api = {
    name: 'rolly-bally',
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
    // Rolly Bally extras
    track: trackLine,
    debugAction,
    app,
  };
  window.__game = api;
  return {
    markReady() {
      api.ready = true;
      log.push('ready', { screen: router.current?.name ?? null, mode: game.ctx?.modeName ?? null });
    },
  };
}
