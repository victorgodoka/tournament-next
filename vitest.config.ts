import path from 'node:path'
import { defineConfig } from 'vitest/config'

const contextsDir = path.resolve(__dirname, './contexts')

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.tsx'],
  },
  resolve: {
    alias: [
      { find: /^@contexts\/(.+)/, replacement: `${contextsDir}/$1` },
      { find: '@contexts', replacement: path.resolve(__dirname, './contexts/index.tsx') },
      { find: /^@lib\/(.+)/, replacement: `${path.resolve(__dirname, './lib')}/$1` },
      { find: '@lib', replacement: path.resolve(__dirname, './lib') },
      { find: /^@hooks\/(.+)/, replacement: `${path.resolve(__dirname, './hooks')}/$1` },
      { find: /^@assets\/(.+)/, replacement: `${path.resolve(__dirname, './assets')}/$1` },
      { find: '@assets', replacement: path.resolve(__dirname, './assets') },
      { find: /^@const\/(.+)/, replacement: `${path.resolve(__dirname, './const')}/$1` },
      { find: '@const', replacement: path.resolve(__dirname, './const/index.ts') },
      { find: /^@types\/(.+)/, replacement: `${path.resolve(__dirname, './types')}/$1` },
      { find: /^@test\/(.+)/, replacement: `${path.resolve(__dirname, './test')}/$1` },
      { find: '@components', replacement: path.resolve(__dirname, './components/index.tsx') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
