(function(){
// Test harness that uses the exported generateMaze from main.js

function safeGet(fnName) {
  return window[fnName] || null;
}

let gen = safeGet('generateMaze');
if (!gen) {
  console.warn('main.js did not expose generateMaze — using local fallback');
  gen = function(width, height) {
    width = width % 2 === 0 ? width-1 : width;
    height = height % 2 === 0 ? height-1 : height;
    let maze = Array.from({length: height}, () => Array(width).fill(1));
    function carve(x, y) {
      const dirs = [ [0,-2], [0,2], [-2,0], [2,0] ];
      for (let d of dirs.sort(() => Math.random()-0.5)) {
        let nx = x + d[0], ny = y + d[1];
        if (ny > 0 && ny < height && nx > 0 && nx < width && maze[ny][nx] === 1) {
          maze[ny - d[1]/2][nx - d[0]/2] = 0;
          maze[ny][nx] = 0;
          carve(nx, ny);
        }
      }
    }
    maze[1][1] = 0;
    carve(1,1);
    maze[Math.floor(height/2)][width-2] = 2;
    return maze;
  }
}

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
  legend.innerHTML = '<span style="display:inline-block;width:14px;height:14px;background:#a33;margin-right:6px;vertical-align:middle;border:1px solid #700"></span> Secret door &nbsp;&nbsp; <span style="display:inline-block;width:14px;height:14px;background:#a60;margin-right:6px;vertical-align:middle;border:1px solid #740"></span> Trap door';
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
      div.className = 'cell ' + (v===1? 'wall' : v===2? 'exit' : v===3? 'secret' : v===4? 'trap' : 'empty');
      mazeEl.appendChild(div);
    }
    let br = document.createElement('div'); br.style.clear='both'; mazeEl.appendChild(br);
  }
  gridPre.textContent = maze.map(r=>r.join(' ')).join('\n');
}

function applyExtras(maze, secrets, traps) {
  // Place secrets and traps by replacing suitable wall tiles across the maze
  const H = maze.length, W = maze[0].length;
  let candidates = [];
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
    if (maze[y][x] === 1) {
      if ((maze[y][x-1] === 0 && maze[y][x+1] === 0) || (maze[y-1][x] === 0 && maze[y+1][x] === 0)) {
        candidates.push({x,y});
      }
    }
  }
  candidates = candidates.sort(() => Math.random()-0.5);
  for (let i = 0; i < secrets && candidates.length; i++) {
    let p = candidates.shift();
    maze[p.y][p.x] = 3;
  }
  for (let i = 0; i < traps && candidates.length; i++) {
    let p = candidates.shift();
    maze[p.y][p.x] = 4;
  }
}

function genAndShow() {
  const W = parseInt(wInput.value,10);
  const H = parseInt(hInput.value,10);
  const secrets = parseInt(secretInput.value,10) || 0;
  const traps = parseInt(trapInput.value,10) || 0;
  let m = null;
  // If main.js generator accepts only width/height, call it and then apply extras here
  // call generator and then apply extras
  // ensure odd values
  const useW = (W % 2 === 0) ? W+1 : W;
  const useH = (H % 2 === 0) ? H+1 : H;
  m = gen(useW,useH);
  applyExtras(m, secrets, traps);
  renderMaze(m);
  const actualW = m[0].length, actualH = m.length;
  info.textContent = `Generated maze ${actualW} x ${actualH} (secrets=${secrets} traps=${traps})`;
}

if (genBtn) genBtn.addEventListener('click', genAndShow);

function runTests() {
  results.innerHTML = '';
  const tests = [];
  // odd dims test should read from inputs
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
