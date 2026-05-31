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
      // Global regression floor. These are deliberately below the project's
      // 80% target so CI passes today, but they MUST be ratcheted UP as tests
      // are added until they reach 80 (see .claude/rules/common/testing.md).
      thresholds: {
        statements: 25,
        branches: 50,
        functions: 20,
        lines: 25,
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
