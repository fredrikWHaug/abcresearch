# Email Notifications - Quick Setup Guide

## Prerequisites

✅ SendGrid account (free tier works)  
✅ Verified sender email in SendGrid  
✅ SendGrid API key with Mail Send permissions

## Step 1: Configure SendGrid (5 minutes)

### A. Create SendGrid Account
1. Go to https://signup.sendgrid.com/
2. Complete registration (email verification required)
3. Log in to dashboard

### B. Verify Sender Email
1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill out form with sender details:
   - **From Name**: ABCresearch
   - **From Email**: info@alligator-health.com (or your domain)
   - **Reply To**: Same as From Email
   - **Address/City/State/Country**: Your info
4. Check your email and click verification link
5. ✅ Status should show "Verified"

### C. Create API Key
1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name: "ABCresearch Production"
4. Permissions: **Restricted Access**
   - Find "Mail Send" and toggle to **FULL ACCESS**
   - All other permissions should be **NO ACCESS**
5. Click **Create & View**
6. **IMPORTANT**: Copy the key immediately (you can't see it again!)
7. Save the key securely

## Step 2: Add Environment Variables to Vercel (2 minutes)

```bash
# Via Vercel CLI
vercel env add SENDGRID_API_KEY
# Paste your API key when prompted
# Select: Production, Preview, Development

vercel env add SENDGRID_FROM_EMAIL
# Enter: info@alligator-health.com (or your verified email)
# Select: Production, Preview, Development
```

Or via Vercel Dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add `SENDGRID_API_KEY` with your API key
3. Add `SENDGRID_FROM_EMAIL` with your verified sender email
4. Check all environments: Production, Preview, Development
5. Click **Save**

## Step 3: Deploy (1 minute)

```bash
# Push your changes to trigger deployment
git add .
git commit -m "Add email notifications for realtime feeds"
git push origin dev

# Or deploy manually
vercel --prod
```

## Step 4: Test (2 minutes)

### Test 1: SendGrid Configuration
```bash
# Replace with your actual domain and email
curl "https://your-app.vercel.app/api/test-email?email=your@email.com"
```

Expected output:
```json
{
  "success": true,
  "message": "Test email sent successfully to your@email.com"
}
```

Check your inbox! You should see a test email with 2 sample clinical trial updates.

### Test 2: Real Feed with Email
1. Log in to ABCresearch
2. Go to **Realtime Feed** tab
3. Click **Watch New Feed**
4. Enter search term: `Semaglutide`
5. Toggle **Send daily email updates** to ON
6. Enter your email
7. Click **Start Watching**

You'll see the feed processing in real-time. The first email will be sent during the next cron job run (9am ET daily).

### Test 3: Manual Cron Trigger (Optional)
```bash
# Add CRON_SECRET to environment variables first
vercel env add CRON_SECRET
# Enter a random secret string, e.g., "test-secret-123"

# Then trigger the cron job
curl -X GET "https://your-app.vercel.app/api/cron-check-rss-feeds" \
  -H "Authorization: Bearer test-secret-123"
```

## Step 5: Run Database Migration (1 minute)

The migration should run automatically on deployment, but you can verify:

```sql
-- Check if columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'watched_feeds' 
AND column_name IN ('notification_email', 'last_email_sent_at');

-- Should return 2 rows
```

If migration didn't run automatically:
```bash
# Via Supabase CLI
supabase db push

# Or via psql
psql $DATABASE_URL < supabase/migrations/add_email_notifications_to_watched_feeds.sql
```

## Verification Checklist

- [ ] SendGrid account created
- [ ] Sender email verified in SendGrid
- [ ] API key created with Mail Send permissions
- [ ] `SENDGRID_API_KEY` added to Vercel
- [ ] `SENDGRID_FROM_EMAIL` added to Vercel
- [ ] Code deployed to Vercel
- [ ] Test email sent successfully (Step 4, Test 1)
- [ ] Database migration applied
- [ ] UI shows email toggle in "Add Feed" modal
- [ ] Email field enabled (not disabled/grayed out)

## Troubleshooting

### "Email sent" but no email received?

1. **Check spam folder** - SendGrid emails often go to spam initially
2. **Check SendGrid Activity**:
   - Go to SendGrid dashboard → **Activity**
   - Look for recent email sends
   - Status should be "Delivered", not "Bounced" or "Dropped"
3. **Verify sender email**: Must match `SENDGRID_FROM_EMAIL` exactly

### "SENDGRID_API_KEY not configured" error?

1. Check environment variables in Vercel:
   ```bash
   vercel env pull
   cat .env
   # Look for SENDGRID_API_KEY
   ```
2. Redeploy after adding environment variables:
   ```bash
   vercel --prod
   ```

### Test email shows "success: false"?

1. **Check Vercel logs**:
   ```bash
   vercel logs --follow
   # Look for [EMAIL] errors
   ```
2. **Check API key permissions**: Must have "Mail Send" enabled
3. **Check sender verification**: Email must be verified in SendGrid

### Email toggle is disabled/grayed out?

This should be fixed now. If still happening:
1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Clear browser cache
3. Check that updated code is deployed

## What Happens Next?

### Daily Emails
- **Cron job runs**: Every day at 9am ET (2pm UTC)
- **Checks feeds**: Processes all watched feeds for updates
- **Sends emails**: Only for feeds with `notification_email` set AND new updates found
- **Marks as sent**: Updates flagged to prevent duplicates

### Email Content
Users will receive:
- **New studies**: Green section with AI summary
- **Updated studies**: Amber section with changes summary
- **Links**: Direct to study page, version history, comparison view
- **Plain text alternative**: For email clients without HTML support

### User Management
Users can:
- **Enable emails**: When creating or editing feeds
- **Disable emails**: Toggle off or clear email address
- **Use different emails**: Each feed can have a different email address
- **Edit anytime**: Change email address without recreating feed

## Next Steps

1. **Monitor first cron run**: Check Vercel logs at 9am ET tomorrow
2. **Add to user guide**: Document email feature for end users
3. **Consider domain verification**: Better deliverability than single sender verification
4. **Set up email analytics**: Track open rates, click rates in SendGrid

## Support

- **Documentation**: `documentation/email-notifications.md`
- **Test endpoint**: `/api/test-email?email={email}`
- **SendGrid dashboard**: https://app.sendgrid.com/
- **Vercel logs**: `vercel logs --follow`

---

**Total setup time**: ~10 minutes  
**Monthly cost**: $0 (SendGrid free tier: 100 emails/day)  
**Maintenance**: Zero - fully automated

