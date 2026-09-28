import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Build id for the self-update check (src/app/selfUpdate.js): the git commit.
// CI sets GITHUB_SHA; locally ask git; the dev server is always 'dev'.
function gitBuild() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(({ command }) => {
  const build = command === 'build' ? gitBuild() : 'dev';
  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_BUILD__: JSON.stringify(build),
    },
    plugins: [{
      // version.json next to index.html: what the running game compares itself to.
      name: 'rolly-bally-version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ version: pkg.version, build })}\n` });
      },
    }],
    build: {
      outDir: 'dist',
      // Rapier's compat build inlines its WASM as base64; that chunk is big on purpose.
      chunkSizeWarningLimit: 6000,
    },
    server: {
      allowedHosts: [],
    },
    test: {
      include: ['test/**/*.test.js'],
      environment: 'node',
    },
  };
});
