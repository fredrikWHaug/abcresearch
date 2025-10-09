import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Environment configuration - automatically switches based on npm command
function getApiTarget() {
  // Check for environment variable set by npm scripts
  const environment = process.env.VITE_ENV || 'local'
  
  console.log(`🌍 Using API environment: ${environment}`)
  
  switch (environment) {
    case 'local':
      return 'http://localhost:3001' // Your local API server
    case 'staging':
      return 'https://www.developent.guru'
    case 'production':
      return 'https://abcresearch.vercel.app'
    default:
      return 'http://localhost:3001'
  }
}

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
      // Proxy API calls - easily switch between environments
      '/api': {
        target: getApiTarget(),
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
