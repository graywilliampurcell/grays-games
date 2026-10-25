// Runs the Mazle level tests in tests/levels/ against a build in dist/.
//
//   npm run build -- --base ./ --outDir dist     (once, after any game change)
//   npm run test:levels                           (all tests)
//   npm run test:levels -- 150 l149 l113-quit     (only files whose name matches)
//
// Env: MAZLE_PORT (default 9173), JOBS (tests run at once, default 2).
// A test passes when it exits 0 and prints no line starting with FAIL.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const levelsDir = path.join(here, 'levels');
const port = Number(process.env.MAZLE_PORT || 9173);
const jobs = Number(process.env.JOBS || 2);

if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('No dist/ build. Run: npx vite build --base ./ --minify esbuild --outDir dist');
    process.exit(2);
}

const filters = process.argv.slice(2);
const files = fs.readdirSync(levelsDir)
    .filter((f) => f.endsWith('.mjs'))
    .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
    .sort();
if (!files.length) {
    console.error('No tests match', filters.join(' '));
    process.exit(2);
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dist, p);
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end();
        return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
const env = { ...process.env, MAZLE_URL: `http://127.0.0.1:${port}` };

const run = (f) => new Promise((done) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(levelsDir, f)], { env });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
        const fails = out.split('\n').filter((l) => l.startsWith('FAIL'));
        const ok = code === 0 && !fails.length;
        const secs = Math.round((Date.now() - t0) / 1000);
        console.log(`${ok ? 'PASS' : 'FAIL'} ${f} (${secs}s)`);
        if (!ok) console.log((fails.length ? fails.join('\n') : out.trim().split('\n').slice(-15).join('\n')).replace(/^/gm, '    '));
        done(ok);
    });
});

const queue = [...files];
const results = [];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) results.push(await run(queue.shift()));
}));
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} level tests passed`);
process.exit(failed ? 1 : 0);
