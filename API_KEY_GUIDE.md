# API Key Configuration Guide

## How to Avoid "API Key Not Configured" Issues

### 1. Environment File Structure

Your project uses different environment files for different purposes:

```
.env.local          # Local development (ignored by git)
.env.example        # Template file (committed to git)
.env.production     # Production environment variables
```

### 2. Local Development Setup

**✅ What I Fixed:**
- Added `dotenv` package to load environment variables
- Updated `local-api-server.js` to load `.env.local` file
- Added environment variable status logging

**✅ Your `.env.local` file should contain:**
```bash
# Anthropic API Key (for Claude AI)
ANTHROPIC_API_KEY=your_actual_api_key_here

# OpenAI API Key (if you use OpenAI)
OPENAI_API_KEY=your_actual_api_key_here

# PubMed API Key (optional, for higher rate limits)
PUBMED_API_KEY=your_actual_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Environment Variable Loading

**Local Development:**
- `npm run dev` → Uses `.env.local` file
- Local API server loads variables with `dotenv.config({ path: '.env.local' })`

**Production/Staging:**
- Vercel automatically loads environment variables from dashboard
- No `.env` files needed in production

### 4. Common Issues & Solutions

#### Issue: "API Key not configured" in local development
**Solution:** 
1. Check if `.env.local` exists in root directory
2. Verify API key is set correctly (no quotes, no spaces)
3. Restart local API server: `node local-api-server.js`

#### Issue: Environment variables not loading
**Solution:**
1. Install dotenv: `npm install dotenv`
2. Add to server startup: `dotenv.config({ path: '.env.local' })`
3. Check console logs for "✅ Set" or "❌ Missing" status

#### Issue: Different behavior between local and production
**Solution:**
- Local: Uses `.env.local` file
- Production: Uses Vercel environment variables
- Staging: Uses staging environment variables

### 5. Best Practices

**✅ Do:**
- Keep `.env.local` in `.gitignore`
- Use `.env.example` as a template
- Test API keys in local environment first
- Use descriptive variable names

**❌ Don't:**
- Commit actual API keys to git
- Use production keys in local development
- Hardcode API keys in source code
- Share `.env.local` files

### 6. Testing Your Setup

**Check if environment variables are loaded:**
```bash
# Start local API server and check console output
node local-api-server.js

# You should see:
# 🔑 Environment variables loaded:
#   ANTHROPIC_API_KEY: ✅ Set
#   OPENAI_API_KEY: ✅ Set
#   PUBMED_API_KEY: ✅ Set
```

**Test API endpoint:**
```bash
curl -X POST http://localhost:3001/api/generate-response \
  -H "Content-Type: application/json" \
  -d '{"userQuery": "test"}'
```

### 7. Environment-Specific Configuration

**Local Development (`npm run dev`):**
- Uses `.env.local` file
- API calls go to `http://localhost:3001`
- Full debugging and logging

**Staging (`npm run dev:staging`):**
- Uses staging environment variables
- API calls go to `https://www.developent.guru`
- Production-like testing

**Production (`npm run dev:production`):**
- Uses production environment variables
- API calls go to `https://abcresearch.vercel.app`
- Full production environment

### 8. Troubleshooting Checklist

- [ ] `.env.local` file exists in root directory
- [ ] API keys are set without quotes or extra spaces
- [ ] `dotenv` package is installed
- [ ] Local API server is running (`node local-api-server.js`)
- [ ] Environment variables show "✅ Set" in console
- [ ] API endpoint responds without 500 errors
- [ ] Frontend is configured to use local environment (`npm run dev`)

### 9. Quick Commands

```bash
# Start local API server with environment variables
node local-api-server.js

# Start frontend in local mode
npm run dev

# Start frontend in staging mode
npm run dev:staging

# Start frontend in production mode
npm run dev:production

# Test API endpoint
curl http://localhost:3001/health
```

This setup ensures your API keys are properly loaded in all environments and helps you avoid configuration issues!
