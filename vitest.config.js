import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    globals: false,
    // Node >=25 exposes a built-in localStorage that shadows jsdom's.
    // Forking workers and passing --no-experimental-webstorage keeps jsdom's
    // Storage in place so tests touching localStorage behave consistently.
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--no-experimental-webstorage'],
      },
    },
  },
});
