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
      // Regression floor only — set just below current coverage.
      // Ratchet these UP as tests are added; the long-term target is 80%.
      thresholds: {
        statements: 3,
        branches: 51,
        functions: 21,
        lines: 3,
        'src/components/workout/core/workoutReducer.ts': {
          statements: 60,
          branches: 55,
          functions: 60,
          lines: 60,
        },
      },
    },
  },
});
