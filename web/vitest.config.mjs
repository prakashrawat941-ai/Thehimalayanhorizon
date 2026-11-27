import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: { jsx: 'automatic', loader: 'jsx', include: /\.(jsx?|tsx?)$/ },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'node', include: ['test/**/*.test.{js,jsx,ts}'] },
});
