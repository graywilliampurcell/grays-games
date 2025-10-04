// Escape - Super Basic 16-bit Style Room Escape Game
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
  } else if (i >= 2) {
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
      }
    }
  }
  // Draw player
  ctx.fillStyle = '#ff0';
  ctx.fillRect(player.x*TILE+2, player.y*TILE+2, TILE-4, TILE-4);
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
      player.x = nx;
      player.y = ny;
      if (map[ny][nx] === 2) {
        nextLevel();
      }
    }
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
      sel.style.display = 'none';
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
