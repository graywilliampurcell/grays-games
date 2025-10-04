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
  } else {
    // Placeholder: empty room with exit at far right
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
    levels[i] = newLevel;
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
