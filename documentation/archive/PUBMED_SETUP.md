# PubMed API Setup Guide

## Required Environment Variables

### 1. For Vercel Serverless Functions (Required)
Add these to your Vercel environment variables or `.env` file:

```bash
# PubMed API Configuration
PUBMED_API_KEY=your_pubmed_api_key_here
PUBMED_EMAIL=your_email@example.com
```

### 2. For Frontend (Optional)
Add these to your `.env` file for frontend environment:

```bash
# These are optional - the frontend now uses server-side API
VITE_PUBMED_API_KEY=your_pubmed_api_key_here
VITE_PUBMED_EMAIL=your_email@example.com
```

## Getting a PubMed API Key

### Step 1: Register at NCBI
1. Go to [NCBI Account Registration](https://www.ncbi.nlm.nih.gov/account/)
2. Create a free account
3. Verify your email address

### Step 2: Get API Key
1. Log into your NCBI account
2. Go to [API Key Management](https://www.ncbi.nlm.nih.gov/account/settings/)
3. Generate a new API key
4. Copy the key (it looks like: `1234567890abcdef1234567890abcdef12345678`)

### Step 3: Set Rate Limits
- **Without API Key**: 3 requests/second
- **With API Key**: 10 requests/second

## Rate Limiting Implementation

The system automatically handles rate limiting:

- **350ms delay** between requests (safe for 3 req/sec)
- **Batch processing** with 2-second delays between batches
- **Automatic throttling** to prevent API abuse

## Testing the Setup

### 1. Test Without API Key
```bash
# Remove PUBMED_API_KEY from environment
# System will use 3 requests/second limit
```

### 2. Test With API Key
```bash
# Add PUBMED_API_KEY to environment
# System will use 10 requests/second limit
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure you're using the server-side API (`/api/search-papers`)
2. **Rate Limit Errors**: The system automatically handles this with delays
3. **Empty Results**: Check your search query format

### Debug Logs

The API logs helpful information:
- API key status
- Search queries
- Number of papers found
- Rate limiting status

## Production Deployment

### Vercel Environment Variables
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - `PUBMED_API_KEY`: Your NCBI API key
   - `PUBMED_EMAIL`: Your email address

### Monitoring
- Check Vercel function logs for API usage
- Monitor rate limiting in production
- Set up alerts for API errors

## Cost

- **PubMed API**: FREE
- **Rate Limits**: Generous (3-10 req/sec)
- **No Usage Limits**: No monthly quotas

## Security Notes

- API key is stored securely in Vercel environment variables
- No direct client-side API calls (CORS-safe)
- Rate limiting prevents abuse
- All requests go through your server-side proxy
