// Last-resort "start again" screen: a big round circular-arrow button that
// reloads the page. Used when boot fails (Rapier/WASM) and when iPad Safari
// drops the WebGL context. Inline styles so it works even if CSS didn't load.

const RELOAD_SVG = `<svg viewBox="0 0 64 64" width="60%" height="60%" aria-hidden="true">
  <path d="M50 32 A18 18 0 1 1 42 17" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  <path d="M34 8 L48 15 L38 27 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
</svg>`;

let shown = null;

/** Show (once) a full-screen overlay with a big reload button. */
export function showReloadButton() {
  if (shown) return shown;
  const overlay = document.createElement('div');
  overlay.className = 'reload-overlay ui-block';
  overlay.setAttribute('data-ui', '');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(110,198,255,0.92);touch-action:manipulation;';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Start again');
  btn.style.cssText = 'width:min(40vh,220px);height:min(40vh,220px);border-radius:50%;border:8px solid #fff;'
    + 'background:#2fb84a;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;'
    + 'box-shadow:0 10px 0 rgba(0,0,0,0.2);padding:0;';
  btn.innerHTML = RELOAD_SVG;
  btn.addEventListener('click', () => window.location.reload());
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
  shown = overlay;
  return overlay;
}
