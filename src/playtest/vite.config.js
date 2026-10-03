import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// Game version: package.json "version" (0.<plan iteration>.<fix>), plus the
// short git commit it was built from. CI sets GITHUB_SHA; locally ask git;
// the dev server is always 'dev'. The build also writes version.json next to
// index.html so anyone can check which build is live.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

function gitBuild() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig(({ command }) => {
  const build = command === 'build' ? gitBuild() : 'dev'
  return {
    root: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_BUILD__: JSON.stringify(build)
    },
    plugins: [{
      name: 'mazle-version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ game: 'mazle', version: pkg.version, build })}\n` })
      }
    }],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: 'terser'
    },
    server: {
      port: 5173,
      open: true
    }
  }
})
