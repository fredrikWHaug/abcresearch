#!/usr/bin/env node
/**
 * Local API server to run Vercel functions locally
 * This allows you to test the API endpoints during development
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import the API handlers
const enhanceSearchHandler = require('./api/enhance-search.ts');
const generateResponseHandler = require('./api/generate-response.ts');
const generateSlideHandler = require('./api/generate-slide.ts');
const searchPapersHandler = require('./api/search-papers.ts');

// Mock Vercel request/response objects
function createMockReqRes(req, res) {
  return {
    req: {
      method: req.method,
      body: req.body,
      headers: req.headers,
      query: req.query
    },
    res: {
      status: (code) => ({
        json: (data) => res.status(code).json(data),
        send: (data) => res.status(code).send(data)
      }),
      json: (data) => res.json(data),
      send: (data) => res.send(data)
    }
  };
}

// API Routes
app.post('/api/enhance-search', async (req, res) => {
  console.log('🔍 Local API: enhance-search called');
  const { req: mockReq, res: mockRes } = createMockReqRes(req, res);
  await enhanceSearchHandler.default(mockReq, mockRes);
});

app.post('/api/generate-response', async (req, res) => {
  console.log('💬 Local API: generate-response called');
  const { req: mockReq, res: mockRes } = createMockReqRes(req, res);
  await generateResponseHandler.default(mockReq, mockRes);
});

app.post('/api/generate-slide', async (req, res) => {
  console.log('📊 Local API: generate-slide called');
  const { req: mockReq, res: mockRes } = createMockReqRes(req, res);
  await generateSlideHandler.default(mockReq, mockRes);
});

app.post('/api/search-papers', async (req, res) => {
  console.log('📚 Local API: search-papers called');
  const { req: mockReq, res: mockRes } = createMockReqRes(req, res);
  await searchPapersHandler.default(mockReq, mockRes);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Local API server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /api/enhance-search`);
  console.log(`   POST /api/generate-response`);
  console.log(`   POST /api/generate-slide`);
  console.log(`   POST /api/search-papers`);
  console.log(`   GET  /health`);
  console.log(`\n💡 Update your .env.local to use: VITE_API_TARGET=http://localhost:${PORT}`);
});

module.exports = app;
