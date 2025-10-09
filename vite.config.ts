import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy API calls to the deployed Vercel functions
      '/api': {
        target: process.env.VITE_API_TARGET || 'https://abcresearch.vercel.app',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🚨 API Proxy Error:', err);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('📤 API Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('📥 API Response:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
})
