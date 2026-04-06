import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'MyGang <hello@mygang.ai>'

export type SubscriptionTier = 'free' | 'basic' | 'pro'

const TIER_LABEL: Record<SubscriptionTier, string> = {
    free: 'Free',
    basic: 'Basic',
    pro: 'Pro',
}

const TIER_ACCENT: Record<SubscriptionTier, string> = {
    free: '#94a3b8',
    basic: '#60a5fa',
    pro: '#34d399',
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

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function layout(inner: string) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#06090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06090f;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1520;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        ${inner}
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#334155;">
            MyGang · <a href="https://mygang.ai" style="color:#475569;text-decoration:none;">mygang.ai</a>
            &nbsp;·&nbsp; <a href="https://mygang.ai/settings" style="color:#475569;text-decoration:none;">manage subscription</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function header(headline: string, sub?: string) {
    return `<tr><td style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#475569;">MyGang</p>
      <p style="margin:0;font-size:22px;font-weight:900;color:#f1f5f9;line-height:1.2;">${headline}</p>
      ${sub ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b;">${sub}</p>` : ''}
    </td></tr>`
}

function perksTable(tier: SubscriptionTier) {
    const accent = TIER_ACCENT[tier]
    return `<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;">
      ${TIER_PERKS[tier].map(perk => `
      <tr><td style="padding:6px 0;">
        <p style="margin:0;font-size:13px;color:#e2e8f0;">
          <span style="color:${accent};margin-right:10px;">✓</span>${perk}
        </p>
      </td></tr>`).join('')}
    </table>`
}

function cta(label: string, url: string, accent: string) {
    return `<tr><td style="padding:0 32px 28px;">
      <a href="${url}" style="display:inline-block;background:${accent};color:#0f1520;font-size:13px;font-weight:800;text-decoration:none;padding:12px 28px;border-radius:50px;letter-spacing:0.05em;">
        ${label}
      </a>
    </td></tr>`
}

// ─── Email: New purchase ──────────────────────────────────────────────────────

export async function sendPurchaseEmail(opts: { to: string; plan: 'basic' | 'pro' }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, plan } = opts
    const accent = TIER_ACCENT[plan]
    const label = TIER_LABEL[plan]

    const subject = plan === 'pro'
        ? `you're Pro now, let's go 🔥`
        : `your Basic plan is live ✨`

    const html = layout(`
      ${header(
          plan === 'pro' ? `you're officially Pro 🔥` : `welcome to Basic ✨`,
          plan === 'pro'
              ? `your gang just unlocked everything. no limits, no compromises.`
              : `your squad just got a serious upgrade. here's what's new.`
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
          your <strong style="color:#f1f5f9;">${label}</strong> plan is active. go ahead — your gang's been waiting.
        </p>
        ${perksTable(plan)}
        <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
          questions? just reply to this email — we actually read these.
        </p>
      </td></tr>
      ${cta('open mygang →', 'https://mygang.ai/chat', accent)}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendPurchaseEmail error:', error)
    } catch (err) {
        console.error('[email] sendPurchaseEmail failed:', err)
    }
}

// ─── Email: Plan changed (upgrade or downgrade) ───────────────────────────────

export async function sendPlanChangedEmail(opts: { to: string; newTier: SubscriptionTier; prevTier: SubscriptionTier }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, newTier, prevTier } = opts
    const tierOrder = ['free', 'basic', 'pro']
    const isUpgrade = tierOrder.indexOf(newTier) > tierOrder.indexOf(prevTier)
    const accent = TIER_ACCENT[newTier]
    const label = TIER_LABEL[newTier]
    const prevLabel = TIER_LABEL[prevTier]

    const subject = isUpgrade
        ? `you leveled up to ${label} ⬆️`
        : `your plan is now ${label}`

    const html = layout(`
      ${header(
          isUpgrade ? `leveled up to ${label} 🎉` : `you're on ${label} now`,
          isUpgrade
              ? `from ${prevLabel} to ${label} — your squad is ready.`
              : `switched from ${prevLabel}. your gang's still here for you.`
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
          ${isUpgrade
              ? `here's everything you've unlocked on <strong style="color:#f1f5f9;">${label}</strong>:`
              : `here's what's included in your <strong style="color:#f1f5f9;">${label}</strong> plan:`
          }
        </p>
        ${perksTable(newTier)}
        ${!isUpgrade && newTier !== 'free' ? `<p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
          whenever you're ready to level back up, we'll be here.
        </p>` : ''}
        ${!isUpgrade && newTier === 'free' ? `<p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
          you're still part of the gang — just on Free. your squad hasn't gone anywhere.
        </p>` : ''}
      </td></tr>
      ${cta('open mygang →', 'https://mygang.ai/chat', accent)}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendPlanChangedEmail error:', error)
    } catch (err) {
        console.error('[email] sendPlanChangedEmail failed:', err)
    }
}

// ─── Email: Cancellation (grace period — still active until period end) ────────

export async function sendCancellationEmail(opts: { to: string; plan: 'basic' | 'pro'; periodEnd?: string | null }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, plan, periodEnd } = opts
    const label = TIER_LABEL[plan]

    const periodEndStr = periodEnd
        ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null

    const subject = `we'll miss you, but no pressure 💙`

    const html = layout(`
      ${header(`you've cancelled your ${label} plan`, `no hard feelings — for real.`)}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6;">
          your cancellation went through. your <strong style="color:#f1f5f9;">${label}</strong> perks are still yours
          ${periodEndStr
              ? ` until <strong style="color:#f1f5f9;">${periodEndStr}</strong> — after that, you'll move to the Free plan.`
              : `, and you'll move to Free when the current period ends.`
          }
        </p>
        <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6;">
          your squad will be here whenever you come back. they won't forget you.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;">
          <tr><td style="padding:4px 0;">
            <p style="margin:0;font-size:13px;color:#e2e8f0;"><span style="color:#64748b;margin-right:10px;">→</span>you'll keep ${label} access until your billing period ends</p>
          </td></tr>
          <tr><td style="padding:4px 0;">
            <p style="margin:0;font-size:13px;color:#e2e8f0;"><span style="color:#64748b;margin-right:10px;">→</span>after that, you'll automatically move to the Free plan</p>
          </td></tr>
          <tr><td style="padding:4px 0;">
            <p style="margin:0;font-size:13px;color:#e2e8f0;"><span style="color:#64748b;margin-right:10px;">→</span>your chat history and memories stay safe</p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
          changed your mind? you can resubscribe anytime from the pricing page.
        </p>
      </td></tr>
      ${cta('resubscribe anytime →', 'https://mygang.ai/pricing', '#60a5fa')}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendCancellationEmail error:', error)
    } catch (err) {
        console.error('[email] sendCancellationEmail failed:', err)
    }
}

// ─── Email: Subscription expired (now on Free) ───────────────────────────────

export async function sendSubscriptionExpiredEmail(opts: { to: string; prevPlan: 'basic' | 'pro' }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, prevPlan } = opts
    const prevLabel = TIER_LABEL[prevPlan]

    const subject = `you're on the free plan now`

    const html = layout(`
      ${header(`you're on Free now`, `your ${prevLabel} plan has ended — but your gang's still here.`)}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
          your <strong style="color:#f1f5f9;">${prevLabel}</strong> subscription has ended. you're still part of the gang, just on Free now.
        </p>
        ${perksTable('free')}
        <p style="margin:20px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">
          whenever you're ready to unlock more — your squad will be waiting.
        </p>
      </td></tr>
      ${cta('upgrade anytime →', 'https://mygang.ai/pricing', '#34d399')}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendSubscriptionExpiredEmail error:', error)
    } catch (err) {
        console.error('[email] sendSubscriptionExpiredEmail failed:', err)
    }
}

// ─── Legacy alias (used by admin actions) ────────────────────────────────────
// Admin-triggered tier changes go through sendPlanChangedEmail. This alias
// keeps the import in actions.ts working without modification.
export { sendPlanChangedEmail as sendTierChangeEmail }
