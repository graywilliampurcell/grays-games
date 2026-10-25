// Shared setup for the Mazle level tests in tests/levels/.
// Playwright comes from tools/playbot (the repo's one Playwright install):
// run `npm ci` in tools/playbot first.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export { chromium } from '../../../tools/playbot/node_modules/playwright/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// The built game, served by run-levels.mjs (or any static server on dist/).
export const BASE = process.env.MAZLE_URL || 'http://127.0.0.1:9173';

// Screenshots go here; the folder is gitignored.
export const SHOTS = (process.env.MAZLE_SHOTS || path.join(here, 'shots')) + '/';
fs.mkdirSync(SHOTS, { recursive: true });
