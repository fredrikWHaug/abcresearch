# 🧪 Local Testing Guide

This guide helps you test the PDF extraction system locally before deploying to production.

## Prerequisites

1. **Python dependencies installed:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Supabase CLI installed:**
   ```bash
   npm install -g supabase
   ```

3. **Test PDF file** with tables (for testing)

## Testing Steps

### 1. Test Python API Locally

Start the local Python server:
```bash
python local_server.py
```

This will start a server at `http://localhost:3000/api/extract_tables`

### 2. Test Python API Directly

Run the test script:
```bash
python test_local.py
```

This will test the Python API with a sample PDF file.

### 3. Test Supabase Edge Function Locally

Start the Supabase Edge Function:
```bash
supabase functions serve extract-pdf-tables
```

This will give you a local URL like `http://localhost:54321/functions/v1/extract-pdf-tables`

### 4. Test Complete Flow

Run the complete test:
```bash
python test_edge_function.py
```

This tests: Frontend → Edge Function → Python API

## Testing URLs

- **Local Python API**: `http://localhost:3000/api/extract_tables`
- **Local Edge Function**: `http://localhost:54321/functions/v1/extract-pdf-tables`
- **Production Edge Function**: `https://acswlqfhoqxemyxmscwp.supabase.co/functions/v1/extract-pdf-tables`

## Troubleshooting

### Python API Issues
- Make sure all dependencies are installed: `pip install -r requirements.txt`
- Check that the server is running on port 3000
- Verify the PDF file exists and is readable

### Edge Function Issues
- Make sure Supabase CLI is installed and logged in
- Check that the Edge Function is running locally
- Verify the Python API is accessible from the Edge Function

### CORS Issues
- The local server includes CORS headers
- Make sure you're testing from the correct origin

## Production Deployment

1. **Deploy Python API to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Deploy Edge Function to Supabase:**
   ```bash
   supabase functions deploy extract-pdf-tables
   ```

3. **Update the Edge Function URL** in production to use the Vercel URL instead of localhost.

## Expected Results

- ✅ Python API extracts tables from PDF
- ✅ Excel file is generated with multiple sheets
- ✅ Edge Function proxies requests correctly
- ✅ Frontend receives extracted data and Excel file
- ✅ User can download the Excel file
