(function(){
// Test harness that uses the exported functions from main.js on window

// wire up the UI that index.html provides
const wInput = document.getElementById('w');
const hInput = document.getElementById('h');
const genBtn = document.getElementById('gen');
const mazeEl = document.getElementById('maze');
const gridPre = document.getElementById('grid');
const info = document.getElementById('info');
const results = document.getElementById('results');
const secretInput = document.getElementById('num-secret');
const trapInput = document.getElementById('num-trap');
const legend = document.getElementById('legend');

if (legend) {
  legend.innerHTML = '<span style="display:inline-block;width:14px;height:14px;background:#ffd700;margin-right:6px;vertical-align:middle;border:1px solid #b8860b"></span> Start &nbsp;&nbsp; <span style="display:inline-block;width:14px;height:14px;background:#a33;margin-right:6px;vertical-align:middle;border:1px solid #700"></span> Secret door &nbsp;&nbsp; <span style="display:inline-block;width:14px;height:14px;background:#a60;margin-right:6px;vertical-align:middle;border:1px solid #740"></span> Trap door';
}

// import core functions from main.js (attached to window)
let gen = window.generateMaze || null;
let placeExtras = window.placeExtras || null;
let findPath = window.findPath || null;

function disableControlsWithMessage(msg) {
  if (info) info.textContent = msg;
  if (genBtn) genBtn.disabled = true;
  const runBtn = document.getElementById('run-tests');
  if (runBtn) runBtn.disabled = true;
}

if (!gen) {
  disableControlsWithMessage('Error: generateMaze not found on window. Load main.js before this test page.');
  return;
}

function ensureOddInput(input) {
  if (!input) return;
  input.addEventListener('change', () => {
    let v = parseInt(input.value, 10) || 3;
    if (v < 3) v = 3;
    if (v % 2 === 0) v += 1;
    input.value = v;
  });
}

ensureOddInput(wInput);
ensureOddInput(hInput);

function renderMaze(maze) {
  mazeEl.innerHTML = '';
  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[0].length; x++) {
      let v = maze[y][x];
      let div = document.createElement('div');
      // show the player start at 1,1 with a special class
      if (x === 1 && y === 1) {
        div.className = 'cell start';
        // if start cell also has a special tile, still show start visually
        // but preserve semantic class for tests by keeping data-value
        div.dataset.value = String(v);
        // force bright yellow user color so it's visible regardless of CSS
        div.style.background = '#ffd700';
        div.style.border = '1px solid #b8860b';
      } else {
        div.className = 'cell ' + (v===1? 'wall' : v===2? 'exit' : v===3? 'secret' : v===4? 'trap' : 'empty');
      }
      mazeEl.appendChild(div);
    }
    let br = document.createElement('div'); br.style.clear='both'; mazeEl.appendChild(br);
  }
  gridPre.textContent = maze.map(r=>r.join(' ')).join('\n');
}

// helper: encode/decode base64 safe for UTF-8
function _encodeBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
function _decodeBase64(b64) { return decodeURIComponent(escape(atob(b64))); }

function mazeToSeed(maze) {
  // v1: base64(JSON)
  try {
    const json = JSON.stringify(maze);
    return 'v1:' + _encodeBase64(json);
  } catch (e) {
    return null;
  }
}

function seedToMaze(seed) {
  if (!seed || typeof seed !== 'string') return null;
  if (seed.indexOf('v1:') === 0) {
    try {
      const json = _decodeBase64(seed.slice(3));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// create or find seed UI (textarea + load button)
let seedWidget = null;
if (window.attachSeedUI) {
  seedWidget = window.attachSeedUI({
    insertBefore: info ? info.nextSibling : null,
    onLoad: function(m) {
      renderMaze(m);
      if (info) info.textContent = `Loaded seed — maze ${m[0].length} x ${m.length}`;
    },
    onError: function(msg) {
      if (info) info.textContent = msg;
    }
  });
} else {
  if (info) info.textContent = 'Seed UI not available (lib/util.js not loaded).';
}

function genAndShow() {
  const W = parseInt(wInput.value,10);
  const H = parseInt(hInput.value,10);
  const secrets = parseInt(secretInput.value,10) || 0;
  const traps = parseInt(trapInput.value,10) || 0;
  // ensure odd values
  const useW = (W % 2 === 0) ? W+1 : W;
  const useH = (H % 2 === 0) ? H+1 : H;
  let m = gen(useW, useH);
  if (placeExtras) {
    placeExtras(m, secrets, traps);
  } else {
    if (secrets || traps) {
      if (info) info.textContent = 'Warning: placeExtras not found on window — secrets/traps not applied.';
    }
  }
  renderMaze(m);
  const actualW = m[0].length, actualH = m.length;
  info.textContent = `Generated maze ${actualW} x ${actualH} (secrets=${secrets} traps=${traps})`;
  // populate seed widget
  if (seedWidget && window.mazeToSeed) {
    const seed = window.mazeToSeed(m);
    seedWidget.setSeed(seed);
  }
}

if (genBtn) genBtn.addEventListener('click', genAndShow);

function runTests() {
  results.innerHTML = '';
  const tests = [];
  tests.push(() => {
    const W = parseInt(wInput.value, 10) || 21;
    const H = parseInt(hInput.value, 10) || 21;
    let m = gen(W,H);
    return {name:'Odd dims', pass: m[0].length %2 ===1 && m.length%2===1 && m[0].length===((W%2===0)?W+1:W) && m.length===((H%2===0)?H+1:H), details:`requested=${W}x${H} generated=${m[0].length}x${m.length}`};
  });
  tests.push(() => {
    const W = parseInt(wInput.value, 10) || 21;
    const H = parseInt(hInput.value, 10) || 21;
    let m = gen(W,H);
    let startOpen = m[1][1]===0;
    let exitPlaced = m[Math.floor(m.length/2)][m[0].length-2]===2;
    return {name:'Start/exit', pass:startOpen && exitPlaced, details:`start=${m[1][1]} exit=${m[Math.floor(m.length/2)][m[0].length-2]}`};
  });
  tests.push(() => {
    const W = parseInt(wInput.value, 10) || 21;
    const H = parseInt(hInput.value, 10) || 21;
    const secrets = parseInt(secretInput.value, 10) || 0;
    const traps = parseInt(trapInput.value, 10) || 0;
    let m = gen(W, H);
    if (placeExtras) {
      placeExtras(m, secrets, traps);
    } else {
      if (secrets || traps) {
        return {name:'Secrets/Traps count', pass:false, details:'placeExtras not available — extras not applied'};
      }
    }
    let foundSecrets = 0, foundTraps = 0;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[0].length; x++) {
        if (m[y][x] === 3) foundSecrets++;
        if (m[y][x] === 4) foundTraps++;
      }
    }
    const pass = (foundSecrets === secrets) && (foundTraps === traps);
    return {name:'Secrets/Traps count', pass, details:`secrets=${foundSecrets} (expected ${secrets}) traps=${foundTraps} (expected ${traps})`};
  });
  for (let t of tests) {
    let r = t();
    let node = document.createElement('div');
    node.innerHTML = `${r.name}: <strong class="${r.pass? 'pass':'fail'}">${r.pass? 'PASS':'FAIL'}</strong> — ${r.details}`;
    results.appendChild(node);
  }
}

const runBtn = document.getElementById('run-tests');
if (runBtn) runBtn.addEventListener('click', runTests);

// auto-run
if (wInput && hInput) genAndShow();

})();
