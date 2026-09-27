// links-out: <a href> / forms / iframes pointing at another origin, target=_blank,
// window.open, popups and navigations away from the game (R13 → fail).
// input-fields: inputs that could collect personal data (R13): email/tel/password
// or name/age/address-like fields → fail; other free-text inputs → warn.
import { finding } from './util.js';

/** Runs in the page. Returns links, forms, iframes and inputs on the current screen. */
function scanDomInPage() {
  const vis = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const desc = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}${t ? ` "${t}"` : ''}`;
  };
  const links = [...document.querySelectorAll('a[href], area[href]')].map((a) => ({
    href: a.href, raw: a.getAttribute('href'), target: a.getAttribute('target'), visible: vis(a), el: desc(a), rect: rect(a),
  }));
  const forms = [...document.querySelectorAll('form')].map((f) => ({ action: f.action, method: f.method, visible: vis(f), el: desc(f), rect: rect(f) }));
  const iframes = [...document.querySelectorAll('iframe, embed, object')].map((f) => ({ src: f.src || f.data || '', visible: vis(f), el: desc(f), rect: rect(f) }));
  const inputs = [...document.querySelectorAll('input, textarea, select, [contenteditable=""], [contenteditable=true]')]
    .filter((i) => !['hidden', 'button', 'submit', 'reset', 'range', 'checkbox', 'radio', 'color', 'image', 'file'].includes((i.type || '').toLowerCase()))
    .map((i) => ({
      tag: i.tagName.toLowerCase(), type: (i.type || '').toLowerCase(), name: i.name || '', id: i.id || '',
      autocomplete: i.getAttribute('autocomplete') || '', placeholder: i.getAttribute('placeholder') || '',
      label: (i.labels?.[0]?.innerText || i.getAttribute('aria-label') || '').trim().slice(0, 80),
      visible: vis(i), el: desc(i), rect: rect(i),
    }));
  return { links, forms, iframes, inputs, origin: location.origin };
}

export async function scanDom(page) {
  return page.evaluate(scanDomInPage).catch(() => null);
}

const PERSONAL = /\b(e-?mail|mail|phone|tel|mobile|password|passcode|pin|first.?name|last.?name|full.?name|your.?name|name|age|birth|dob|address|street|city|zip|postcode|postal|school|parent|credit|card|cc-|login|user.?name|account|location)\b/i;

/** Classify one input. Pure. → 'fail' | 'warn' */
export function classifyInput(i) {
  if (['email', 'tel', 'password'].includes(i.type)) return 'fail';
  const hay = [i.name, i.id, i.autocomplete, i.placeholder, i.label].join(' ').replace(/[_-]/g, ' ');
  if (i.autocomplete && !['off', 'on'].includes(i.autocomplete)) return 'fail';
  if (PERSONAL.test(hay)) return 'fail';
  return 'warn';
}

function otherOrigin(url, origin) {
  if (!url) return false;
  try {
    const u = new URL(url, origin);
    if (u.protocol === 'javascript:') return false;
    if (['mailto:', 'tel:', 'sms:'].includes(u.protocol)) return true;
    return u.origin !== origin && !['data:', 'blob:', 'about:'].includes(u.protocol);
  } catch { return false; }
}

/**
 * @param {{target, label, dom, screenshot}[]} screens  DOM scans per screen
 * @param {{target, opens, popups, navigations, screenshot}[]} pages
 * @param {string} gameOrigin
 */
export function evaluateLinksOut(screens, pages, gameOrigin) {
  const out = [];
  const seen = new Set();
  const add = (key, f) => { if (!seen.has(key)) { seen.add(key); out.push(f); } };
  for (const s of screens) {
    if (!s.dom) continue;
    for (const l of s.dom.links) {
      if (otherOrigin(l.href, gameOrigin)) {
        add(`a:${l.href}`, finding({ check: 'links-out', rule: 'R13', status: 'fail', target: s.target,
          summary: `Link out of the game: ${l.href}${l.visible ? '' : ' (hidden)'} on ${s.label}`,
          screenshot: s.screenshot, key: l.href, details: { ...l, screen: s.label } }));
      } else if (l.target === '_blank') {
        add(`blank:${l.href}`, finding({ check: 'links-out', rule: 'R13', status: 'warn', target: s.target,
          summary: `Link opens a new tab (target=_blank): ${l.raw} on ${s.label}`, screenshot: s.screenshot, key: `blank:${l.raw}`, details: { ...l, screen: s.label } }));
      }
    }
    for (const f of s.dom.forms) {
      if (otherOrigin(f.action, gameOrigin)) {
        add(`form:${f.action}`, finding({ check: 'links-out', rule: 'R13', status: 'fail', target: s.target,
          summary: `Form submits to another site: ${f.action}`, screenshot: s.screenshot, key: `form:${f.action}`, details: { ...f, screen: s.label } }));
      }
    }
    for (const f of s.dom.iframes) {
      if (otherOrigin(f.src, gameOrigin)) {
        add(`iframe:${f.src}`, finding({ check: 'links-out', rule: 'R13', status: 'fail', target: s.target,
          summary: `Embedded third-party frame: ${f.src}`, screenshot: s.screenshot, key: `iframe:${f.src}`, details: { ...f, screen: s.label } }));
      }
    }
    for (const i of s.dom.inputs) {
      const status = classifyInput(i);
      const key = `input:${i.tag}:${i.type}:${i.name}:${i.id}:${i.placeholder}`;
      add(key, finding({ check: 'input-fields', rule: 'R13', status, target: s.target,
        summary: `${status === 'fail' ? 'Input that may ask for personal data' : 'Free-text input'}: ${i.el} (type=${i.type || i.tag}${i.placeholder ? `, placeholder "${i.placeholder}"` : ''}) on ${s.label}`,
        screenshot: s.screenshot, key, details: { ...i, screen: s.label } }));
    }
  }
  for (const p of pages) {
    for (const o of p.opens ?? []) {
      add(`open:${o.url}`, finding({ check: 'links-out', rule: 'R13', status: otherOrigin(o.url, gameOrigin) ? 'fail' : 'warn', target: p.target,
        summary: `window.open(${JSON.stringify(o.url)})`, screenshot: p.screenshot, key: `open:${o.url}`, details: o }));
    }
    for (const pop of p.popups ?? []) {
      add(`popup:${pop.url}`, finding({ check: 'links-out', rule: 'R13', status: 'fail', target: p.target,
        summary: `Popup window opened: ${pop.url}`, screenshot: p.screenshot, key: `popup:${pop.url}`, details: pop }));
    }
    for (const n of p.navigations ?? []) {
      if (otherOrigin(n.url, gameOrigin) && !n.url.startsWith('about:')) {
        add(`nav:${n.url}`, finding({ check: 'links-out', rule: 'R13', status: 'fail', target: p.target,
          summary: `Page navigated away from the game to ${n.url}`, screenshot: p.screenshot, key: `nav:${n.url}`, details: n }));
      }
    }
  }
  if (!out.some((f) => f.check === 'links-out' && f.status !== 'pass')) {
    out.push(finding({ check: 'links-out', rule: 'R13', status: 'pass', summary: `No links out, window.open, popups or navigations away (${screens.length} screens)`, key: 'clean',
      details: { screens: screens.map((s) => `${s.target}:${s.label}`) } }));
  }
  if (!out.some((f) => f.check === 'input-fields')) {
    out.push(finding({ check: 'input-fields', rule: 'R13', status: 'pass', summary: 'No text/email/password inputs on any screen', key: 'clean' }));
  }
  return out;
}
