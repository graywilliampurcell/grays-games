// Mode registry: name → lazy import of a module whose default export is a
// mode class (constructed with no arguments). See CONTRACT.md §Modes.
// Lazy imports keep each mode in its own chunk.

export const MODES = {
  'test-track': () => import('../test-track/TestTrackMode.js'),
  race: () => import('../race/RaceMode.js'),
  playground: () => import('../playground/PlaygroundMode.js'),
  gallery: () => import('../track-gallery/GalleryMode.js'),
};

export async function loadMode(name) {
  const loader = MODES[name];
  if (!loader) throw new Error(`Unknown mode "${name}"`);
  const mod = await loader();
  const ModeClass = mod.default;
  return new ModeClass();
}
