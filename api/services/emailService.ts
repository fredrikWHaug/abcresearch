/**
 * Email Service using SendGrid
 * Sends formatted email notifications for clinical trial updates
 */

import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'info@alligator-health.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('[EMAIL] SENDGRID_API_KEY not configured. Email notifications disabled.');
}

export interface TrialUpdateEmail {
  nctId: string;
  title: string;
  isNew: boolean;
  summary: string;
  studyUrl: string;
  historyUrl: string;
  comparisonUrl?: string | null;
  versionA?: number;
  versionB?: number;
  lastUpdate: string;
}

export interface EmailNotificationData {
  feedLabel: string;
  updates: TrialUpdateEmail[];
  recipientEmail: string;
}

/**
 * Generate HTML email content for trial updates
 */
function generateEmailHtml(data: EmailNotificationData): string {
  const { feedLabel, updates } = data;
  const newStudies = updates.filter(u => u.isNew);
  const updatedStudies = updates.filter(u => !u.isNew);
  
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let studiesHtml = '';
  
  // New studies section
  if (newStudies.length > 0) {
    studiesHtml += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #059669; font-size: 18px; font-weight: 600; margin-bottom: 15px; border-bottom: 2px solid #059669; padding-bottom: 8px;">
          ✨ ${newStudies.length} New ${newStudies.length === 1 ? 'Study' : 'Studies'}
        </h2>
    `;
    
    newStudies.forEach(update => {
      studiesHtml += `
        <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
          <div style="margin-bottom: 8px;">
            <a href="${update.studyUrl}" style="background-color: #3b82f6; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600; display: inline-block;">
              ${update.nctId}
            </a>
          </div>
          <h3 style="color: #111827; font-size: 16px; font-weight: 600; margin: 8px 0;">
            <a href="${update.studyUrl}" style="color: #111827; text-decoration: none;">
              ${update.title}
            </a>
          </h3>
          <div style="background-color: #d1fae5; border-left: 3px solid #10b981; padding: 12px; margin: 12px 0; border-radius: 4px;">
            <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
              ${update.summary}
            </p>
          </div>
          <div style="margin-top: 12px;">
            <a href="${update.studyUrl}" style="color: #3b82f6; text-decoration: none; font-size: 13px; margin-right: 16px;">
              → View Study
            </a>
            <a href="${update.historyUrl}" style="color: #3b82f6; text-decoration: none; font-size: 13px;">
              → Version History
            </a>
          </div>
        </div>
      `;
    });
    
    studiesHtml += '</div>';
  }
  
  // Updated studies section
  if (updatedStudies.length > 0) {
    studiesHtml += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #f59e0b; font-size: 18px; font-weight: 600; margin-bottom: 15px; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">
          📋 ${updatedStudies.length} ${updatedStudies.length === 1 ? 'Update' : 'Updates'}
        </h2>
    `;
    
    updatedStudies.forEach(update => {
      studiesHtml += `
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
          <div style="margin-bottom: 8px;">
            <a href="${update.studyUrl}" style="background-color: #3b82f6; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600; display: inline-block;">
              ${update.nctId}
            </a>
            <span style="color: #6b7280; font-size: 13px; margin-left: 8px;">
              Version ${update.versionA} → ${update.versionB}
            </span>
          </div>
          <h3 style="color: #111827; font-size: 16px; font-weight: 600; margin: 8px 0;">
            <a href="${update.studyUrl}" style="color: #111827; text-decoration: none;">
              ${update.title}
            </a>
          </h3>
          <div style="background-color: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px; margin: 12px 0; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
              ${update.summary}
            </p>
          </div>
          <div style="margin-top: 12px;">
            <a href="${update.studyUrl}" style="color: #3b82f6; text-decoration: none; font-size: 13px; margin-right: 16px;">
              → View Study
            </a>
            <a href="${update.historyUrl}" style="color: #3b82f6; text-decoration: none; font-size: 13px; margin-right: 16px;">
              → Version History
            </a>
            ${update.comparisonUrl ? `
              <a href="${update.comparisonUrl}" style="color: #3b82f6; text-decoration: none; font-size: 13px;">
                → Compare Versions
              </a>
            ` : ''}
          </div>
        </div>
      `;
    });
    
    studiesHtml += '</div>';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clinical Trial Updates - ${feedLabel}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
        📊 Clinical Trial Updates
      </h1>
      <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 14px;">
        ${date}
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px 20px;">
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af; font-size: 15px;">
          <strong>Watching:</strong> ${feedLabel}
        </p>
        <p style="margin: 8px 0 0 0; color: #3b82f6; font-size: 14px;">
          ${updates.length} ${updates.length === 1 ? 'update' : 'updates'} found
        </p>
      </div>
      
      ${studiesHtml}
      
      <!-- Footer Info -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">
          <strong>About this notification:</strong> You're receiving this email because you subscribed to daily updates for "${feedLabel}". These updates are checked daily from ClinicalTrials.gov.
        </p>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 8px 0;">
          To manage your email notifications, log in to your dashboard and edit this feed's settings.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        ABCresearch - Clinical Trial Intelligence Platform
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
        © ${new Date().getFullYear()} All rights reserved
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content for trial updates
 */
function generateEmailText(data: EmailNotificationData): string {
  const { feedLabel, updates } = data;
  const newStudies = updates.filter(u => u.isNew);
  const updatedStudies = updates.filter(u => !u.isNew);
  
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let text = `CLINICAL TRIAL UPDATES\n${date}\n\n`;
  text += `Watching: ${feedLabel}\n`;
  text += `${updates.length} ${updates.length === 1 ? 'update' : 'updates'} found\n\n`;
  text += '='.repeat(60) + '\n\n';
  
  if (newStudies.length > 0) {
    text += `NEW STUDIES (${newStudies.length})\n`;
    text += '-'.repeat(60) + '\n\n';
    
    newStudies.forEach(update => {
      text += `${update.nctId}\n`;
      text += `${update.title}\n\n`;
      text += `Summary: ${update.summary}\n\n`;
      text += `View Study: ${update.studyUrl}\n`;
      text += `Version History: ${update.historyUrl}\n\n`;
      text += '-'.repeat(60) + '\n\n';
    });
  }
  
  if (updatedStudies.length > 0) {
    text += `UPDATED STUDIES (${updatedStudies.length})\n`;
    text += '-'.repeat(60) + '\n\n';
    
    updatedStudies.forEach(update => {
      text += `${update.nctId} (Version ${update.versionA} → ${update.versionB})\n`;
      text += `${update.title}\n\n`;
      text += `Changes: ${update.summary}\n\n`;
      text += `View Study: ${update.studyUrl}\n`;
      text += `Version History: ${update.historyUrl}\n`;
      if (update.comparisonUrl) {
        text += `Compare Versions: ${update.comparisonUrl}\n`;
      }
      text += '\n' + '-'.repeat(60) + '\n\n';
    });
  }
  
  text += '\n' + '='.repeat(60) + '\n\n';
  text += `You're receiving this email because you subscribed to daily updates for "${feedLabel}".\n`;
  text += 'To manage your email notifications, log in to your dashboard and edit this feed\'s settings.\n\n';
  text += 'ABCresearch - Clinical Trial Intelligence Platform\n';
  
  return text;
}

/**
 * Send email notification for trial updates
 */
export async function sendTrialUpdateEmail(data: EmailNotificationData): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('[EMAIL] SendGrid not configured. Skipping email send.');
    return false;
  }

  if (!data.recipientEmail) {
    console.warn('[EMAIL] No recipient email provided. Skipping email send.');
    return false;
  }

  if (data.updates.length === 0) {
    console.log('[EMAIL] No updates to send. Skipping email.');
    return false;
  }

  const subject = `${data.updates.length} New Clinical Trial ${data.updates.length === 1 ? 'Update' : 'Updates'} - ${data.feedLabel}`;
  const html = generateEmailHtml(data);
  const text = generateEmailText(data);

  const msg = {
    to: data.recipientEmail,
    from: FROM_EMAIL,
    subject: subject,
    text: text,
    html: html,
  };

  try {
    console.log(`[EMAIL] Sending email to ${data.recipientEmail} with ${data.updates.length} updates`);
    await sgMail.send(msg);
    console.log(`[EMAIL] ✅ Email sent successfully to ${data.recipientEmail}`);
    return true;
  } catch (error: any) {
    console.error('[EMAIL] ❌ Failed to send email:', error);
    if (error.response) {
      console.error('[EMAIL] SendGrid error response:', error.response.body);
    }
    return false;
  }
}

/**
 * Send test email (for debugging)
 */
export async function sendTestEmail(recipientEmail: string): Promise<boolean> {
  const testData: EmailNotificationData = {
    feedLabel: 'Test Feed - Semaglutide trials',
    recipientEmail: recipientEmail,
    updates: [
      {
        nctId: 'NCT12345678',
        title: 'A Phase 3 Study of Semaglutide in Patients with Type 2 Diabetes',
        isNew: true,
        summary: 'This is a new multicenter, randomized, double-blind, placebo-controlled study to evaluate the efficacy and safety of semaglutide in adults with type 2 diabetes mellitus.',
        studyUrl: 'https://clinicaltrials.gov/study/NCT12345678',
        historyUrl: 'https://clinicaltrials.gov/study/NCT12345678?tab=history',
        lastUpdate: new Date().toISOString(),
      },
      {
        nctId: 'NCT87654321',
        title: 'Long-term Safety Study of Semaglutide for Weight Management',
        isNew: false,
        summary: 'Updated primary outcome measures to include cardiovascular safety endpoints. Added secondary endpoints for metabolic parameters and quality of life assessments.',
        studyUrl: 'https://clinicaltrials.gov/study/NCT87654321',
        historyUrl: 'https://clinicaltrials.gov/study/NCT87654321?tab=history',
        comparisonUrl: 'https://clinicaltrials.gov/study/NCT87654321?tab=history&a=1&b=2',
        versionA: 1,
        versionB: 2,
        lastUpdate: new Date().toISOString(),
      },
    ],
  };

  return sendTrialUpdateEmail(testData);
}

