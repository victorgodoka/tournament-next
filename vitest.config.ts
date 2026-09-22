import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** Mirrors the `paths` block in tsconfig.json so tests import the same specifiers the app does. */
export default defineConfig({
  resolve: {
    alias: {
      '@app': dir('./app'),
      '@ui': dir('./components/ui'),
      '@omega': dir('./components/omega'),
      '@utils': dir('./utils'),
      '@contexts': dir('./contexts'),
      '@hooks': dir('./hooks'),
    },
  },
})
