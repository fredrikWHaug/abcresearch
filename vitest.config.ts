import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup/vitest.setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './__tests__/output/coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '__tests__/',
        '__tests_legacy__/',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/types/**',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        global: {
          statements: 60,
          branches: 60,
          functions: 50,
          lines: 60,
        },
      },
    },
    
    // Test file patterns
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '__tests_legacy__/**', 'dist'],
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './__tests__'),
    },
  },
})
