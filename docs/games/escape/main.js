// Escape - Super Basic 16-bit Style Room Escape Game

// Maze generation for levels 3+
// 0 = empty, 1 = wall, 2 = exit
function generateMaze(width, height) {
  // Odd dimensions for maze
  width = width % 2 === 0 ? width-1 : width;
  height = height % 2 === 0 ? height-1 : height;
  let maze = Array.from({length: height}, (_, y) => Array(width).fill(1));
  function carve(x, y) {
    const dirs = [ [0,-2], [0,2], [-2,0], [2,0] ];
    for (let d of dirs.sort(() => Math.random()-0.5)) {
      let nx = x + d[0], ny = y + d[1];
      if (ny > 0 && ny < height && nx > 0 && nx < width && maze[ny][nx] === 1) {
        maze[ny-d[1]/2][nx-d[0]/2] = 0;
        maze[ny][nx] = 0;
        carve(nx, ny);
      }
    }
  }
  maze[1][1] = 0;
  carve(1,1);
  // Place exit at far right
  maze[Math.floor(height/2)][width-2] = 2;
  // Add dead ends: block some random open cells
  let deadEnds = 0;
  for (let tries=0; tries<20 && deadEnds<2; tries++) {
    let x = 2+Math.floor(Math.random()*(width-4));
    let y = 2+Math.floor(Math.random()*(height-4));
    if (maze[y][x] === 0 &&
        [maze[y-1][x],maze[y+1][x],maze[y][x-1],maze[y][x+1]].filter(v=>v===0).length === 1) {
      maze[y][x] = 1;
      deadEnds++;
    }
  }
  // Pad to MAP_W/MAP_H
  let padded = Array.from({length: MAP_H}, (_, y) => Array(MAP_W).fill(1));
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) padded[y][x]=maze[y][x];
  return padded;
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const TILE = 16;
const MAP_W = 20, MAP_H = 15;
const MAX_LEVEL = 30;
let currentLevel = 0;
let levels = [];
let player = { x: 1, y: 1 };
let gameState = 'playing'; // 'playing' or 'level-select'

// Pre-generate all 30 levels at startup
for (let i = 0; i < MAX_LEVEL; i++) {
  if (i === 0) {
    // Level 1: custom
    levels[0] = [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
      [1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1],
      [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
      [1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,0,0,1],
      [1,0,1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ];
  } else if (i === 1) {
    // Level 2: custom
    levels[1] = [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
      [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
      [1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1],
      [1,0,1,0,1,0,0,0,0,0,0,0,0,0,1,1,0,1,0,1],
      [1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,0,1,0,1],
      [1,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,1,0,1],
      [1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,2,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
      [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ];
  } else if (i > 9) {
    // Levels 11-30: Maze with secret doors only on the critical path
    let maze = generateMaze(MAP_W, MAP_H);
    // Find solution path from start (1,1) to exit (width-2, mid)
    function findPath(maze, sx, sy, ex, ey) {
      let stack = [[sx, sy, []]];
      let visited = Array.from({length: MAP_H}, () => Array(MAP_W).fill(false));
      while (stack.length) {
        let [x, y, path] = stack.pop();
        if (x === ex && y === ey) return [...path, [x, y]];
        if (visited[y][x]) continue;
        visited[y][x] = true;
        for (let [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          let nx = x+dx, ny = y+dy;
          if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && (maze[ny][nx] === 0 || maze[ny][nx] === 2) && !visited[ny][nx]) {
            stack.push([nx, ny, [...path, [x, y]]]);
          }
        }
      }
      return null;
    }
    let exitY = Math.floor(MAP_H/2);
    let path = findPath(maze, 1, 1, MAP_W-2, exitY) || [];
    // Find candidate wall tiles adjacent to the solution path that can be used as secret doors.
    // A candidate wall is a wall tile that has open space on both opposite sides (vertical or horizontal),
    // and is next to at least one cell of the solution path.
    let secretPairs = [];
    // First try: find wall tiles directly adjacent to the solution path that can be secret doors.
    let candidates = [];
    if (path.length) {
      for (let [px, py] of path) {
        for (let [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          let wx = px + dx, wy = py + dy;
          if (wx > 0 && wx < MAP_W-1 && wy > 0 && wy < MAP_H-1 && maze[wy][wx] === 1) {
            // check if wall separates two open cells
            if ((maze[wy][wx-1] === 0 && maze[wy][wx+1] === 0) || (maze[wy-1][wx] === 0 && maze[wy+1][wx] === 0)) {
              if (!candidates.some(p => p.x === wx && p.y === wy)) candidates.push({x: wx, y: wy});
            }
          }
        }
      }
    }
    // Fallback: if none adjacent to the path, search the whole maze for suitable wall tiles.
    if (candidates.length === 0) {
      for (let wy = 1; wy < MAP_H-1; wy++) {
        for (let wx = 1; wx < MAP_W-1; wx++) {
          if (maze[wy][wx] === 1) {
            if ((maze[wy][wx-1] === 0 && maze[wy][wx+1] === 0) || (maze[wy-1][wx] === 0 && maze[wy+1][wx] === 0)) {
              candidates.push({x: wx, y: wy});
            }
          }
        }
      }
    }
    // Randomize and place 1..3 secret doors from candidates
    candidates = candidates.sort(() => Math.random() - 0.5);
    let numSecret = Math.min(candidates.length, 1 + Math.floor(Math.random()*3));
    for (let s = 0; s < numSecret; s++) {
      let p = candidates[s];
      maze[p.y][p.x] = 3;
      secretPairs.push(p);
    }
    // Place trap doors randomly (not on solution path)
    let trapPairs = [];
    for (let y = 1; y < MAP_H-1; y++) {
      for (let x = 1; x < MAP_W-1; x++) {
        if (maze[y][x] === 1 && !secretPairs.some(p => p.x === x && p.y === y)) {
          // Vertical wall between two pathways
          if (maze[y][x-1] === 0 && maze[y][x+1] === 0) trapPairs.push({x, y});
          // Horizontal wall between two pathways
          if (maze[y-1][x] === 0 && maze[y+1][x] === 0) trapPairs.push({x, y});
        }
      }
    }
    trapPairs = trapPairs.sort(() => Math.random()-0.5);
    let numTrap = Math.min(trapPairs.length, 1 + Math.floor(Math.random()*3));
    for (let t = 0; t < numTrap; t++) {
      let p = trapPairs[t];
      maze[p.y][p.x] = 4;
    }
    levels[i] = maze;
  } else {
    levels[i] = generateMaze(MAP_W, MAP_H);
  }
}

function resetPlayer() {
  player.x = 1;
  player.y = 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let map = levels[currentLevel];
  // Update level info display
  const info = document.getElementById('level-info');
  if (info) {
    info.textContent = `Level ${currentLevel + 1} / ${MAX_LEVEL}`;
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map[y][x] === 1) {
        ctx.fillStyle = '#444';
        ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
      } else if (map[y][x] === 2) {
        ctx.fillStyle = '#0f0';
        ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
      } else if (map[y][x] === 3 || map[y][x] === 4) {
        // Secret door and trap door: thin reddish line, background same as wall
        ctx.fillStyle = '#444';
        ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
        ctx.fillStyle = '#a33';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x*TILE + TILE/2 - 1, y*TILE + 4, 2, TILE-8);
        ctx.globalAlpha = 1.0;
      }
    }
  }
  // Draw player
  ctx.fillStyle = '#ff0';
  ctx.fillRect(player.x*TILE+2, player.y*TILE+2, TILE-4, TILE-4);
  // Count secret and trap doors
  let secretCount = 0;
  let trapCount = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map[y][x] === 3) secretCount++;
      if (map[y][x] === 4) trapCount++;
    }
  }
  // Show number of secret doors and trap doors below level number (outside canvas)
  let infoElem = document.getElementById('level-info');
  if (infoElem) {
    infoElem.textContent = `Level ${currentLevel + 1} / ${MAX_LEVEL}`;
    let secretInfo = document.getElementById('secret-info');
    if (!secretInfo) {
      secretInfo = document.createElement('div');
      secretInfo.id = 'secret-info';
      secretInfo.style.fontSize = '1em';
      secretInfo.style.marginTop = '4px';
      secretInfo.style.color = '#fff';
      infoElem.parentNode.insertBefore(secretInfo, infoElem.nextSibling);
    }
    secretInfo.textContent = 'Secret doors: ' + secretCount;
    let trapInfo = document.getElementById('trap-info');
    if (!trapInfo) {
      trapInfo = document.createElement('div');
      trapInfo.id = 'trap-info';
      trapInfo.style.fontSize = '1em';
      trapInfo.style.marginTop = '2px';
      trapInfo.style.color = '#fff';
      secretInfo.parentNode.insertBefore(trapInfo, secretInfo.nextSibling);
    }
    trapInfo.textContent = 'Trap doors: ' + trapCount;
    trapInfo.style.display = 'block';
  }
  // Display maze array in grid format in preformatted text area
  var mazePre = document.getElementById('maze-array');
  if (mazePre) {
    let grid = map.map(row => row.map(cell => String(cell)).join(' ')).join('\n');
    mazePre.textContent = grid;
  }
}

document.addEventListener('keydown', e => {
  if (gameState === 'level-select') return;
  let dx = 0, dy = 0;
  if (e.key === 'ArrowUp') dy = -1;
  if (e.key === 'ArrowDown') dy = 1;
  if (e.key === 'ArrowLeft') dx = -1;
  if (e.key === 'ArrowRight') dx = 1;
  if (dx !== 0 || dy !== 0) {
    let nx = player.x + dx, ny = player.y + dy;
    let map = levels[currentLevel];
    if (map[ny][nx] !== 1) {
      // Secret door logic for level 7
      if (map[ny][nx] === 3 && currentLevel === 6) {
        // Teleport through the wall to the other side
        if (ny === 5 && nx === 10) {
          player.x = 11; player.y = 5;
        } else if (ny === 10 && nx === 3) {
          player.x = 3; player.y = 11;
        } else {
          player.x = nx; player.y = ny;
        }
      } else {
        player.x = nx;
        player.y = ny;
      }
      if (map[player.y][player.x] === 2) {
        nextLevel();
      }
    }
    draw();
  }
});

canvas.addEventListener('click', function(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / TILE);
  const y = Math.floor((e.clientY - rect.top) / TILE);
  let map = levels[currentLevel];
  if (map[y] && map[y][x] === 0) {
    player.x = x;
    player.y = y;
    draw();
  }
});

function nextLevel() {
  if (currentLevel < MAX_LEVEL-1) {
    currentLevel++;
    // If the next level is not defined, create a placeholder empty level with an exit
    if (!levels[currentLevel]) {
      // Create a simple empty room with an exit at the far right
      let newLevel = [];
      for (let y = 0; y < MAP_H; y++) {
        let row = [];
        for (let x = 0; x < MAP_W; x++) {
          if (y === 0 || y === MAP_H-1 || x === 0 || x === MAP_W-1) {
            row.push(1); // wall
          } else if (x === MAP_W-2 && y === Math.floor(MAP_H/2)) {
            row.push(2); // exit
          } else {
            row.push(0); // empty
          }
        }
        newLevel.push(row);
      }
      levels[currentLevel] = newLevel;
    }
    resetPlayer();
    draw();
  } else {
    showLevelSelect();
  }
}

function showLevelSelect() {
  gameState = 'level-select';
  const sel = document.getElementById('level-select');
  sel.innerHTML = '<h2>Level Select</h2>';
  for (let i = 0; i < MAX_LEVEL; i++) {
    const btn = document.createElement('button');
    btn.textContent = 'Level ' + (i+1);
    btn.onclick = () => {
      currentLevel = i;
      resetPlayer();
      // Do NOT hide level select after jumping
      // sel.style.display = 'none';
      gameState = 'playing';
      draw();
    };
    sel.appendChild(btn);
  }
  sel.style.display = 'block';
}

function restartGame() {
  currentLevel = 0;
  resetPlayer();
  gameState = 'playing';
  const sel = document.getElementById('level-select');
  if (sel) sel.style.display = 'none';
  draw();
}

resetPlayer();
draw();
