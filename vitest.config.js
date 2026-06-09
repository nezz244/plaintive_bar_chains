import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.mjs'],
    setupFiles: ['tests/setup.mjs'],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
})
