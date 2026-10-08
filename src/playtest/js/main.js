import * as THREE from 'three';
import { Player } from './Player.js';
import { Maze } from './Maze.js';
import { LEVELS } from './levels.js';
import { InputManager } from './InputManager.js';
import { CollisionManager } from './CollisionManager.js';
import { installTestHooks, TEST_MODE } from './testHooks.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, loadProgress, saveProgress, clearProgress, loadFurthest, saveFurthest, loadNews, saveNews } from './settings.js';
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
let furthest = 0; // furthest level reached (a LEVELS index), for Pick a level
// What's new: levels told about, the furthest level beaten (exit door reached)
// and the levels wearing a NEW! sticker
let news = { told: [], beaten: -1, fresh: [] };
// The levels everyone has already been told about when What's new arrives
const ALREADY_TOLD = 21; // Levels 1-21
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
// Stepping onto a slippery spot carries you about one extra step on
const SLIDE_DISTANCE = 1.5;
const SLIDE_MIN_SPEED = 4;
let wasOnSlippery = false;
// A water current (Level 41) shoves you into its side dead end, taking this long
const SHOVE_TIME = 0.8;
let wasInCurrent = null;
const lastOutsideCurrent = new THREE.Vector3();
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
    // Pick a level: the furthest level reached. The first time, the saved
    // spot's level counts as reached. Test mode starts fresh and saves nothing.
    const savedFurthest = TEST_MODE ? null : loadFurthest();
    furthest = Math.min(savedFurthest ?? progress?.level ?? 0, LEVELS.length - 1);
    if (!TEST_MODE && savedFurthest === null) saveFurthest(furthest);
    // What's new: the first time, Levels 1-21 count as told about, every
    // level below the furthest reached counts as beaten, and the furthest
    // reached too if the saved spot is right by its exit door. Test mode
    // starts with every level told about, so nothing is announced.
    const savedNews = TEST_MODE ? null : loadNews();
    if (savedNews) {
        news = savedNews;
    } else {
        const told = TEST_MODE ? LEVELS.length : Math.min(ALREADY_TOLD, LEVELS.length);
        news = { told: [...Array(told).keys()], beaten: furthest - 1, fresh: [] };
        if (progress && progress.level === furthest && byExitDoor(progress)) news.beaten = furthest;
        if (!TEST_MODE) saveNews(news);
    }
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
        furthestLevel: () => furthest,
        checkNews,
        freshLevels: () => news.fresh,
        pickLevel,
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
    maze = new Maze(scene, level.layout, theme, {
        spikeRadius: level.spikeRadius ?? LEVELS[index]?.spikeRadius,
        spike2Radius: level.spike2Radius ?? LEVELS[index]?.spike2Radius,
        golden: !!(level.finale ?? LEVELS[index]?.finale),
    });
    maze.build();
    collisionManager = new CollisionManager(maze.getMazeData());
    scene.background.set(theme.sky);
    scene.fog.color.set(theme.sky);
    wasInCurrent = null;
    // Under the sea the water goes hazy blue in the distance
    scene.fog.near = theme.underwater ? 40 : 200;
    scene.fog.far = theme.underwater ? 220 : 500;

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

    // Things flying through the sky (Space World) keep moving, even while paused
    maze?.update?.(Math.min(deltaTime, 0.1));

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
    // Space doors (Level 12 on) slide open and shut by themselves
    maze.updateSpaceDoor(deltaTime, player.position, player.radius);
    // Slippery spots (Level 13 on): stepping onto one starts a slide
    const onSlippery = maze.onSlipperySpot(player.position);
    if (onSlippery && !wasOnSlippery && player.startSlide(SLIDE_DISTANCE, SLIDE_MIN_SPEED)) testHooks?.emit('slide');
    wasOnSlippery = onSlippery;
    // Water current (Level 41): walking into it from the path shoves you about
    // one square into its side dead end. Walking back out of that dead end
    // isn't pushed, and you can walk on either way until you leave its area
    // and come back in from the path.
    // Level 49 has two; each works on its own.
    if (maze.currents.length && !player.shove) {
        const inCurrent = maze.inCurrent(player.position);
        if (inCurrent && inCurrent !== wasInCurrent && !maze.cameFromCurrentDeadEnd(lastOutsideCurrent, inCurrent)) {
            player.startShove(inCurrent.target, SHOVE_TIME);
            testHooks?.emit('current');
        }
        if (!inCurrent) lastOutsideCurrent.copy(player.position);
        wasInCurrent = inCurrent;
    }
    // Moving platform (Level 17 on): carries the player across the gap.
    // Underwater (Level 42 on) it's a bubble you push into first.
    const platformEvent = maze.updatePlatform(deltaTime, player.position, player.velocity, player.radius);
    if (platformEvent) testHooks?.emit('platform', { what: platformEvent });
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

    if (maze.touchesSpike(player.position, SPIKE_TOUCH_MARGIN)) {
        backToStart();
        testHooks?.emit('spike');
        sound.ouch();
        showMessage(maze.theme.moon ? 'Ouch! You fell in a crater. Back to the start.'
            : maze.theme.underwater ? 'Ouch! A sea urchin sent you back to the start.'
                : 'Ouch! A spike sent you back to the start.');
    }

    // Walking into the gap (no platform under you) works like a spike
    if (maze.fallsIntoGap(player.position)) {
        backToStart();
        testHooks?.emit('fall');
        sound.ouch();
        showMessage(maze.theme.moon ? 'Ouch! You fell in a crater. Back to the start.'
            : maze.theme.underwater ? 'Ouch! You fell in the crack. Back to the start.'
                : 'Whoops! You fell off. Back to the start.');
    }

    if (horizontalDistance(player.position, maze.doorPosition) < DOOR_TOUCH_DISTANCE) {
        escaped = true;
        player.frozen = true;
        player.releaseAll();
        document.body.classList.add('escaped');
        // The finale (Level 10): confetti, an extra-long cheer and its own end screen
        const finale = LEVELS[levelIndex]?.finale;
        beatLevel(levelIndex);
        sound.cheer({ long: !!finale });
        if (finale) showConfetti();
        // "You did it!" (Start the next level / Quit), the finale's screen, or "More levels coming soon!"
        menu.showFinish(LEVELS[levelIndex + 1]?.name, finale, LEVELS[levelIndex]?.nextLabel);
        testHooks?.emit('escape');
    }
}

// Confetti falling over the whole screen for a few seconds (the finale)
function showConfetti() {
    const layer = document.getElementById('confetti');
    layer.innerHTML = '';
    const colors = ['#ff6fb5', '#6fc3ff', '#ffd84a', '#9cff7a', '#c79bff', '#ffffff', '#ff9f4a'];
    for (let k = 0; k < 160; k++) {
        const piece = document.createElement('i');
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[k % colors.length];
        piece.style.animationDelay = `${Math.random() * 1.2}s`;
        piece.style.animationDuration = `${2.6 + Math.random() * 2}s`;
        piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
        piece.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720)}deg`);
        layer.appendChild(piece);
    }
    layer.hidden = false;
    testHooks?.emit('confetti');
    clearTimeout(showConfetti.timer);
    showConfetti.timer = setTimeout(() => {
        layer.hidden = true;
        layer.innerHTML = '';
    }, 6500);
}

function showMessage(text) {
    const el = document.getElementById('message');
    el.textContent = text;
    testHooks?.emit('message', { text });
    el.hidden = false;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

// Back to the start of the level; the moving platform goes back to the start's side too
function backToStart() {
    player.resetTo(maze.getStartPosition(), maze.getStartYaw());
    maze.resetPlatform();
}

// Back to the start of the current level (also used by the test bot)
function playAgain() {
    escaped = false;
    player.frozen = false;
    player.releaseAll();
    backToStart();
    menu.dismiss();
    document.body.classList.remove('escaped');
}

// A level counts as reached once it starts. It never goes down, except
// through New game → Yes. Starting a level also takes off its NEW! sticker.
function reachLevel(index) {
    if (news.fresh.includes(index)) {
        news.fresh = news.fresh.filter((n) => n !== index);
        if (!TEST_MODE) saveNews(news);
    }
    if (index <= furthest) return;
    furthest = index;
    if (!TEST_MODE) saveFurthest(furthest);
}

// Reaching a level's exit door: it's beaten
function beatLevel(index) {
    if (index <= news.beaten) return;
    news.beaten = index;
    if (!TEST_MODE) saveNews(news);
}

// Is a saved spot the one saved after reaching its level's exit door (right
// in front of the door, Maze.getDoorApproach)?
function byExitDoor(spot) {
    const layout = LEVELS[spot.level]?.layout;
    if (!layout) return false;
    const z = layout.findIndex((row) => row.includes('D'));
    if (z < 0) return false;
    const x = layout[z].indexOf('D');
    const w = layout[0].length;
    const DOOR_APPROACH = 1.7; // Maze.js DOOR_APPROACH_DISTANCE
    const [ax, az] = x === w - 1 ? [x - DOOR_APPROACH, z + 0.5] : x === 0 ? [x + 1 + DOOR_APPROACH, z + 0.5]
        : z === 0 ? [x + 0.5, z + 1 + DOOR_APPROACH] : [x + 0.5, z - DOOR_APPROACH];
    return Math.hypot(spot.x - ax, spot.z - az) < 0.05;
}

// What's new (plan Section 9), each time the main menu opens: every built
// level not told about yet whose level before it is beaten unlocks, gets a
// NEW! sticker, and is announced. One already started is just marked told.
// Returns the newly announced levels (LEVELS indexes).
function checkNews() {
    const announced = [];
    for (let index = 0; index < LEVELS.length; index++) {
        if (news.told.includes(index)) continue;
        if (index <= furthest) {
            news.told.push(index);
        } else if (index - 1 <= news.beaten) {
            news.told.push(index);
            news.fresh.push(index);
            furthest = index;
            announced.push(index);
        }
    }
    if (!TEST_MODE) {
        saveNews(news);
        saveFurthest(furthest);
    }
    return announced;
}

function nextLevel() {
    loadLevel(LEVELS[levelIndex + 1], levelIndex + 1);
    reachLevel(levelIndex);
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
    reachLevel(index);
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

// Main menu → New game: erase the saved spot and start Level 1 from its start.
// After "Are you sure?" → Yes the levels lock again too (a fresh start).
function newGame(lockLevels) {
    clearProgress();
    if (lockLevels) {
        // A fresh start: levels locked again, no NEW! stickers, nothing beaten
        furthest = 0;
        news.fresh = [];
        news.beaten = -1;
        if (!TEST_MODE) {
            saveFurthest(0);
            saveNews(news);
        }
    }
    startPlaying(0);
}

// Main menu → Pick a level: start a reached level at its start. That spot
// replaces the saved spot (if there was one).
function pickLevel(index) {
    if (!LEVELS[index] || index > furthest) return;
    const hadSave = !!savedSpot();
    startPlaying(index);
    if (hadSave) saveSpot();
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
    backToStart();
}

// Save where Gray is (level, exact position, facing). After reaching the door,
// save right next to it, facing it.
function saveSpot() {
    if (escaped) {
        const { position, yaw } = maze.getDoorApproach();
        saveProgress({ level: levelIndex, x: position.x, z: position.z, yaw, pitch: 0 });
    } else if (maze.overGap(player.position)) {
        // On a moving platform: save the spot just before its gap on the start's side
        const { position, yaw } = maze.platformStartEdge(player.position);
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