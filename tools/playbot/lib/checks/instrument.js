// Page instrumentation for the automatic checks: runs before any game code
// (context.addInitScript) and records into window.__playbotChecks:
//   permissions: calls to APIs that prompt the user (location, notifications, camera/mic, ...)
//   opens:       window.open() calls
//   audio:       level samples (peak/RMS) tapped from every AudioContext destination
//   media:       HTMLMediaElement.play() calls
// Plus a recorder for network requests, popups and navigations (Playwright events).

export const EXTRA_BROWSER_ARGS = ['--autoplay-policy=no-user-gesture-required'];

/** The init script. Must be self-contained (it is serialized into the page). */
export function checksInitScript() {
  if (window.__playbotChecks) return;
  const rec = { permissions: [], opens: [], audio: [], media: [], audioContexts: 0 };
  window.__playbotChecks = rec;
  const now = () => performance.now();
  const note = (api, extra = {}) => {
    rec.permissions.push({ api, at: now(), ...extra, stack: (new Error().stack || '').split('\n').slice(2, 5).join(' | ') });
  };
  const wrap = (obj, name, api, ret) => {
    try {
      if (!obj || typeof obj[name] !== 'function') return;
      const orig = obj[name];
      obj[name] = function (...args) {
        note(api);
        if (ret) return ret(orig, this, args);
        return orig.apply(this, args);
      };
    } catch { /* read-only */ }
  };

  // --- permission prompts (the call is recorded; the browser still decides/denies)
  const geo = navigator.geolocation;
  if (geo) {
    wrap(Geolocation.prototype, 'getCurrentPosition', 'geolocation');
    wrap(Geolocation.prototype, 'watchPosition', 'geolocation');
  }
  if (window.Notification) wrap(Notification, 'requestPermission', 'notifications');
  if (window.MediaDevices) {
    wrap(MediaDevices.prototype, 'getUserMedia', 'camera/microphone');
    wrap(MediaDevices.prototype, 'getDisplayMedia', 'screen-capture');
  }
  if (navigator.getUserMedia) wrap(navigator, 'getUserMedia', 'camera/microphone');
  if (window.Clipboard) {
    wrap(Clipboard.prototype, 'read', 'clipboard-read');
    wrap(Clipboard.prototype, 'readText', 'clipboard-read');
    wrap(Clipboard.prototype, 'write', 'clipboard-write');
    wrap(Clipboard.prototype, 'writeText', 'clipboard-write');
  }
  if (window.DeviceMotionEvent?.requestPermission) wrap(DeviceMotionEvent, 'requestPermission', 'motion-sensors');
  if (window.DeviceOrientationEvent?.requestPermission) wrap(DeviceOrientationEvent, 'requestPermission', 'motion-sensors');
  if (window.StorageManager) wrap(StorageManager.prototype, 'persist', 'persistent-storage');
  if (Document.prototype.requestStorageAccess) wrap(Document.prototype, 'requestStorageAccess', 'storage-access');
  for (const [k, api] of [['bluetooth', 'bluetooth'], ['usb', 'usb'], ['serial', 'serial'], ['hid', 'hid']]) {
    const o = navigator[k];
    if (o) for (const m of ['requestDevice', 'requestPort']) if (typeof o[m] === 'function') wrap(Object.getPrototypeOf(o), m, api);
  }
  if (window.PushManager) wrap(PushManager.prototype, 'subscribe', 'push');
  if (navigator.credentials) {
    wrap(Object.getPrototypeOf(navigator.credentials), 'get', 'credentials');
    wrap(Object.getPrototypeOf(navigator.credentials), 'create', 'credentials');
  }
  if (window.showOpenFilePicker) wrap(window, 'showOpenFilePicker', 'file-picker');
  // Not prompts that leak data, but useful context (info only).
  if (Element.prototype.requestPointerLock) wrap(Element.prototype, 'requestPointerLock', 'pointer-lock (info)');
  if (Element.prototype.requestFullscreen) wrap(Element.prototype, 'requestFullscreen', 'fullscreen (info)');
  if (navigator.permissions) {
    wrap(Permissions.prototype, 'query', 'permissions.query (info)', (orig, self, args) => {
      rec.permissions[rec.permissions.length - 1].name = args?.[0]?.name;
      return orig.apply(self, args);
    });
  }

  // --- requestAnimationFrame gate: while rec.rafPaused, RAF callbacks are held back so
  // the game's draw-only loop does not compete with __game.step() during frame sampling.
  const origRaf = window.requestAnimationFrame.bind(window);
  const held = [];
  window.requestAnimationFrame = (cb) => {
    if (rec.rafPaused) { held.push(cb); return -held.length; }
    return origRaf(cb);
  };
  rec.pauseRaf = () => { rec.rafPaused = true; };
  rec.resumeRaf = () => {
    rec.rafPaused = false;
    for (const cb of held.splice(0)) origRaf(cb);
  };

  // --- window.open
  const origOpen = window.open;
  window.open = function (url, target, features) {
    rec.opens.push({ url: String(url ?? ''), target: String(target ?? ''), at: now() });
    return origOpen.call(this, url, target, features);
  };

  // --- media elements
  if (window.HTMLMediaElement) {
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      rec.media.push({ src: this.currentSrc || this.src, volume: this.volume, muted: this.muted, at: now() });
      return origPlay.apply(this, args);
    };
  }

  // --- Web Audio tap: every connection to a destination goes through gain → analyser → destination
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC && window.AudioNode) {
    const origConnect = AudioNode.prototype.connect;
    const origDisconnect = AudioNode.prototype.disconnect;
    const taps = new WeakMap();
    const tapFor = (ctx) => {
      let t = taps.get(ctx);
      if (t) return t;
      const input = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      origConnect.call(input, analyser);
      origConnect.call(input, ctx.destination);
      const buf = new Float32Array(analyser.fftSize);
      t = { input, analyser, buf };
      taps.set(ctx, t);
      rec.audioContexts++;
      const id = rec.audioContexts;
      // Poll levels. fftSize 2048 at 44.1–48 kHz ≈ 43–46 ms per window; sampling every 25 ms overlaps.
      const timer = setInterval(() => {
        if (ctx.state === 'closed') { clearInterval(timer); return; }
        if (ctx.state !== 'running') return;
        analyser.getFloatTimeDomainData(buf);
        let peak = 0;
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]);
          if (v > peak) peak = v;
          sum += buf[i] * buf[i];
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rec.audio.length < 20000) rec.audio.push({ t: now(), ctx: id, peak, rms });
      }, 25);
      return t;
    };
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        const t = tapFor(dest.context);
        return origConnect.call(this, t.input, ...rest) && dest;
      }
      return origConnect.call(this, dest, ...rest);
    };
    AudioNode.prototype.disconnect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        const t = taps.get(dest.context);
        if (t) return origDisconnect.call(this, t.input, ...rest);
      }
      return origDisconnect.call(this, dest, ...rest);
    };
  }
}

/**
 * Records network activity for a browser context.
 * @returns {{requests, websockets, popups, navigations, detach()}}
 */
export function recordNetwork(context, { target } = {}) {
  const rec = { requests: [], websockets: [], popups: [], navigations: [] };
  const onRequest = (req) => {
    rec.requests.push({
      url: req.url(), method: req.method(), type: req.resourceType(), target,
      frame: (() => { try { return req.frame()?.url(); } catch { return null; } })(),
    });
  };
  const onPage = (page) => {
    page.on('websocket', (ws) => rec.websockets.push({ url: ws.url(), target }));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) rec.navigations.push({ url: frame.url(), target });
    });
    page.on('popup', (p) => rec.popups.push({ url: p.url(), target }));
  };
  context.on('request', onRequest);
  context.on('page', onPage);
  for (const p of context.pages()) onPage(p);
  return { ...rec, rec, detach: () => { context.off('request', onRequest); context.off('page', onPage); } };
}

/** Read the page-side recording. */
export async function readPageRecording(page) {
  return page.evaluate(() => {
    const r = window.__playbotChecks;
    if (!r) return null;
    return { permissions: r.permissions, opens: r.opens, media: r.media, audioContexts: r.audioContexts, audio: r.audio.slice() };
  }).catch(() => null);
}
