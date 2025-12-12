# Email Notifications for Realtime Feed

## Overview

The ABCresearch platform now supports automated email notifications for clinical trial updates. Users can subscribe to receive daily email summaries of new and updated trials from their watched feeds.

## Features

### 1. **Email Subscription Management**
- Users can enable/disable email notifications when creating or editing feeds
- Email address is stored per feed (users can use different emails for different feeds)
- Toggle-based UI for easy subscription management

### 2. **Daily Email Summaries**
- Cron job runs daily at 9am ET (14:00 UTC) to check all feeds
- Only sends emails for feeds with new updates found during that check
- Well-formatted HTML emails with:
  - Separate sections for new studies vs. updates
  - Color-coded sections (green for new, amber for updates)
  - Direct links to study pages, version history, and comparison views
  - Plain text alternative for email clients that don't support HTML

### 3. **Duplicate Prevention**
- `email_sent` flag on `trial_updates` table tracks which updates have been emailed
- `last_email_sent_at` timestamp on `watched_feeds` table tracks last email send time
- Updates are only emailed once (first time they're discovered)

## Database Schema

### New Columns in `watched_feeds`

```sql
-- Email address to send notifications to (NULL = no notifications)
notification_email TEXT DEFAULT NULL

-- Timestamp of last email sent for this feed
last_email_sent_at TIMESTAMPTZ DEFAULT NULL
```

### New Column in `trial_updates`

```sql
-- Tracks whether this update has been included in an email
email_sent BOOLEAN DEFAULT FALSE
```

## Architecture

### Components

1. **Frontend**: `src/components/RealtimeFeed.tsx`
   - Email toggle and input in "Add Feed" modal
   - Email management in "Edit Feed" modal
   - Sends `notificationEmail` to API when creating/updating feeds

2. **API**: `api/rss-feeds.ts`
   - Stores `notification_email` when creating/updating feeds
   - Returns email address when fetching feeds

3. **Email Service**: `api/services/emailService.ts`
   - `sendTrialUpdateEmail()` - Main function to send formatted emails
   - `sendTestEmail()` - Test function with sample data
   - HTML and plain text template generation
   - SendGrid integration

4. **Feed Processing**: `api/utils/rss-feed-utils.ts`
   - `processFeedUpdates()` - Shared function for processing feed updates
   - Used by both manual refresh and cron job
   - Returns list of new updates for email notifications

5. **Cron Job**: `api/cron-check-rss-feeds.ts`
   - Runs daily at 9am ET
   - Processes all watched feeds
   - Sends emails for feeds with `notification_email` set and new updates found
   - Marks updates as `email_sent = true` after successful send

### Email Flow

```
Cron Job (Daily at 9am ET)
    ↓
For each watched feed:
    ↓
Process feed updates (check RSS, parse, analyze)
    ↓
New updates found? → YES
    ↓
notification_email set? → YES
    ↓
Send email with update summaries
    ↓
Mark updates as email_sent = true
    ↓
Update last_email_sent_at timestamp
```

## Configuration

### Environment Variables

Add these to your Vercel project environment variables:

```bash
# SendGrid API Key (required)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# From email address (optional, defaults to info@alligator-health.com)
SENDGRID_FROM_EMAIL=info@alligator-health.com
```

### SendGrid Setup

1. **Create SendGrid Account**: https://signup.sendgrid.com/
2. **Verify Sender Identity**:
   - Go to Settings → Sender Authentication
   - Verify your domain OR verify a single sender email
   - The email you verify must match `SENDGRID_FROM_EMAIL`
3. **Create API Key**:
   - Go to Settings → API Keys
   - Create new API key with "Mail Send" permissions
   - Copy the key and add to Vercel environment variables

### Cron Job Configuration

Already configured in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron-check-rss-feeds",
    "schedule": "0 14 * * *"
  }]
}
```

## Testing

### 1. Test SendGrid Configuration

Send a test email to verify your SendGrid setup:

```bash
curl "https://your-app.vercel.app/api/test-email?email=your@email.com"
```

Or visit in browser:
```
https://your-app.vercel.app/api/test-email?email=your@email.com
```

Expected response:
```json
{
  "success": true,
  "message": "Test email sent successfully to your@email.com",
  "note": "Check your inbox (and spam folder) for the test email"
}
```

### 2. Test with Real Feed

1. Log in to ABCresearch dashboard
2. Go to "Realtime Feed" tab
3. Click "Watch New Feed"
4. Enter a search term (e.g., "Semaglutide")
5. Toggle "Send daily email updates" to ON
6. Enter your email address
7. Click "Start Watching"

The feed will be processed immediately and you should see updates in the UI. However, email will only be sent during the next cron job run (9am ET daily).

### 3. Manually Trigger Cron Job (for testing)

You can manually trigger the cron job to test email sending:

```bash
curl -X GET "https://your-app.vercel.app/api/cron-check-rss-feeds" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Note**: `CRON_SECRET` must be set in your Vercel environment variables.

## Email Template

### Sample Email Structure

**Subject**: `2 New Clinical Trial Updates - Semaglutide trials`

**Content**:
- Header with date
- Feed name and update count
- **New Studies Section** (green):
  - NCT ID badge
  - Study title (clickable)
  - AI-generated summary
  - Links: View Study, Version History
- **Updated Studies Section** (amber):
  - NCT ID badge with version numbers
  - Study title (clickable)
  - AI-generated summary of changes
  - Links: View Study, Version History, Compare Versions
- Footer with unsubscribe instructions

## User Experience

### Creating a Feed with Email Notifications

1. Click "Watch New Feed"
2. Enter search term (required)
3. Optionally enter custom label
4. Toggle "Send daily email updates" to ON
5. Enter email address
6. Click "Start Watching"

### Editing Email Notifications

1. Find the feed in the sidebar
2. Click "Edit" button
3. Toggle "Send daily email updates" ON/OFF
4. Update email address if needed
5. Click "Save Changes"

### Disabling Email Notifications

1. Edit the feed
2. Toggle "Send daily email updates" to OFF
3. Click "Save Changes"

This sets `notification_email` to `NULL` in the database, preventing future emails.

## Monitoring

### Check Email Status

Check Vercel logs for email-related messages:

```bash
# Successful email send
[CRON] ✅ Email sent successfully to user@example.com

# No updates, email skipped
[CRON] No new updates for feed 123, skipping email

# Email not configured
[CRON] No notification email configured for feed 123

# Email send failed
[EMAIL] ❌ Failed to send email: [error details]
```

### SendGrid Dashboard

Monitor email delivery in SendGrid dashboard:
- Go to https://app.sendgrid.com/
- Check "Activity" for recent sends
- Check "Suppressions" for bounced/blocked emails

## Troubleshooting

### Emails Not Being Sent

**Check 1**: Is `SENDGRID_API_KEY` set in Vercel?
```bash
vercel env pull
# Check if SENDGRID_API_KEY is present
```

**Check 2**: Is the sender email verified in SendGrid?
- Log in to SendGrid
- Go to Settings → Sender Authentication
- Verify the email matches `SENDGRID_FROM_EMAIL`

**Check 3**: Are there new updates?
- Emails are only sent when new updates are found during cron run
- Check Vercel logs to see if updates were found

**Check 4**: Is `notification_email` set?
- Query database: `SELECT id, label, notification_email FROM watched_feeds WHERE notification_email IS NOT NULL`

### Emails Going to Spam

**Solution 1**: Verify domain in SendGrid
- Single sender verification may trigger spam filters
- Domain verification (DNS records) provides better deliverability

**Solution 2**: Add ABCresearch to contacts
- Ask users to add `info@alligator-health.com` to their contacts

**Solution 3**: Check email content
- Avoid spam trigger words
- Include unsubscribe instructions
- Use proper HTML structure (already implemented)

### Duplicate Emails

This should not happen due to `email_sent` flag, but if it does:

**Check 1**: Verify `email_sent` is being set
```sql
SELECT nct_id, email_sent, created_at 
FROM trial_updates 
WHERE feed_id = YOUR_FEED_ID 
ORDER BY created_at DESC;
```

**Check 2**: Check for multiple cron jobs running
- Vercel should only run one instance, but check logs

## Future Enhancements

### Potential Improvements

1. **Frequency Options**
   - Allow users to choose: daily, weekly, real-time
   - Store `notification_frequency` in database

2. **Digest Emails**
   - Send one email per user with all feed updates
   - Reduce email volume for users with multiple feeds

3. **Email Preferences**
   - HTML vs plain text preference
   - Detailed vs summary format
   - Filter by update type (new only, updates only, all)

4. **Unsubscribe Link**
   - One-click unsubscribe without login
   - Generate unique tokens per feed

5. **Email Templates**
   - Allow customization of email templates
   - Branding options for white-label deployments

## API Reference

### Send Test Email

**Endpoint**: `GET /api/test-email?email={email}`

**Parameters**:
- `email` (string, required): Email address to send test to

**Response**:
```json
{
  "success": true,
  "message": "Test email sent successfully to user@example.com",
  "note": "Check your inbox (and spam folder) for the test email"
}
```

### Create Feed with Email

**Endpoint**: `POST /api/rss-feeds?action=watch`

**Body**:
```json
{
  "searchTerm": "Semaglutide",
  "label": "Semaglutide trials",
  "locStr": "USA",
  "country": "US",
  "dateField": "LastUpdatePostDate",
  "notificationEmail": "user@example.com"
}
```

### Update Feed Email

**Endpoint**: `PUT /api/rss-feeds?action=watch`

**Body**:
```json
{
  "feedId": 123,
  "feedUrl": "https://clinicaltrials.gov/api/rss?intr=Semaglutide&locStr=USA&country=US&dateField=LastUpdatePostDate",
  "label": "Semaglutide trials",
  "notificationEmail": "newemail@example.com"
}
```

To disable emails, set `notificationEmail` to `null`.

## Migration

Run the migration to add email columns:

```bash
# The migration file is already created
supabase/migrations/add_email_notifications_to_watched_feeds.sql

# It will be applied automatically on next deployment
# Or apply manually:
psql $DATABASE_URL < supabase/migrations/add_email_notifications_to_watched_feeds.sql
```

## Security Considerations

1. **Email Validation**: Basic regex validation prevents invalid emails
2. **Rate Limiting**: Cron job runs once daily, limiting email volume
3. **User Scoping**: Emails only sent for feeds owned by authenticated users
4. **API Key Security**: SendGrid API key stored in environment variables (not in code)
5. **No User Data in Emails**: Emails contain only publicly available clinical trial information

## Support

For issues with email notifications:
1. Check Vercel logs for error messages
2. Check SendGrid activity dashboard
3. Verify environment variables are set
4. Test with `/api/test-email` endpoint
5. Contact support with feed ID and error logs

