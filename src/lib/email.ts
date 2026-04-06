import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'MyGang <hello@mygang.ai>'

export type SubscriptionTier = 'free' | 'basic' | 'pro'

const TIER_LABEL: Record<SubscriptionTier, string> = {
    free: 'Free',
    basic: 'Basic',
    pro: 'Pro',
}

const TIER_PERKS: Record<SubscriptionTier, string[]> = {
    free: [
        '25 messages per hour',
        'Up to 4 squad members',
        '5-memory vault preview',
    ],
    basic: [
        '40 messages per hour',
        'Up to 5 squad members',
        'Full memory vault (50 memories)',
        'Ecosystem chat mode',
        'Custom character names & wallpapers',
    ],
    pro: [
        'Unlimited messages',
        'Up to 6 squad members',
        'Full memory vault (unlimited)',
        'Priority response speed',
        'All features included',
    ],
}

function tierEmailHtml(to: string, newTier: SubscriptionTier, prevTier: SubscriptionTier): string {
    const isUpgrade = ['free', 'basic', 'pro'].indexOf(newTier) > ['free', 'basic', 'pro'].indexOf(prevTier)
    const isDowngrade = !isUpgrade && newTier !== prevTier
    const perks = TIER_PERKS[newTier]

    const accentColor = newTier === 'pro' ? '#34d399' : newTier === 'basic' ? '#60a5fa' : '#94a3b8'
    const headline = isUpgrade
        ? `You've been upgraded to ${TIER_LABEL[newTier]} 🎉`
        : isDowngrade
            ? `Your plan has been updated to ${TIER_LABEL[newTier]}`
            : `Your plan is now ${TIER_LABEL[newTier]}`

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#06090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06090f;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1520;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#475569;">MyGang</p>
          <p style="margin:0;font-size:22px;font-weight:900;color:#f1f5f9;line-height:1.2;">${headline}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
            Your MyGang account has been updated. Here's what's included in your <strong style="color:#f1f5f9;">${TIER_LABEL[newTier]}</strong> plan:
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;">
            ${perks.map(perk => `
            <tr><td style="padding:6px 0;">
              <p style="margin:0;font-size:13px;color:#e2e8f0;">
                <span style="color:${accentColor};margin-right:10px;">✓</span>${perk}
              </p>
            </td></tr>`).join('')}
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
            Questions? Just reply to this email — we're here.
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 28px;">
          <a href="https://mygang.ai/chat" style="display:inline-block;background:${accentColor};color:#0f1520;font-size:13px;font-weight:800;text-decoration:none;padding:12px 28px;border-radius:50px;letter-spacing:0.05em;">
            Open MyGang →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#334155;">
            MyGang · <a href="https://mygang.ai" style="color:#475569;text-decoration:none;">mygang.ai</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendTierChangeEmail(opts: {
    to: string
    newTier: SubscriptionTier
    prevTier: SubscriptionTier
}): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[email] RESEND_API_KEY not set — skipping tier change email')
        return
    }

    const isUpgrade = ['free', 'basic', 'pro'].indexOf(opts.newTier) > ['free', 'basic', 'pro'].indexOf(opts.prevTier)
    const subject = isUpgrade
        ? `You're now on the ${TIER_LABEL[opts.newTier]} plan 🎉`
        : `Your MyGang plan has been updated to ${TIER_LABEL[opts.newTier]}`

    try {
        const { error } = await resend.emails.send({
            from: FROM,
            to: opts.to,
            subject,
            html: tierEmailHtml(opts.to, opts.newTier, opts.prevTier),
        })
        if (error) console.error('[email] Resend error:', error)
    } catch (err) {
        console.error('[email] Failed to send tier change email:', err)
    }
}
