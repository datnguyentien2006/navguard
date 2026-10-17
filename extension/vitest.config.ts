import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/background/**', 'src/shared/**'],
      exclude: [
        'src/background/index.ts',
        'src/background/reputation.ts',
        'src/background/storage.ts'
      ]
    }
  }
});
