// Tiny static file server (node:http only) serving several builds under path prefixes,
// e.g. { mazle: '/abs/build/mazle' } -> http://host:port/mazle/
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function handler(mounts) {
  return (req, res) => {
    const url = new URL(req.url, 'http://x');
    const [, prefix, ...rest] = decodeURIComponent(url.pathname).split('/');
    const root = mounts[prefix];
    if (!root) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    if (rest.length === 0) { // /mazle -> /mazle/
      res.writeHead(301, { location: `/${prefix}/${url.search}` }).end();
      return;
    }
    let file = normalize(join(root, ...rest));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const size = statSync(file).size;
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': size,
        'cache-control': 'no-store',
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  };
}

function listen(server, host, port) {
  return new Promise((resolvePromise, reject) => {
    const onError = (err) => { server.off('listening', onListening); reject(err); };
    const onListening = () => { server.off('error', onError); resolvePromise(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/**
 * Start the static server. If `port` is busy, tries the next ports (up to `maxTries`).
 * Returns { baseUrl, host, port, close(), urlFor(game) }.
 */
export async function startServer(mounts, { host = '127.0.0.1', port = 9073, maxTries = 50 } = {}) {
  const absMounts = Object.fromEntries(Object.entries(mounts).map(([k, v]) => [k, resolve(v)]));
  const server = createServer(handler(absMounts));
  let chosen = null;
  for (let p = port; p < port + maxTries; p++) {
    try {
      await listen(server, host, p);
      chosen = p;
      break;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  if (chosen === null) throw new Error(`No free port on ${host} in ${port}..${port + maxTries - 1}`);
  if (chosen !== port) console.error(`[server] port ${port} is busy; using ${chosen} instead`);
  const baseUrl = `http://${host}:${chosen}`;
  console.error(`[server] serving ${Object.keys(absMounts).map((m) => `${baseUrl}/${m}/`).join(', ')}`);
  return {
    host,
    port: chosen,
    baseUrl,
    urlFor: (game) => `${baseUrl}/${game}/`,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
