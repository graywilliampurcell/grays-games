import * as THREE from 'three';
import { Player } from './Player.js';
import { Maze, SPIN_WALL_TIME, TRAPDOOR_WARNING_TIME, SEA_LEVEL, CANNON_FUSE, CANNON_FLIGHT, CANNON_HEIGHT } from './Maze.js';
import { RoomMaze } from './RoomMaze.js';
import { Buddy } from './Buddy.js';
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
// Dinosaur World (Level 111 on): the baby triceratops buddy (see Buddy.js)
let buddy = null;
// The "Do you need help?" question: always while playing; in test mode only
// with ?lost=1, so the play bot isn't stopped by it
const LOST_ASKS = !TEST_MODE || new URLSearchParams(window.location.search).get('lost') === '1';

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
// A marshmallow (Level 52 on) bounces you over the chocolate river: this long, this high
const BOUNCE_TIME = 1.2;
const BOUNCE_HEIGHT = 2.5;
let wasOnMarshmallow = null;
// Pirate Ship World (Level 121 on): walking off an edge into the water, you
// fall all the way down to the sea (WATER_FALL_TIME), splash, and see the
// splash for SPLASH_SEE_TIME before "Ouch! Splash! Back to the start."
const WATER_FALL_TIME = 1.5;
const SPLASH_SEE_TIME = 0.8;
let falling = null; // { time, from, x, z, splashed } while falling into the sea
let fuseSound = null; // the cannon fuse's fizz, while it's fizzing
// Windy hallways (Sky World, Level 132 on): walking into the wind you go at
// WIND_INTO of your speed, with it WIND_WITH; its whoosh is heard from up to
// WIND_HEAR_DISTANCE away, loudest (WIND_LEVEL) inside the hallway
const WIND_INTO = 0.6;
const WIND_WITH = 1.4;
const WIND_HEAR_DISTANCE = 6;
const WIND_LEVEL = 0.55;
let windVoice = null;
// A slow propeller's low hum (Sky World, Level 135 on) gets louder as you
// come near; a blade's touch pushes you one square back, taking this long
const PROPELLER_HEAR_DISTANCE = 14;
const PROPELLER_LEVEL = 0.6;
const PROPELLER_PUSH_TIME = 0.45;
let humVoice = null;
// Thick fog (Sky World, Level 134 on; starting values Gray will judge):
// inside it you see clearly only FOG_NEAR around you, and everything is
// white from FOG_FAR on (about one corridor cell). It closes in over
// Maze.js FOG_EDGE as you walk in, changing at most FOG_FADE a second.
const FOG_NEAR = 1;
const FOG_FAR = 4.5;
const FOG_FADE = 6;
const FOG_WHITE = new THREE.Color(0xeef1f4);
let fogView = 0; // 0 = clear, 1 = deep in the fog
const skyLook = { color: new THREE.Color(), near: 200, far: 500 };
let fogVeil = null; // a white shell around you, hiding what the scene's fog doesn't (the sun, the clouds far below)
// Sticky caramel (Level 52 on): you walk at half speed while you're on it
const CARAMEL_SPEED = 0.5;
// A steam vent's puff (Volcano World) pushes you one square back, taking this long
const VENT_PUSH_TIME = 0.45;
// A tail swish (Dinosaur World, Level 112 on) pushes you one square back,
// taking this long; its soft swoosh fades out over this distance
const TAIL_PUSH_TIME = 0.45;
const SWOOSH_HEAR_DISTANCE = 20;
// Standing at the fossil hunt's locked door (its message shows once each time you walk up to it)
let atLockedDoor = false;
// How far away an erupting lava geyser can be heard (it gets quieter with distance)
const GEYSER_HEAR_DISTANCE = 24;
// How far away a trapdoor's warning rumble can be heard
const TRAPDOOR_HEAR_DISTANCE = 16;
// A backward belt (Robot Factory World, Level 82 on) flings you back to the
// first cell of its hallway this fast; its siren fades out over this distance
const BELT_FLING_TIME = 0.5;
const SIREN_HEAR_DISTANCE = 30;
// A robot arm (Level 84 on) pushes you off its belt, back to the floor cell
// just before it, taking this long
const ARM_PUSH_TIME = 0.5;
const VENT_HISS_TIME = 1;
// A snowball (Ice World) pushes you one square back, taking this long; his
// throw is heard this far away (quieter with distance)
const SNOWBALL_PUSH_TIME = 0.45;
// Hearing a snowman (Gray, 2026-10-16; starting values Gray will judge):
// silent more than SNOWMAN_HEAR_CELLS corridor cells from his hallway,
// louder as you come closer, full in his hallway. His loudness changes by at
// most 1 / SNOWMAN_FADE_TIME a second, so with two snowmen, once you're past
// the first one he goes quiet within SNOWMAN_FADE_TIME seconds.
const SNOWMAN_HEAR_CELLS = 6;
const SNOWMAN_FADE_TIME = 1.0;
// The balloon lets you out (Volcano World): you step out onto the floor, taking this long
const BALLOON_STEP_OUT_TIME = 0.4;
// The button door's grinding sound lasts as long as it takes to open (Maze.js BUTTON_DOOR_OPEN_TIME)
const BUTTON_DOOR_GRIND_TIME = 1;
// After a spinning wall's turn, you step off into the middle of the cell beyond it
const SPIN_STEP_OFF_TIME = 0.3;
// The cloud trampoline (Sky World, Level 133 on) bounces you over its wall
// in one arc this long (starting value Gray will judge), this high at the
// top (your eyes go up to about 5.6, above the 4-high walls)
const TRAMPOLINE_TIME = 1.5;
const TRAMPOLINE_HEIGHT = 4;
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
    // Level 100's rooms are each drawn only inside their own walls
    renderer.localClippingEnabled = true;
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
    buddy?.start(false);
    if (progress) {
        player.resetTo(new THREE.Vector3(progress.x, 0, progress.z), progress.yaw, progress.pitch);
        maze.setButtonPressed?.(progress);
        maze.setFossils?.(progress.fossils ?? []);
        showFossilCount();
        buddy?.placeNear(player.position, progress.yaw);
    }

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
        helpAnswer,
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
        getBuddy: () => buddy,
        getFogView: () => fogView,
    });

    // Start animation loop
    animate();
}

// Swap in a level's maze, colors and name. index is its place in LEVELS
// (-1 for a test layout). Doesn't move the player.
function loadLevel(level, index) {
    levelIndex = index;
    // The old level's snowmen stop being heard
    for (const s of maze?.snowmen ?? []) s.voice?.gain.disconnect();
    sound?.stopWind(windVoice);
    windVoice = null;
    sound?.stopWind(humVoice);
    humVoice = null;
    maze?.dispose();
    const options = {
        spikeRadius: level.spikeRadius ?? LEVELS[index]?.spikeRadius,
        spike2Radius: level.spike2Radius ?? LEVELS[index]?.spike2Radius,
        golden: !!(level.finale ?? LEVELS[index]?.finale),
        beltQuiet: level.beltQuiet ?? LEVELS[index]?.beltQuiet,
        armInterval: level.armInterval ?? LEVELS[index]?.armInterval,
        plank: level.plank ?? LEVELS[index]?.plank,
        rocking: !!(level.rocking ?? LEVELS[index]?.rocking),
    };
    // Level 100: one maze in 9 rooms, each in its own world's look
    maze = level.rooms ? new RoomMaze(scene, level, options) : new Maze(scene, level.layout, level.theme || LEVELS[0].theme, options);
    maze.build();
    buddy = maze.theme.dino && !level.rooms ? new Buddy(maze, level.layout) : null;
    collisionManager = new CollisionManager(maze.getMazeData());
    showSky(maze.theme);
    wasInCurrent = null;

    const cx = maze.width / 2;
    const cz = maze.depth / 2;
    sun.position.set(cx + 20, 60, cz + 30);
    sun.target.position.set(cx, 0, cz);
    const shadowSize = Math.max(maze.width, maze.depth) * 0.75;
    Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize });
    sun.shadow.camera.updateProjectionMatrix();

    document.getElementById('level').textContent = level.name;
    atLockedDoor = false;
    showFossilCount();
    sound?.setTune(maze.music || level.music || LEVELS[index]?.music);
}

// The sky color and fog of a world's look
function showSky(theme) {
    scene.background.set(theme.sky);
    scene.fog.color.set(theme.sky);
    // Under the sea the water goes hazy blue in the distance
    scene.fog.near = theme.underwater ? 40 : 200;
    scene.fog.far = theme.underwater ? 220 : 500;
    skyLook.color.set(theme.sky);
    skyLook.near = scene.fog.near;
    skyLook.far = scene.fog.far;
    fogView = 0;
    if (fogVeil) fogVeil.visible = false;
}

// Thick fog (Sky World, Level 134 on): the deeper into it you are, the
// closer the white closes in around you, until you see only about one
// corridor cell. Called every game step.
function updateFog(deltaTime) {
    if (!maze.fogs?.length && fogView === 0) return;
    const target = escaped ? 0 : maze.fogAt?.(player.camera.position) ?? 0;
    const change = FOG_FADE * deltaTime;
    fogView = target > fogView ? Math.min(target, fogView + change) : Math.max(target, fogView - change);
    // Ease the distances in on a log scale, so the fog closes in smoothly
    const ease = (from, to) => Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * fogView);
    scene.fog.near = ease(skyLook.near, FOG_NEAR);
    scene.fog.far = ease(skyLook.far, FOG_FAR);
    scene.fog.color.copy(skyLook.color).lerp(FOG_WHITE, fogView);
    scene.background.copy(skyLook.color).lerp(FOG_WHITE, fogView);
    if (!fogVeil) {
        fogVeil = new THREE.Mesh(new THREE.SphereGeometry(FOG_FAR + 0.5, 24, 16), new THREE.MeshBasicMaterial({ color: FOG_WHITE, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        fogVeil.renderOrder = 999;
        scene.add(fogVeil);
    }
    fogVeil.material.opacity = fogView;
    fogVeil.visible = fogView > 0;
}

// Level 100: walking into the next room changes the sky to that room's, and
// its tune takes over with a smooth crossfade of about 1 second
const ROOM_CROSSFADE = 1;
function checkRoom() {
    if (!maze.updateRoom?.(player.position)) return;
    showSky(maze.theme);
    sound.crossfadeTo(maze.music, ROOM_CROSSFADE);
    testHooks?.emit('room', { index: maze.active, music: maze.music });
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
    // Falling into the sea (Pirate Ship World): nothing else happens till you're back at the start
    if (falling) {
        updateWaterFall(deltaTime);
        camera.position.copy(player.camera.position);
        camera.rotation.copy(player.camera.rotation);
        return;
    }
    // Windy hallways (Sky World, Level 132 on): inside one, walking into the
    // wind is slower and walking with it faster (Player.js); its streaks and
    // leaves blow along (they stop while paused, this is the game step); its
    // whoosh gets louder as you come near
    const wind = maze.windAt?.(player.position);
    player.wind = wind && !escaped ? wind.dir : null;
    player.windInto = WIND_INTO;
    player.windWith = WIND_WITH;
    if (maze.winds?.length) {
        maze.updateWinds(deltaTime);
        windVoice ??= sound.windVoice();
        const near = Math.min(...maze.winds.map((w) => maze.windDistance(w, player.position)));
        sound.setVoice(windVoice, WIND_LEVEL * Math.max(0, 1 - near / WIND_HEAR_DISTANCE));
    }
    // Update player movement
    player.update(inputManager, collisionManager, deltaTime);
    updateFog(deltaTime);
    // The rocking ship (Pirate Ship World, Level 124 on): every so often the
    // whole ship tips gently to one side and back with a soft creak, and you
    // slide a little toward the low side (stopping at walls), except near a
    // water gap, a spike or a wave. It stops while paused (this is the game step).
    if (maze.updateRocking?.(deltaTime) === 'tip') {
        sound.shipCreak();
        testHooks?.emit('rock', { side: maze.rocking.side });
    }
    if (maze.rocking && !player.shove && !player.carried && !player.spinning && !escaped) {
        const dz = maze.rockSlide(deltaTime);
        if (dz) {
            const moved = player.position.clone();
            moved.z += dz;
            if (maze.rockSafeAt(player.position) && maze.rockSafeAt(moved) && collisionManager.isPositionValid(moved, player.radius)) {
                player.position.copy(moved);
                player.camera.position.set(player.position.x, player.position.y + 1.6, player.position.z);
                maze.rocking.slid = (maze.rocking.slid ?? 0) + Math.abs(dz);
            }
        }
    }
    // Space doors (Level 12 on) slide open and shut by themselves
    maze.updateSpaceDoor(deltaTime, player.position, player.radius);
    // Button doors (Desert Pyramid World, Level 101 on): stepping on the
    // button sinks it with a click and the stone door slides down into the
    // floor; it stays open until you're sent back to the start
    for (const event of maze.updateButtonDoor?.(deltaTime, player.position, player.radius) ?? []) {
        if (event === 'press') {
            sound.click();
            sound.grind(BUTTON_DOOR_GRIND_TIME);
        }
        testHooks?.emit(event === 'press' ? 'button' : 'buttonDoorOpen');
    }
    // The fossil hunt (Dinosaur World, Level 113 on): walking onto a fossil
    // picks it up with a ding; finding the last one pops the padlock off
    // the exit door with a click. Only you pick them up (not the buddy).
    for (const { event } of maze.updateFossils?.(deltaTime, player.position, player.radius) ?? []) {
        if (event === 'collect') {
            sound.ding();
            testHooks?.emit('fossil', { found: maze.fossilCount.found });
        }
        if (event === 'unlock') {
            sound.click();
            testHooks?.emit('fossilUnlock');
        }
        showFossilCount();
    }
    // The spinning secret wall (Desert Pyramid World, Level 103 on): walk
    // into the wall with the golden beetle and it turns round, carrying you
    // to its other side, facing away from it. It works from both sides.
    if (maze.spinWall) {
        if (!maze.spinWall.spin && !player.shove && !player.carried && !escaped) {
            const side = maze.spinWallTouch(player.position, player.radius, player.direction);
            if (side) {
                maze.startSpin(player.position, side, player.radius);
                player.spinning = true;
                player.velocity.set(0, 0, 0);
                player.slide = null;
                sound.grind(SPIN_WALL_TIME);
                testHooks?.emit('spinStart');
            }
        }
        const spin = maze.updateSpinWall(deltaTime);
        if (spin) {
            player.position.x = spin.position.x;
            player.position.z = spin.position.z;
            player.camera.position.set(player.position.x, player.position.y + 1.6, player.position.z);
            if (spin.done) {
                player.spinning = false;
                player.startShove(spin.step, SPIN_STEP_OFF_TIME);
                testHooks?.emit('spin');
            }
        }
    }
    // The cloud trampoline (Sky World, Level 133 on): step onto it and it
    // squishes and bounces you up over the wall at the end of its corridor
    // with a boing, landing you in the middle of the cell beyond, turned to
    // face the way you were going. You can't steer or fall. In the air you
    // see only its cell, the wall and the landing cell.
    if (maze.trampolines?.length) maze.updateTrampoline(deltaTime);
    for (const t of maze.trampolines ?? []) {
        if (!t.bouncing && !player.shove && !player.carried && !player.spinning && !escaped && maze.onTrampoline(player.position) === t) {
            t.squish = 1;
            player.euler.setFromQuaternion(player.camera.quaternion);
            t.bouncing = { time: 0, fromYaw: player.euler.y, toYaw: Math.atan2(-t.dir.x, -t.dir.z) };
            player.startShove(t.landing, TRAMPOLINE_TIME, TRAMPOLINE_HEIGHT);
            maze.setTrampolineView(true, t);
            sound.boing();
            testHooks?.emit('trampoline', { what: 'bounce' });
        }
        if (t.bouncing) {
            const b = t.bouncing;
            b.time = Math.min(TRAMPOLINE_TIME, b.time + deltaTime);
            const u = Math.min(1, b.time / (TRAMPOLINE_TIME * 0.6));
            const turn = Math.atan2(Math.sin(b.toYaw - b.fromYaw), Math.cos(b.toYaw - b.fromYaw));
            player.euler.setFromQuaternion(player.camera.quaternion);
            player.euler.y = b.fromYaw + turn * u * u * (3 - 2 * u);
            player.camera.quaternion.setFromEuler(player.euler);
            if (!player.shove) {
                t.bouncing = null;
                maze.setTrampolineView(false, t);
                testHooks?.emit('trampoline', { what: 'land' });
            }
        }
    }
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
    // Steam vents (Volcano World): each runs on its own timer (quiet, then
    // wisps and a hiss, then a puff); a puff pushes anyone on it one square
    // back toward the start. A vent is only heard until you're past it (Gray,
    // 2026-10-15): once you're entirely on its far side it goes silent (a
    // sound already playing fades out), and it sounds again if you end up
    // back on its start side.
    for (const vent of maze.vents) {
        vent.audible = maze.ventAudible(vent, player.position, player.radius);
        if (!vent.audible && vent.sound) {
            sound.hush(vent.sound);
            vent.sound = null;
        }
    }
    for (const { vent, event } of maze.updateVents(deltaTime, player.position, player.radius)) {
        // (A big wave, Pirate Ship World: a rushing sound as it rises over
        // the rail, then a splash; its push is a wash back, not an Ouch)
        if (event === 'warning' && vent.audible) vent.sound = vent.wave ? sound.rush(VENT_HISS_TIME) : sound.hiss(VENT_HISS_TIME);
        if (event === 'puff' && vent.audible) vent.sound = vent.wave ? sound.wash() : sound.puff();
        if (event === 'push' && !player.shove) {
            player.startShove(vent.target, VENT_PUSH_TIME);
            testHooks?.emit(vent.wave ? 'wave' : 'steam');
        }
    }
    // Tail swishes (Dinosaur World): each tail is lifted for a while, then
    // swishes low across its cell, on its own cycle; a swish that touches
    // you pushes you one square back toward the start (not an Ouch)
    for (const { tail, event } of maze.updateTails?.(deltaTime, player.position, player.radius) ?? []) {
        if (event === 'swish') {
            sound.swoosh(Math.max(0, 1 - horizontalDistance(player.position, tail.center) / SWOOSH_HEAR_DISTANCE));
            testHooks?.emit('swish');
        }
        if (event === 'push' && !player.shove) {
            player.startShove(tail.target, TAIL_PUSH_TIME);
            testHooks?.emit('tailPush');
        }
    }
    // Slow propellers (Sky World, Level 135 on): the blades turn slowly
    // across the hallway (frozen while paused, this is the game step); one
    // that touches you pushes you one square back toward the start (not an
    // Ouch). Its low hum gets louder as you come near.
    if (maze.propellers?.length) {
        for (const { propeller, event } of maze.updatePropellers(deltaTime, escaped ? null : player.position, player.radius, player.height)) {
            if (event === 'push' && !player.shove) {
                player.startShove(propeller.target, PROPELLER_PUSH_TIME);
                testHooks?.emit('propellerPush');
            }
        }
        humVoice ??= sound.humVoice();
        sound.setVoice(humVoice, PROPELLER_LEVEL * Math.max(0, 1 - maze.propellerDistance(player.position) / PROPELLER_HEAR_DISTANCE));
    }
    // Lava geysers (Volcano World): each erupts for a while, then is quiet,
    // on its own timer; it never starts while you're in it. Being in one while
    // it erupts sends you back to the start.
    for (const { geyser, event } of maze.updateGeysers(deltaTime, player.position, player.radius)) {
        if (event === 'erupt') {
            sound.roar(Math.max(0, 1 - horizontalDistance(player.position, geyser.center) / GEYSER_HEAR_DISTANCE));
            testHooks?.emit('geyser');
        }
        if (event === 'hit' && !escaped) {
            backToStart();
            testHooks?.emit('spike', { what: 'geyser' });
            sound.ouch();
            showMessage('Ouch! The lava geyser sent you back to the start.');
        }
    }
    // Trapdoors (Desert Pyramid World, Level 104 on): each one is shut for a
    // while, shakes and rumbles for a second, then drops open, on its own
    // timer; it can open right under you. Your center over an open one sends
    // you back to the start.
    for (const { trapdoor, event } of maze.updateTrapdoors(deltaTime, player.position)) {
        const near = Math.max(0, 1 - horizontalDistance(player.position, trapdoor.center) / TRAPDOOR_HEAR_DISTANCE);
        if (event === 'warning') {
            sound.rumble(near, TRAPDOOR_WARNING_TIME);
            testHooks?.emit('trapdoorWarning');
        }
        if (event === 'open') {
            if (near > 0.01) sound.clonk();
            testHooks?.emit('trapdoorOpen');
        }
        if (event === 'fall' && !escaped && !player.carried) {
            backToStart();
            testHooks?.emit('spike', { what: 'trapdoor' });
            sound.ouch();
            showMessage('Ouch! You fell through the trapdoor. Back to the start.');
        }
    }
    // Snowmen (Ice World, Level 72 on): each throws a snowball down his
    // hallway on a timer; one that touches you pushes you one square back
    // toward the start (it never sends you to the start)
    // You hear each snowball rolling down his hallway, from a few squares
    // away, before you can see him. With one snowman that's all: louder as you
    // come closer, quieter as you walk away. With two, once you're past one
    // (entirely on his far side, like a steam vent) he fades out quickly, so
    // you hear the other one sooner.
    for (const snowman of maze.snowmen) {
        const { cells, past } = maze.snowmanHearing(snowman, player.position, player.radius);
        const want = past && maze.snowmen.length > 1 ? 0 : Math.max(0, Math.min(1, 1 - cells / SNOWMAN_HEAR_CELLS));
        const most = deltaTime / SNOWMAN_FADE_TIME;
        const now = snowman.hearing ?? want;
        snowman.hearing = now + Math.max(-most, Math.min(most, want - now));
        snowman.voice ??= sound.snowmanVoice();
        sound.setVoice(snowman.voice, snowman.hearing);
        // A snowball that's gone (it hit you, or the level reset) stops rolling
        snowman.rolls = (snowman.rolls ?? []).filter((r) => {
            if (snowman.balls.includes(r.ball) && sound.ctx && sound.ctx.currentTime < r.sound.end) return true;
            sound.hush(r.sound);
            return false;
        });
    }
    for (const { snowman, event, target, ball } of maze.updateSnowmen(deltaTime, player.position, player.radius)) {
        if (event === 'throw') {
            const rolling = sound.roll(snowman.voice, snowman.flight);
            if (rolling) snowman.rolls.push({ ball, sound: rolling });
            testHooks?.emit('throw');
        }
        if (event === 'hit' && !player.shove && !escaped) {
            player.startShove(target, SNOWBALL_PUSH_TIME);
            sound.splat();
            testHooks?.emit('snowball');
        }
    }
    // Backward belts (Robot Factory World, Level 82 on): each runs on a
    // fixed cycle, off and quiet, then a warning (yellow lights blink twice
    // and the red light's siren swells twice), then on, racing backward.
    // Touching it while it's on flings you back to the back of its hallway
    // (not an Ouch). The cycle stops while paused (this is the game step).
    for (const { belt, event } of maze.updateBelts(deltaTime, player.position, player.radius)) {
        if (event === 'warning') {
            sound.siren(Math.max(0, 1 - horizontalDistance(player.position, belt.redPosition) / SIREN_HEAR_DISTANCE));
            testHooks?.emit('beltWarning');
        }
        if (event === 'on') testHooks?.emit('beltOn');
        if (event === 'fling' && !player.shove && !escaped) {
            player.startShove(belt.landing, BELT_FLING_TIME);
            testHooks?.emit('belt');
        }
    }
    // Robot-arm belts (Robot Factory World, Level 84 on): the belt carries
    // you forward (you can still walk and steer on it); arms slide back
    // along one half at a time, and one that touches you pushes you back off
    // the belt (not an Ouch). The arms stop while paused (this is the game step).
    if (maze.armBelts.length && !player.shove && !player.carried && !escaped) {
        const belt = maze.armBeltAt(player.position);
        if (belt) {
            const moved = player.position.clone().addScaledVector(belt.forward, maze.armBeltSpeed * deltaTime);
            if (collisionManager.isPositionValid(moved, player.radius)) player.position.copy(moved);
            player.camera.position.set(player.position.x, player.position.y + 1.6, player.position.z);
        }
    }
    for (const { belt, event } of maze.updateArmBelts(deltaTime, player.position, player.radius)) {
        if (event === 'arm') testHooks?.emit('arm');
        if (event === 'push' && !player.shove && !escaped) {
            player.startShove(belt.landing, ARM_PUSH_TIME);
            sound.clonk();
            testHooks?.emit('armPush');
        }
    }
    // Thin ice (Ice World, Level 73 on): stand on it too long and it breaks,
    // sending you back to the start; keep moving and you're safe
    for (const { event } of maze.updateThinIce(deltaTime, player.position, player.radius)) {
        if (event === 'break' && !escaped) {
            backToStart();
            testHooks?.emit('spike', { what: 'thinIce' });
            testHooks?.emit('thinIce');
            sound.ouch();
            showMessage('Ouch! The thin ice broke. Back to the start.');
        }
    }
    // Sticky caramel (Level 52 on): half speed while on it, normal as soon as you're off
    player.sticky = maze.onCaramel(player.position) ? CARAMEL_SPEED : 1;
    // Marshmallow (Level 52 on): stepping onto one bounces you over the
    // chocolate river in one arc, landing safely on the far bank
    if (!player.shove) {
        const pad = maze.marshmallowAt(player.position);
        if (pad && pad !== wasOnMarshmallow) {
            pad.squish = 1;
            player.startShove(pad.landing, BOUNCE_TIME, BOUNCE_HEIGHT);
            testHooks?.emit('bounce');
        }
        wasOnMarshmallow = pad;
    }
    // Moving platform (Level 17 on): carries the player across the gap.
    // Underwater (Level 42 on) it's a bubble you push into first.
    const platformEvent = maze.updatePlatform(deltaTime, player.position, player.velocity, player.radius);
    if (platformEvent) testHooks?.emit('platform', { what: platformEvent });
    // The hot-air balloon (Volcano World): its burner roars as it sets off;
    // in the air you're carried up with it; down at the far edge you step out.
    // The sled (Ice World) holds you the same way while it zooms across.
    // The sled is silent (Gray, 2026-10-16), so its "shh" can't be mistaken
    // for anything else.
    if (platformEvent === 'depart' && maze.theme.volcano) sound.whoosh(0.8);
    // The flying carpet (Desert Pyramid World): a soft swish as it takes off with you
    if (platformEvent === 'depart' && maze.theme.desert) sound.whoosh(0.6, 0.5);
    const lift = maze.rideLift();
    player.carried = lift !== null;
    if (lift !== null) player.camera.position.set(player.position.x, player.position.y + 1.6 + lift, player.position.z);
    if (platformEvent === 'land') player.startShove(maze.landing, BALLOON_STEP_OUT_TIME);
    // The long-neck (Dinosaur World): a soft friendly rumble as it swings you across
    if (platformEvent === 'depart' && maze.theme.dino) sound.whoosh(0.7, 0.4);
    // The rainbow bridge (Sky World): a soft shimmer as it appears, quieter the further you are
    if (platformEvent === 'appear' && maze.theme.skyland) {
        const p = maze.eventPlatform ?? maze.platforms.reduce((a, b) => (horizontalDistance(player.position, platformMiddle(b)) < horizontalDistance(player.position, platformMiddle(a)) ? b : a));
        sound.shimmer(Math.max(0, 1 - horizontalDistance(player.position, platformMiddle(p)) / RAINBOW_HEAR_DISTANCE));
    }
    // The cannons (Pirate Ship World): fully inside one, its fuse fizzes;
    // after CANNON_FUSE it fires with a BOOM and you fly over the water gap
    // in one arc into the other cannon (you can look around, not steer or fall)
    for (const { cannon, event } of maze.updateCannons?.(deltaTime, player.position, !!player.shove?.hop) ?? []) {
        if (event === 'load') fuseSound = sound.fizz(CANNON_FUSE);
        if (event === 'cancel' || event === 'fire') {
            sound.hush(fuseSound);
            fuseSound = null;
        }
        if (event === 'fire') {
            player.startShove(cannon.landing, CANNON_FLIGHT, CANNON_HEIGHT);
            sound.boom();
        }
        testHooks?.emit('cannon', { what: event });
    }
    updateBuddy(deltaTime);
    checkSpikeAndDoor();
    checkRoom();

    // Update camera to follow player
    camera.position.copy(player.camera.position);
    camera.rotation.copy(player.camera.rotation);
}

// The rocking ship: you lean with the ship, so the sea and sky tilt (the
// ship tips about the west-east line, its low side north or south). The
// lean is only added while drawing, so it never changes where you look.
const ROCK_AXIS = new THREE.Vector3(1, 0, 0);
const rockLean = new THREE.Quaternion();
const unleaned = new THREE.Quaternion();

function render() {
    // Update UI
    updateUI();

    // Render
    if (fogVeil?.visible) fogVeil.position.copy(camera.position);
    const r = maze?.rocking;
    if (r?.angle) {
        unleaned.copy(camera.quaternion);
        camera.quaternion.premultiply(rockLean.setFromAxisAngle(ROCK_AXIS, r.side * r.angle));
        renderer.render(scene, camera);
        camera.quaternion.copy(unleaned);
    } else {
        renderer.render(scene, camera);
    }
}

// The middle of a platform's gap
function platformMiddle(p) {
    return { x: (p.gap.minX + p.gap.maxX) / 2, z: (p.gap.minZ + p.gap.maxZ) / 2 };
}
// You hear a rainbow appear from up to this far away (louder the closer you are)
const RAINBOW_HEAR_DISTANCE = 12;

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
                : maze.theme.sweets ? 'Ouch! A broken candy cane sent you back to the start.'
                : maze.theme.volcano ? 'Ouch! A hot coal sent you back to the start.'
                : maze.theme.ice ? 'Ouch! An icicle sent you back to the start.'
                : maze.theme.factory ? 'Ouch! A zapper sent you back to the start.'
                : maze.theme.desert ? 'Ouch! A cactus sent you back to the start.'
                : maze.theme.dino ? 'Ouch! A bone spike sent you back to the start.'
                : maze.theme.pirate ? 'Ouch! A splinter spike sent you back to the start.'
                : maze.theme.skyland ? 'Ouch! A storm cloud sent you back to the start.'
                : 'Ouch! A spike sent you back to the start.');
    }

    // Walking into the gap (no platform under you) works like a spike.
    // Never while a marshmallow is bouncing you over the chocolate.
    if (!player.shove?.hop && maze.fallsIntoGap(player.position) && maze.theme.pirate) {
        startWaterFall();
    } else if (!player.shove?.hop && maze.fallsIntoGap(player.position)) {
        backToStart();
        testHooks?.emit('fall');
        sound.ouch();
        showMessage(maze.theme.moon ? 'Ouch! You fell in a crater. Back to the start.'
            : maze.theme.underwater || maze.theme.ice ? 'Ouch! You fell in the crack. Back to the start.'
                : maze.theme.sweets ? 'Ouch! You fell in the chocolate. Back to the start.'
                : maze.theme.volcano ? 'Ouch! You fell in the lava. Back to the start.'
                : maze.theme.factory ? 'Ouch! You fell in the gap. Back to the start.'
                : maze.theme.desert ? 'Ouch! You fell in the sand pit. Back to the start.'
                : maze.theme.dino ? 'Ouch! You fell in the pit. Back to the start.'
                : maze.theme.skyland ? 'Ouch! You fell off the island. Back to the start.'
                : 'Whoops! You fell off. Back to the start.');
    }

    const atDoor = horizontalDistance(player.position, maze.doorPosition) < DOOR_TOUCH_DISTANCE;
    if (atDoor && maze.fossilsLocked) {
        // The fossil hunt: the door is locked (solid like a wall) until every
        // fossil is found; walking up to it says so once and starts nothing
        if (!atLockedDoor) {
            showMessage(`Find all ${maze.fossilCount.of} fossils first!`);
            testHooks?.emit('lockedDoor');
        }
        atLockedDoor = true;
    } else if (atDoor) {
        atLockedDoor = false;
        escaped = true;
        player.frozen = true;
        player.releaseAll();
        document.body.classList.add('escaped');
        // The finale (Level 10): confetti, an extra-long cheer and its own end screen
        const finale = LEVELS[levelIndex]?.finale;
        beatLevel(levelIndex);
        // Level 67: "Six seven!" instead of the cheer while the 6 7 switch is on
        sound.cheer({ long: !!finale, sixSeven: !!LEVELS[levelIndex]?.sixSeven && settings.sixSeven });
        if (finale) showConfetti();
        // Level 100: fireworks bursting in the sky too
        if (LEVELS[levelIndex]?.fireworks) showFireworks();
        // "You did it!" (Start the next level / Quit), the finale's screen, or "More levels coming soon!"
        menu.showFinish(LEVELS[levelIndex + 1]?.name, finale, LEVELS[levelIndex]?.nextLabel);
        testHooks?.emit('escape');
    } else {
        atLockedDoor = false;
    }
}

// The fossil hunt's counter under the level name: "🦴 1 / 3" (only in a
// level with fossils)
function showFossilCount() {
    const el = document.getElementById('fossils');
    const { found = 0, of = 0 } = maze?.fossilCount ?? {};
    el.hidden = !of;
    el.textContent = `🦴 ${found} / ${of}`;
    el.classList.toggle('all', of > 0 && found === of);
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

// Fireworks bursting in the sky over the screen for a few seconds (Level
// 100's ending). Each burst pops (a sound effect, so the Sound effects
// switch turns the pops off).
const FIREWORKS_TIME = 7;
function showFireworks() {
    const canvas = document.getElementById('fireworks');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.hidden = false;
    const colors = ['#ff4f9a', '#4fc3ff', '#ffd84a', '#7dff6a', '#c79bff', '#ffffff', '#ff9f4a'];
    const bursts = [];
    const sparks = [];
    // Rockets go up from the bottom and burst in the top half, one after another
    for (let k = 0; k < 16; k++) bursts.push({ at: 0.15 + k * 0.4 + Math.random() * 0.25, x: 0.12 + Math.random() * 0.76, y: 0.12 + Math.random() * 0.33, color: colors[k % colors.length], done: false });
    const start = performance.now();
    let last = start;
    testHooks?.emit('fireworks');
    cancelAnimationFrame(showFireworks.frame);
    const frame = (now) => {
        const t = (now - start) / 1000;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        // Fade the old frame a little, so sparks leave short trails
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';
        for (const b of bursts) {
            if (b.done || t < b.at - 0.6) continue;
            const x = b.x * canvas.width;
            const y = b.y * canvas.height;
            if (t < b.at) {
                // The rocket climbing
                const k = 1 - (b.at - t) / 0.6;
                ctx.fillStyle = '#ffe9b0';
                ctx.beginPath();
                ctx.arc(x, canvas.height - (canvas.height - y) * k, 3, 0, Math.PI * 2);
                ctx.fill();
                continue;
            }
            b.done = true;
            sound.pop();
            const size = Math.min(canvas.width, canvas.height);
            for (let n = 0; n < 70; n++) {
                const a = (n / 70) * Math.PI * 2;
                const speed = size * (0.32 + Math.random() * 0.16);
                sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1.2 + Math.random() * 0.5, color: Math.random() < 0.2 ? '#ffffff' : b.color });
            }
        }
        for (const s of sparks) {
            s.life -= dt;
            s.vx *= 1 - dt * 1.6;
            s.vy = s.vy * (1 - dt * 1.6) + dt * 60;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (s.life <= 0) continue;
            ctx.globalAlpha = Math.min(1, s.life);
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (let n = sparks.length - 1; n >= 0; n--) if (sparks[n].life <= 0) sparks.splice(n, 1);
        if (t < FIREWORKS_TIME || sparks.length) {
            showFireworks.frame = requestAnimationFrame(frame);
        } else {
            canvas.hidden = true;
        }
    };
    showFireworks.frame = requestAnimationFrame(frame);
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
// Walking off an edge into the water (Pirate Ship World): you fall all the
// way down to the sea, looking down at it as it rushes up, then splash
function startWaterFall() {
    const spot = maze.waterFallSpot?.(player.position) ?? player.position;
    falling = { time: 0, from: player.position.y + 1.6, x: spot.x, z: spot.z, splashed: false, pitch: player.facing().pitch, yaw: player.facing().yaw };
    player.velocity.set(0, 0, 0);
    player.slide = null;
    player.releaseAll();
    sound.hush(fuseSound);
    testHooks?.emit('waterFall');
}

function updateWaterFall(deltaTime) {
    const f = falling;
    f.time += deltaTime;
    const t = Math.min(1, f.time / WATER_FALL_TIME);
    // Speeding up as you fall, down to just above the water (high enough to see the splash below you)
    const y = f.from + (SEA_LEVEL + 2.4 - f.from) * t * t;
    player.camera.position.set(f.x, y, f.z);
    // Tipping forward to look down at the sea
    const pitch = f.pitch + (-1.25 - f.pitch) * Math.min(1, t * 1.6);
    player.camera.quaternion.setFromEuler(new THREE.Euler(pitch, f.yaw, 0, 'YXZ'));
    if (t >= 1 && !f.splashed) {
        f.splashed = true;
        maze.splashAt(f.x, f.z);
        sound.splash();
        testHooks?.emit('splash');
    }
    if (f.time >= WATER_FALL_TIME + SPLASH_SEE_TIME) {
        falling = null;
        backToStart();
        testHooks?.emit('fall');
        sound.ouch();
        showMessage('Ouch! Splash! Back to the start.');
    }
}

function backToStart() {
    falling = null;
    player.resetTo(maze.getStartPosition(), maze.getStartYaw());
    player.sticky = 1;
    player.carried = false;
    wasOnMarshmallow = null;
    maze.resetPlatform();
    maze.resetButtonDoor?.();
    maze.resetSpinWall?.();
    for (const t of maze.trampolines ?? []) {
        t.bouncing = null;
        maze.setTrampolineView(false, t);
    }
    buddy?.backToStart();
}

// The baby triceratops (Dinosaur World): he hatches, follows you, and asks
// if you need help when you're really lost (see Buddy.js)
function updateBuddy(deltaTime) {
    if (!buddy) return;
    for (const event of buddy.update(deltaTime, player)) {
        if (event === 'crack') sound.eggCrack();
        if (event === 'hatch') sound.squeak();
        testHooks?.emit('buddy', { what: event });
    }
    if (escaped || !LOST_ASKS) return;
    if (buddy.updateLost(deltaTime, player.position) && menu.state === 'closed' && !player.carried && !player.shove && !maze.overGap(player.position)) {
        pause();
        menu.showHelp();
        testHooks?.emit('lost');
    }
}

// "Do you need help, or do you want to keep going?": Help me! (true) or No, I'm good
function helpAnswer(help) {
    if (help) buddy?.startHelping(player.position);
    testHooks?.emit('help', { help });
}

// Back to the start of the current level (also used by the test bot)
function playAgain() {
    escaped = false;
    player.frozen = false;
    player.releaseAll();
    backToStart();
    // A level starting from its start: no fossils found yet
    maze.setFossils?.([]);
    showFossilCount();
    // A level starting from its start: Level 111's egg hatches (the 111 switch)
    buddy?.start(!!LEVELS[levelIndex]?.hatch && settings.dinoHatch);
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
    maze.setButtonPressed?.(progress);
    maze.setFossils?.(progress.fossils ?? []);
    showFossilCount();
    buddy?.placeNear(player.position, progress.yaw);
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
    sound.setVoice(windVoice, 0);
    sound.setVoice(humVoice, 0);
    sound.stopMusic();
    document.body.classList.add('title');
}

// Pause menu actions
function pause() {
    paused = true;
    player.paused = true;
    sound.setVoice(windVoice, 0); // the wind's whoosh comes back when you play on
    sound.setVoice(humVoice, 0); // and so does a propeller's hum
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
    // Desert Pyramid World: whether each button door's button has been pressed
    const doors = maze.buttonDoors ?? [];
    const button = { ...(doors[0]?.pressed ? { button: true } : {}), ...(doors[1]?.pressed ? { button2: true } : {}) };
    // Dinosaur World's fossil hunt: which fossils have been found
    const found = maze.collectedFossils?.() ?? [];
    if (found.length) button.fossils = found;
    if (escaped) {
        const { position, yaw } = maze.getDoorApproach();
        saveProgress({ level: levelIndex, x: position.x, z: position.z, yaw, pitch: 0, ...button });
    } else if (maze.overGap(player.position)) {
        // On a moving platform: save the spot just before its gap on the start's side
        const { position, yaw } = maze.platformStartEdge(player.position);
        saveProgress({ level: levelIndex, x: position.x, z: position.z, yaw, pitch: 0, ...button });
    } else {
        const facing = player.facing();
        saveProgress({ level: levelIndex, x: player.position.x, z: player.position.z, yaw: facing.yaw, pitch: facing.pitch, ...button });
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