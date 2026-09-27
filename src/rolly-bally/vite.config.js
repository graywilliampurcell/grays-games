import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    // Rapier's compat build inlines its WASM as base64; that chunk is big on purpose.
    chunkSizeWarningLimit: 6000,
  },
  server: {
    allowedHosts: ['lsl.josephdpurcell.com'],
  },
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
});
