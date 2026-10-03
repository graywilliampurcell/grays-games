import * as THREE from 'three';
import { Player } from './Player.js';
import { Maze } from './Maze.js';
import { LEVELS } from './levels.js';
import { InputManager } from './InputManager.js';
import { CollisionManager } from './CollisionManager.js';
import { installTestHooks, TEST_MODE } from './testHooks.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, loadProgress, saveProgress, clearProgress } from './settings.js';
import { Menu } from './menu.js';
import { Sound } from './sound.js';
import { startUpdateChecks, reloadInto } from './updates.js';

let scene, camera, renderer, player, maze, inputManager, collisionManager, sun;
let escaped = false;
let paused = false;
let quitDone = false; // "Thanks for playing!" is showing
let levelIndex = 0;
let menu;
let sound;
let liveBuild = null; // the newer build updates.js found, if any
// The bot always plays with the default controls and a fresh start
// Which build this is (vite.config.js): e.g. Mazle 0.13.0 (build 765a327)
export const VERSION = { version: __APP_VERSION__, build: __APP_BUILD__ };
window.MAZLE_VERSION = VERSION;

const settings = TEST_MODE ? { ...DEFAULT_SETTINGS } : loadSettings();
let messageTimer = null;
let testHooks = null; // only set with ?test=1

// You touch the spike when you're this close to the edge of its plate
const SPIKE_TOUCH_MARGIN = 0.25; // normal spike: 0.75 + 0.25 = 1.0
const DOOR_TOUCH_DISTANCE = 1.3;
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue (each level sets its own)
    scene.fog = new THREE.Fog(0x87ceeb, 200, 500);

    // Camera setup
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(10, 2, 10);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Touch screens (iPad) get the on-screen controls; computers get the keys
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        document.body.classList.add('touch');
    }

    // Sun; loadLevel sizes its shadow area to the maze
    sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.far = 200;
    scene.add(sun);
    scene.add(sun.target);

    // The saved spot's level sits behind the main menu (test mode: Level 1, straight into play)
    const progress = savedSpot();
    if (progress) levelIndex = progress.level;
    loadLevel(LEVELS[levelIndex], levelIndex);

    // Player setup
    player = new Player(camera, settings);
    player.resetTo(maze.getStartPosition(), maze.getStartYaw());
    if (progress) player.resetTo(new THREE.Vector3(progress.x, 0, progress.z), progress.yaw, progress.pitch);

    // Input manager
    inputManager = new InputManager();

    // Pause menu, Settings and Quit
    menu = new Menu({
        settings,
        canPause: () => !escaped && !quitDone,
        pause,
        resume,
        startOver,
        quit,
        nextLevel,
        hasSave: () => !!savedSpot(),
        continueGame,
        newGame,
        toMainMenu,
        reloadForUpdate,
        changeSettings,
    });
    applySettings();
    document.addEventListener('mazle:touch', applySettings);

    // Music and sound effects. No music on the main menu; a level's tune starts
    // with the level (and, in test mode, with the first key press or tap).
    sound = new Sound(settings, (name) => testHooks?.emit('sound', { name }));
    sound.setTune(LEVELS[levelIndex]?.music);

    // Settings shows which version is loaded (plan Section 7)
    document.getElementById('version-line').textContent = `Mazle ${VERSION.version} (build ${VERSION.build})`;
    // Newer build live? Reload into it at once, or ask with the "new version" box
    startUpdateChecks(VERSION, (live) => {
        liveBuild = live.build;
        menu.updateFound();
    }, { enabled: !TEST_MODE });

    // The game opens on the main menu (plan Section 6). Test mode skips it so
    // the play bot starts straight in Level 1.
    if (TEST_MODE) {
        sound.startMusic();
    } else {
        pause();
        document.body.classList.add('title');
        menu.showTitle();
    }
    if (TEST_MODE) window.__sound = sound; // lets browser tests measure the sound

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    testHooks = installTestHooks({
        getScene: () => scene,
        getPlayer: () => player,
        getMaze: () => maze,
        getLevelIndex: () => levelIndex,
        loadLevel,
        isEscaped: () => escaped,
        step,
        render,
        playAgain,
    });

    // Start animation loop
    animate();
}

// Swap in a level's maze, colors and name. index is its place in LEVELS
// (-1 for a test layout). Doesn't move the player.
function loadLevel(level, index) {
    levelIndex = index;
    maze?.dispose();
    const theme = level.theme || LEVELS[0].theme;
    maze = new Maze(scene, level.layout, theme, { spikeRadius: level.spikeRadius ?? LEVELS[index]?.spikeRadius });
    maze.build();
    collisionManager = new CollisionManager(maze.getMazeData());
    scene.background.set(theme.sky);
    scene.fog.color.set(theme.sky);

    const cx = maze.width / 2;
    const cz = maze.depth / 2;
    sun.position.set(cx + 20, 60, cz + 30);
    sun.target.position.set(cx, 0, cz);
    const shadowSize = Math.max(maze.width, maze.depth) * 0.75;
    Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize });
    sun.shadow.camera.updateProjectionMatrix();

    document.getElementById('level').textContent = level.name;
    sound?.setTune(level.music || LEVELS[index]?.music);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    // Clamp big gaps, e.g. after switching tabs. In test mode the bot steps the game.
    if (paused) {
        // Everything stays frozen while the menu is open
    } else if (!testHooks) {
        step(Math.min(deltaTime, 0.1));
    } else if (testHooks.realtime) {
        testHooks.advance(Math.min(deltaTime, 0.1));
    }

    // Update FPS
    frameCount++;
    if (now - lastTime > 1000 || frameCount === 1) {
        fps = Math.round(frameCount / ((now - lastTime) / 1000));
        frameCount = 0;
    }

    render();
}

function step(deltaTime) {
    // Update player movement
    player.update(inputManager, collisionManager, deltaTime);
    checkSpikeAndDoor();

    // Update camera to follow player
    camera.position.copy(player.camera.position);
    camera.rotation.copy(player.camera.rotation);
}

function render() {
    // Update UI
    updateUI();

    // Render
    renderer.render(scene, camera);
}

function horizontalDistance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function checkSpikeAndDoor() {
    if (escaped) return;

    if (horizontalDistance(player.position, maze.spikePosition) < maze.spikeRadius + SPIKE_TOUCH_MARGIN) {
        player.resetTo(maze.getStartPosition(), maze.getStartYaw());
        testHooks?.emit('spike');
        sound.ouch();
        showMessage('Ouch! A spike sent you back to the start.');
    }

    if (horizontalDistance(player.position, maze.doorPosition) < DOOR_TOUCH_DISTANCE) {
        escaped = true;
        player.frozen = true;
        player.releaseAll();
        document.body.classList.add('escaped');
        sound.cheer();
        // "You did it!" (Start the next level / Quit), or after the last level "More levels coming soon!"
        menu.showFinish(LEVELS[levelIndex + 1]?.name);
        testHooks?.emit('escape');
    }
}

function showMessage(text) {
    const el = document.getElementById('message');
    el.textContent = text;
    testHooks?.emit('message', { text });
    el.hidden = false;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

// Back to the start of the current level (also used by the test bot)
function playAgain() {
    escaped = false;
    player.frozen = false;
    player.releaseAll();
    player.resetTo(maze.getStartPosition(), maze.getStartYaw());
    menu.dismiss();
    document.body.classList.remove('escaped');
}

function nextLevel() {
    loadLevel(LEVELS[levelIndex + 1], levelIndex + 1);
    playAgain();
    testHooks?.emit('level', { index: levelIndex });
}

// The saved spot (from Quit or Main menu), if it's for a level that exists.
// Test mode ignores it.
function savedSpot() {
    const progress = TEST_MODE ? null : loadProgress();
    return progress && LEVELS[progress.level] ? progress : null;
}

// Leave the main menu and start playing (the menu resumes the game)
function startPlaying(index) {
    if (index !== levelIndex) loadLevel(LEVELS[index], index);
    playAgain();
    quitDone = false;
    document.body.classList.remove('title', 'done');
    document.getElementById('thanks').hidden = true;
    sound.startMusic();
}

// Main menu → Continue: back to the saved spot, facing the same way
function continueGame() {
    const progress = savedSpot();
    if (!progress) return newGame();
    startPlaying(progress.level);
    player.resetTo(new THREE.Vector3(progress.x, 0, progress.z), progress.yaw, progress.pitch);
}

// Main menu → New game: erase the saved spot and start Level 1 from its start
function newGame() {
    clearProgress();
    startPlaying(0);
}

// "A new version of Mazle is ready!" → Reload now: save the spot the same way
// Main menu does (unless it came up on the main menu), then load the new build
function reloadForUpdate(from) {
    if (from !== 'title') saveSpot();
    sound.stopMusic();
    reloadInto(liveBuild);
}

// Pause menu → Main menu: save the spot the same way Quit does, music stops
function toMainMenu() {
    saveSpot();
    sound.stopMusic();
    document.body.classList.add('title');
}

// Pause menu actions
function pause() {
    paused = true;
    player.paused = true;
    player.releaseAll();
    document.body.classList.add('paused');
}

function resume() {
    paused = false;
    player.paused = false;
    player.releaseAll(); // keys pressed in the menu don't carry into the game
    document.body.classList.remove('paused');
}

function startOver() {
    player.resetTo(maze.getStartPosition(), maze.getStartYaw());
}

// Save where Gray is (level, exact position, facing). After reaching the door,
// save right next to it, facing it.
function saveSpot() {
    if (escaped) {
        const { position, yaw } = maze.getDoorApproach();
        saveProgress({ level: levelIndex, x: position.x, z: position.z, yaw, pitch: 0 });
    } else {
        const facing = player.facing();
        saveProgress({ level: levelIndex, x: player.position.x, z: player.position.z, yaw: facing.yaw, pitch: facing.pitch });
    }
}

function quit() {
    saveSpot();
    quitDone = true;
    sound.stopMusic();
    document.body.classList.add('done');
    document.getElementById('thanks').hidden = false;
}

// Settings: control setups, and how see-through and big the touch controls are
function changeSettings(changes) {
    const before = { ...settings };
    Object.assign(settings, changes);
    if (!TEST_MODE) saveSettings(settings);
    // Setups that can't look up or down start level
    if (changes.touchSetup === 'simple' && before.touchSetup !== 'simple') player.levelView();
    applySettings();
    sound.applySettings();
}

function applySettings() {
    const body = document.body;
    for (const id of ['circles', 'arrows', 'simple']) body.classList.toggle(`touch-${id}`, settings.touchSetup === id);
    for (const id of ['simple', 'shift', 'full']) body.classList.toggle(`keys-${id}`, settings.keyboardSetup === id);
    body.style.setProperty('--ctl-opacity', settings.seeThrough / 10);
    body.style.setProperty('--ctl-scale', 1 + (settings.size - 5) * 0.1);
}

function updateUI() {
    const fpsElement = document.getElementById('fps');
    const posElement = document.getElementById('position');

    if (fpsElement) {
        fpsElement.textContent = fps;
    }

    if (posElement) {
        const pos = player.position;
        posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
}

// Initialize on page load
window.addEventListener('load', init);