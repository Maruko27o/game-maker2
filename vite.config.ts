/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// A version stamp for this build: the deploy commit SHA in CI, else the build
// time. Baked into the bundle (__APP_VERSION__) AND emitted as version.json, so a
// running (possibly cached) bundle can notice a newer deploy and offer to update.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const APP_VERSION = (env.GITHUB_SHA ?? '').slice(0, 7) || String(Date.now());

// Emit version.json into the build output alongside index.html.
function emitVersion(): Plugin {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) });
    },
  };
}

// base './' keeps asset paths relative so the build works when served
// from a GitHub Pages project subpath (…/game-maker2/).
export default defineConfig({
  base: './',
  plugins: [react(), emitVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
