(function(){
// Test harness that uses the exported generateMaze from main.js
// Avoid declaring a top-level generateMaze to prevent redeclaration errors.

function safeGet(fnName) {
  return window[fnName] || null;
}

// use local name `gen` to avoid colliding with global function declarations
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

function genAndShow() {
  const W = parseInt(wInput.value,10);
  const H = parseInt(hInput.value,10);
  const m = gen(W,H);
  renderMaze(m);
  info.textContent = `Generated maze ${m[0].length} x ${m.length}`;
}

if (genBtn) genBtn.addEventListener('click', genAndShow);

function runTests() {
  results.innerHTML = '';
  const tests = [];
  tests.push(() => {
    let m = gen(10,10);
    return {name:'Odd dims', pass: m[0].length %2 ===1 && m.length%2===1, details:`${m[0].length}x${m.length}`};
  });
  tests.push(() => {
    let m = gen(20,15);
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
