import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/test/**',
        '**/__tests__/**',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
      ],
      // Regression floor only — set just below current coverage (~6.6% lines).
      // Ratchet these UP as tests are added; the long-term target is 80%.
      thresholds: {
        statements: 6,
        branches: 40,
        functions: 18,
        lines: 6,
      },
    },
  },
});
