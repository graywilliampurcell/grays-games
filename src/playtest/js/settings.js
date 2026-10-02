// Settings and saved progress, kept in the browser between sessions.

const SETTINGS_KEY = 'mazle.settings';
const PROGRESS_KEY = 'mazle.progress';

// The three control setups on each kind of device (plan Section 4)
export const TOUCH_SETUPS = [
    { id: 'circles', name: 'Circles' },
    { id: 'arrows', name: 'Arrows' },
    { id: 'simple', name: 'Simple' },
];
export const KEYBOARD_SETUPS = [
    { id: 'simple', name: 'Simple' },
    { id: 'shift', name: 'Arrows + Shift' },
    { id: 'full', name: 'Full' },
];

export const DEFAULT_SETTINGS = {
    touchSetup: 'circles',
    keyboardSetup: 'full',
    seeThrough: 6, // 1-10: how solid the on-screen controls are (10% per step)
    size: 5, // 1-10: 5 = normal size, 10% bigger or smaller per step
    music: true,
    sfx: true, // sound effects
};

function read(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

function write(key, value) {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private browsing or storage turned off: the game still works, it just forgets
    }
}

const step = (v, fallback) => (Number.isInteger(v) && v >= 1 && v <= 10 ? v : fallback);

export function loadSettings() {
    const saved = read(SETTINGS_KEY) || {};
    return {
        touchSetup: TOUCH_SETUPS.some((s) => s.id === saved.touchSetup) ? saved.touchSetup : DEFAULT_SETTINGS.touchSetup,
        keyboardSetup: KEYBOARD_SETUPS.some((s) => s.id === saved.keyboardSetup) ? saved.keyboardSetup : DEFAULT_SETTINGS.keyboardSetup,
        seeThrough: step(saved.seeThrough, DEFAULT_SETTINGS.seeThrough),
        size: step(saved.size, DEFAULT_SETTINGS.size),
        music: typeof saved.music === 'boolean' ? saved.music : DEFAULT_SETTINGS.music,
        sfx: typeof saved.sfx === 'boolean' ? saved.sfx : DEFAULT_SETTINGS.sfx,
    };
}

export function saveSettings(settings) {
    write(SETTINGS_KEY, settings);
}

// Where the player was when they quit: { level, x, z, yaw, pitch }
export function loadProgress() {
    const p = read(PROGRESS_KEY);
    if (!p || ![p.level, p.x, p.z, p.yaw, p.pitch].every(Number.isFinite)) return null;
    return p;
}

export function saveProgress(progress) {
    write(PROGRESS_KEY, progress);
}

export function clearProgress() {
    write(PROGRESS_KEY, null);
}
