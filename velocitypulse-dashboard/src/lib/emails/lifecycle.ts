// ==============================================
// VelocityPulse Lifecycle Email Functions
// ==============================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.velocitypulse.io'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'VelocityPulse <no-reply@velocitypulse.io>'

/**
 * Send an email via Resend API.
 * Silently skips if RESEND_API_KEY is not configured.
 */
async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured, skipping email')
    return false
  }

  if (to.length === 0) {
    console.warn('[Email] No recipients, skipping email')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[Email] Resend API error:', response.status, text)
      return false
    }

    return true
  } catch (error) {
    console.error('[Email] Failed to send:', error)
    return false
  }
}

/**
 * Shared HTML email template wrapper.
 */
function emailTemplate(title: string, titleColor: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background-color: ${titleColor}; padding: 20px; color: white;">
      <h1 style="margin: 0; font-size: 20px;">${title}</h1>
    </div>
    <div style="padding: 20px;">
      ${bodyHtml}
    </div>
    <div style="padding: 15px 20px; background-color: #f9f9f9; border-top: 1px solid #eee; font-size: 12px; color: #666;">
      Sent by <a href="https://velocitypulse.io" style="color: #2563eb; text-decoration: none;">VelocityPulse</a>
    </div>
  </div>
</body>
</html>`
}

function actionButton(href: string, label: string): string {
  return `<p style="margin-top: 24px;">
    <a href="${href}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">${label}</a>
  </p>`
}

// ===== Lifecycle Email Functions =====

export async function sendWelcomeEmail(orgName: string, ownerEmail: string): Promise<boolean> {
  return sendEmail(
    [ownerEmail],
    `Welcome to VelocityPulse!`,
    emailTemplate('Welcome to VelocityPulse', '#2563eb', `
      <p>Hi there,</p>
      <p>Thanks for signing up <strong>${orgName}</strong> for VelocityPulse! Your 14-day free trial is now active.</p>
      <p>Here's how to get started:</p>
      <ol style="color: #333; line-height: 1.8;">
        <li>Install a network agent on your server or workstation</li>
        <li>Configure your first network segment to scan</li>
        <li>Set up notification channels (email, Slack, Teams)</li>
      </ol>
      ${actionButton(`${APP_URL}/dashboard`, 'Go to Dashboard')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">Need help? Contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}

export async function sendTrialExpiringEmail(orgName: string, daysLeft: number, recipients: string[]): Promise<boolean> {
  return sendEmail(
    recipients,
    `Your VelocityPulse trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    emailTemplate('Trial Expiring Soon', '#f59e0b', `
      <p>Your free trial for <strong>${orgName}</strong> expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
      <p>Subscribe now to keep monitoring your network without interruption. Plans start at just &pound;50/year.</p>
      ${actionButton(`${APP_URL}/billing`, 'View Plans & Subscribe')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">Questions? Contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}

export async function sendTrialExpiredEmail(orgName: string, recipients: string[]): Promise<boolean> {
  return sendEmail(
    recipients,
    `Your VelocityPulse trial has ended`,
    emailTemplate('Trial Expired', '#dc2626', `
      <p>The free trial for <strong>${orgName}</strong> has ended and your account has been suspended.</p>
      <p>Subscribe to a plan to restore access to your dashboard and resume monitoring. All your data is safe and waiting for you.</p>
      ${actionButton(`${APP_URL}/billing`, 'Subscribe Now')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">Need more time? Contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}

export async function sendSubscriptionActivatedEmail(orgName: string, plan: string, recipients: string[]): Promise<boolean> {
  return sendEmail(
    recipients,
    `Subscription confirmed for ${orgName}`,
    emailTemplate('Subscription Confirmed', '#16a34a', `
      <p>Thank you! Your <strong>${plan.charAt(0).toUpperCase() + plan.slice(1)}</strong> subscription for <strong>${orgName}</strong> is now active.</p>
      <p>You have full access to all features included in your plan. Happy monitoring!</p>
      ${actionButton(`${APP_URL}/dashboard`, 'Go to Dashboard')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">Manage your subscription anytime from the <a href="${APP_URL}/billing" style="color: #2563eb;">billing page</a>.</p>
    `)
  )
}

export async function sendSubscriptionCancelledEmail(orgName: string, recipients: string[]): Promise<boolean> {
  return sendEmail(
    recipients,
    `Subscription cancelled for ${orgName}`,
    emailTemplate('Subscription Cancelled', '#6b7280', `
      <p>Your subscription for <strong>${orgName}</strong> has been cancelled.</p>
      <p>Your data will be retained for 30 days. After that, it will be permanently deleted.</p>
      <p>If you change your mind, you can reactivate by contacting our support team.</p>
      <p style="color: #666; font-size: 14px; margin-top: 24px;">Contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a> if you have any questions.</p>
    `)
  )
}

export async function sendAccountSuspendedEmail(orgName: string, reason: string, recipients: string[]): Promise<boolean> {
  const reasonText = reason === 'grace_period_exceeded'
    ? 'Your payment is overdue and the grace period has expired.'
    : reason === 'trial_expired'
    ? 'Your free trial has ended.'
    : 'Your account requires attention.'

  return sendEmail(
    recipients,
    `[Action Required] Account suspended for ${orgName}`,
    emailTemplate('Account Suspended', '#dc2626', `
      <p>Your account for <strong>${orgName}</strong> has been suspended.</p>
      <p><strong>Reason:</strong> ${reasonText}</p>
      <p>Please update your payment method or subscribe to a plan to restore access.</p>
      ${actionButton(`${APP_URL}/billing`, 'Update Payment')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you believe this is an error, contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}

export async function sendPaymentFailedEmail(
  orgName: string,
  amountFormatted: string,
  currency: string,
  recipients: string[]
): Promise<boolean> {
  return sendEmail(
    recipients,
    `[Action Required] Payment failed for ${orgName}`,
    emailTemplate('Payment Failed', '#dc2626', `
      <p>We were unable to process the payment of <strong>${currency} ${amountFormatted}</strong> for <strong>${orgName}</strong>.</p>
      <p>Please update your payment method to avoid any interruption to your service.</p>
      ${actionButton(`${APP_URL}/billing`, 'Update Payment Method')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you believe this is an error, please contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}

export async function sendRefundProcessedEmail(
  orgName: string,
  amountFormatted: string,
  isFullRefund: boolean,
  recipients: string[]
): Promise<boolean> {
  return sendEmail(
    recipients,
    isFullRefund
      ? `Full refund processed for ${orgName}`
      : `Partial refund processed for ${orgName}`,
    emailTemplate('Refund Processed', '#0ea5e9', `
      <p>We've processed a ${isFullRefund ? 'full' : 'partial'} refund of <strong>${amountFormatted}</strong> for <strong>${orgName}</strong>.</p>
      <p>${isFullRefund
        ? 'Your subscription has been cancelled as part of this full refund.'
        : 'Your subscription remains active. If this refund was unexpected, please contact support.'
      }</p>
      ${actionButton(`${APP_URL}/billing`, 'View Billing')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">Questions? Contact <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}

export async function sendDisputeOpenedEmail(
  orgName: string,
  amountFormatted: string,
  reason: string,
  recipients: string[]
): Promise<boolean> {
  return sendEmail(
    recipients,
    `[Action Required] Dispute opened for ${orgName}`,
    emailTemplate('Payment Dispute Opened', '#f59e0b', `
      <p>A payment dispute has been opened for <strong>${orgName}</strong> involving <strong>${amountFormatted}</strong>.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Your account may have temporary service restrictions while this is reviewed.</p>
      ${actionButton(`${APP_URL}/billing`, 'Review Billing')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">Please contact <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a> if you need assistance.</p>
    `)
  )
}

export async function sendDisputeClosedEmail(
  orgName: string,
  outcome: string,
  recipients: string[]
): Promise<boolean> {
  const normalized = outcome.toLowerCase()
  const isWon = normalized === 'won'
  const isLost = normalized === 'lost'
  const outcomeText = isWon
    ? 'The dispute was resolved in your favor.'
    : isLost
    ? 'The dispute was resolved against your account.'
    : 'The dispute has been closed.'

  return sendEmail(
    recipients,
    `Dispute closed for ${orgName}`,
    emailTemplate('Payment Dispute Closed', isWon ? '#16a34a' : isLost ? '#dc2626' : '#6b7280', `
      <p>${outcomeText}</p>
      <p>Organization: <strong>${orgName}</strong></p>
      <p>Outcome: <strong>${normalized.toUpperCase()}</strong></p>
      ${actionButton(`${APP_URL}/billing`, 'Open Billing')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you have questions, contact <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}

// ===== Invitation Email Functions =====

export async function sendMemberInvitationEmail(
  inviterName: string,
  orgName: string,
  role: string,
  acceptUrl: string,
  recipientEmail: string
): Promise<boolean> {
  return sendEmail(
    [recipientEmail],
    `You've been invited to join ${orgName} on VelocityPulse`,
    emailTemplate(`Invitation to ${orgName}`, '#2563eb', `
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on VelocityPulse as a <strong>${role}</strong>.</p>
      <p>Click the button below to accept the invitation. If you don't have an account yet, you'll be able to create one.</p>
      ${actionButton(acceptUrl, 'Accept Invitation')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">This invitation expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.</p>
    `)
  )
}

export async function sendAdminInvitationEmail(
  inviterName: string,
  role: string,
  acceptUrl: string,
  recipientEmail: string
): Promise<boolean> {
  return sendEmail(
    [recipientEmail],
    `You've been invited as a VelocityPulse admin`,
    emailTemplate('Admin Access Invitation', '#dc2626', `
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to become a VelocityPulse admin with the role of <strong>${role}</strong>.</p>
      <p>Click the button below to accept the invitation. If you don't have an account yet, you'll be able to create one.</p>
      ${actionButton(acceptUrl, 'Accept Admin Access')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">This invitation expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.</p>
    `)
  )
}

export async function sendMemberAddedNotificationEmail(
  orgName: string,
  role: string,
  recipientEmail: string
): Promise<boolean> {
  return sendEmail(
    [recipientEmail],
    `You've been added to ${orgName} on VelocityPulse`,
    emailTemplate(`Welcome to ${orgName}`, '#16a34a', `
      <p>Hi there,</p>
      <p>You've been added to <strong>${orgName}</strong> on VelocityPulse as a <strong>${role}</strong>.</p>
      <p>You can now access the dashboard and start collaborating with your team.</p>
      ${actionButton(`${APP_URL}/dashboard`, 'Go to Dashboard')}
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you have any questions, contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    `)
  )
}
