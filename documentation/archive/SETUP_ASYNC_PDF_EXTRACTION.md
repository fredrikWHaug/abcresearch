# Setup Guide: Async PDF Extraction

## Quick Start - Database Setup

### 1. Run the Migration

The migration file is already created at:
```
supabase/migrations/add_pdf_extraction_async.sql
```

**Apply it with**:
```bash
# If using Supabase CLI
supabase db push

# Or run the SQL directly in Supabase dashboard SQL editor
```

### 2. Create Storage Bucket

Run this SQL in your Supabase SQL Editor:

```sql
-- Create storage bucket for PDF uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-uploads', 'pdf-uploads', false);

-- Allow users to upload their own PDFs
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pdf-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own PDFs
CREATE POLICY "Users can read their own PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pdf-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own PDFs
CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pdf-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3. Add Environment Variables

Add these to your Vercel project settings:

```bash
# Required - Get from Supabase dashboard
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Required - Generate a random string
INTERNAL_API_KEY=generate-a-random-secure-key-here
```

**To generate INTERNAL_API_KEY**:
```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 32
```

### 4. Deploy

```bash
# Deploy to Vercel
git add .
git commit -m "feat: Add async PDF extraction with job queue"
git push

# Vercel will auto-deploy
```

## What Gets Created

### Database Tables:
1. **`pdf_extraction_jobs`** - Tracks all extraction jobs
2. **`pdf_extraction_results`** - Stores completed results

### API Endpoints:
1. `POST /api/submit-pdf-job` - Submit PDF for extraction
2. `POST /api/process-pdf-job` - Background worker
3. `GET /api/get-pdf-job` - Get job status
4. `GET /api/list-pdf-jobs` - List user's jobs
5. `POST /api/retry-pdf-job` - Retry failed jobs

### UI Components:
1. **Data Extraction** tab - Updated with progress tracking
2. **Extraction History** tab - New view for job history

## Testing Checklist

After deployment, test:

- [ ] Upload a PDF → Job submits successfully
- [ ] See progress bar updating in real-time
- [ ] Navigate to another tab → Job continues
- [ ] Get browser notification when complete
- [ ] View result in Extraction History
- [ ] Download extracted content
- [ ] Retry a failed job (simulate by disconnecting network)

## Rollback Plan

If issues occur, the old synchronous extraction still works!
Users can still use the feature while you debug.

## Common Issues

### "Storage bucket not found"
→ Run Step 2 above to create the bucket

### "Service role key not configured"
→ Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars

### Jobs stuck in "pending"
→ Check Vercel logs for worker errors
→ Verify `INTERNAL_API_KEY` is set

### No notifications showing
→ User needs to grant browser notification permission
→ Will show in-app toast as fallback

## Support

See `ASYNC_PDF_EXTRACTION_IMPLEMENTATION.md` for complete documentation.

---

**Status**: Ready to deploy! 🚀

