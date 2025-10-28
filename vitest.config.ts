<<<<<<< HEAD
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
=======
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
>>>>>>> 3f1142a (fix bugs -- ABC-44)

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
<<<<<<< HEAD
    setupFiles: './test/setup.ts',
=======
    setupFiles: './src/test/setup.ts',
>>>>>>> 3f1142a (fix bugs -- ABC-44)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
<<<<<<< HEAD
});
=======
})
>>>>>>> 3f1142a (fix bugs -- ABC-44)

