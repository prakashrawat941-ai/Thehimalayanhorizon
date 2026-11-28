import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.{js,jsx}', 'test/**/*.test.{js,jsx,ts}'],
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.js'],
    clearMocks: true,
  },
});
