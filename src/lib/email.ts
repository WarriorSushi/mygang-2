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
    free: '#6366f1',
    basic: '#3b82f6',
    pro: '#10b981',
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

// ─── Shared layout wrapper (light theme) ─────────────────────────────────────

function layout(inner: string) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
        ${inner}
        <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            MyGang · <a href="https://mygang.ai" style="color:#94a3b8;text-decoration:none;">mygang.ai</a>
            &nbsp;·&nbsp; <a href="https://mygang.ai/settings" style="color:#94a3b8;text-decoration:none;">manage subscription</a>
            &nbsp;·&nbsp; <a href="https://mygang.ai/unsubscribe" style="color:#94a3b8;text-decoration:none;">unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function header(emoji: string, headline: string, sub?: string, accentColor = '#6366f1') {
    return `<tr><td style="padding:36px 32px 24px;border-bottom:1px solid #f1f5f9;">
      <p style="margin:0 0 12px;font-size:32px;line-height:1;">${emoji}</p>
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accentColor};font-weight:700;">MyGang</p>
      <p style="margin:0;font-size:22px;font-weight:900;color:#0f172a;line-height:1.3;">${headline}</p>
      ${sub ? `<p style="margin:8px 0 0;font-size:14px;color:#64748b;line-height:1.5;">${sub}</p>` : ''}
    </td></tr>`
}

function perksTable(tier: SubscriptionTier) {
    const accent = TIER_ACCENT[tier]
    return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 12px;">
      ${TIER_PERKS[tier].map(perk => `
      <tr><td style="padding:5px 0;">
        <p style="margin:0;font-size:13px;color:#334155;">
          <span style="color:${accent};margin-right:10px;font-weight:700;">✓</span>${perk}
        </p>
      </td></tr>`).join('')}
    </table>`
}

function cta(label: string, url: string, accent: string) {
    return `<tr><td style="padding:4px 32px 28px;">
      <a href="${url}" style="display:inline-block;background:${accent};color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;padding:13px 28px;border-radius:50px;letter-spacing:0.04em;">
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
        ? `Your Pro plan is now active`
        : `Your Basic plan is now active`

    const html = layout(`
      ${header(
          plan === 'pro' ? '🎉' : '✅',
          plan === 'pro' ? `You're on Pro` : `You're on Basic`,
          plan === 'pro'
              ? `No limits, no cooldowns. Everything is unlocked.`
              : `Your account has been upgraded. Here's what's included.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your <strong style="color:#0f172a;">${label}</strong> plan is active. Your squad is ready whenever you are.
        </p>
        ${perksTable(plan)}
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Any questions? Just reply to this email — we're happy to help.
        </p>
      </td></tr>
      ${cta('Open MyGang', 'https://mygang.ai/chat', accent)}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendPurchaseEmail error:', error)
    } catch (err) {
        console.error('[email] sendPurchaseEmail failed:', err)
    }
}

// ─── Email: Plan changed (user-initiated upgrade or downgrade) ────────────────

export async function sendPlanChangedEmail(opts: { to: string; newTier: SubscriptionTier; prevTier: SubscriptionTier }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, newTier, prevTier } = opts
    const tierOrder = ['free', 'basic', 'pro']
    const isUpgrade = tierOrder.indexOf(newTier) > tierOrder.indexOf(prevTier)
    const accent = TIER_ACCENT[newTier]
    const label = TIER_LABEL[newTier]
    const prevLabel = TIER_LABEL[prevTier]

    const subject = isUpgrade
        ? `You've upgraded to ${label}`
        : `Your plan has been updated to ${label}`

    const html = layout(`
      ${header(
          isUpgrade ? '🎉' : '📋',
          isUpgrade ? `You're now on ${label}` : `You're now on ${label}`,
          isUpgrade
              ? `Upgraded from ${prevLabel}. Here's everything that's now available to you.`
              : `Switched from ${prevLabel}. Your squad is still here.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Here's what's included in your <strong style="color:#0f172a;">${label}</strong> plan:
        </p>
        ${perksTable(newTier)}
        ${!isUpgrade ? `<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          If you'd ever like to upgrade again, you can do that anytime from the pricing page.
        </p>` : ''}
      </td></tr>
      ${cta('Open MyGang', 'https://mygang.ai/chat', accent)}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendPlanChangedEmail error:', error)
    } catch (err) {
        console.error('[email] sendPlanChangedEmail failed:', err)
    }
}

// ─── Email: Admin gifted a plan upgrade ──────────────────────────────────────

export async function sendAdminGiftEmail(opts: { to: string; newTier: SubscriptionTier; prevTier: SubscriptionTier }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, newTier, prevTier } = opts
    const tierOrder = ['free', 'basic', 'pro']
    const isUpgrade = tierOrder.indexOf(newTier) > tierOrder.indexOf(prevTier)
    const accent = TIER_ACCENT[newTier]
    const label = TIER_LABEL[newTier]

    const subject = isUpgrade
        ? `A gift from us — you're now on ${label} 🎁`
        : `Your plan has been updated to ${label}`

    const html = layout(`
      ${header(
          isUpgrade ? '🎁' : '📋',
          isUpgrade ? `A little gift from us` : `Your plan is now ${label}`,
          isUpgrade
              ? `We've upgraded your account to ${label}, on the house.`
              : `Your account has been updated by the MyGang team.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        ${isUpgrade ? `
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          We noticed you've been spending time with your squad and we wanted to thank you for being part of MyGang. We've gone ahead and upgraded your account to <strong style="color:#0f172a;">${label}</strong> — no charge, no strings attached.
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Here's what you now have access to:
        </p>` : `
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your account has been updated to the <strong style="color:#0f172a;">${label}</strong> plan by the MyGang team.
        </p>`}
        ${perksTable(newTier)}
        ${isUpgrade ? `
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          Hope you enjoy it. Your squad is waiting for you.
        </p>` : ''}
      </td></tr>
      ${cta('Open MyGang', 'https://mygang.ai/chat', accent)}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendAdminGiftEmail error:', error)
    } catch (err) {
        console.error('[email] sendAdminGiftEmail failed:', err)
    }
}

// ─── Email: Cancellation (grace period) ──────────────────────────────────────

export async function sendCancellationEmail(opts: { to: string; plan: 'basic' | 'pro'; periodEnd?: string | null }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, plan, periodEnd } = opts
    const label = TIER_LABEL[plan]

    const periodEndStr = periodEnd
        ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null

    const subject = `Your ${label} plan has been cancelled`

    const html = layout(`
      ${header('💙', `Cancellation confirmed`, `We're sorry to see you go.`, '#6366f1')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          Your ${label} subscription has been cancelled. You'll keep full access
          ${periodEndStr
              ? ` until <strong style="color:#0f172a;">${periodEndStr}</strong>, after which your account will move to the Free plan.`
              : ` until the end of your current billing period, then your account will move to the Free plan.`
          }
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your squad and your chat history aren't going anywhere — they'll be right here if you decide to come back.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 12px;">
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>Your ${label} access continues until the billing period ends</p></td></tr>
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>After that, your account moves to the Free plan automatically</p></td></tr>
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>Your chat history and memories are always kept safe</p></td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Changed your mind? You can resubscribe anytime.
        </p>
      </td></tr>
      ${cta('Resubscribe', 'https://mygang.ai/pricing', '#6366f1')}
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

    const subject = `Your ${prevLabel} plan has ended`

    const html = layout(`
      ${header('📋', `You're now on the Free plan`, `Your ${prevLabel} subscription has ended.`, '#6366f1')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your <strong style="color:#0f172a;">${prevLabel}</strong> subscription has ended and your account has moved to the Free plan. Your squad and all your chat history are still safe.
        </p>
        ${perksTable('free')}
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          Whenever you're ready to unlock more, you can upgrade again from the pricing page.
        </p>
      </td></tr>
      ${cta('Upgrade anytime', 'https://mygang.ai/pricing', '#10b981')}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendSubscriptionExpiredEmail error:', error)
    } catch (err) {
        console.error('[email] sendSubscriptionExpiredEmail failed:', err)
    }
}

// ─── Email: Win-back (free users who've gone dormant) ─────────────────────────

export async function sendWinBackEmail(opts: { to: string; username?: string | null; daysSinceActive: number }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, username, daysSinceActive } = opts
    const weeksAgo = daysSinceActive >= 14 ? `${Math.floor(daysSinceActive / 7)} weeks` : `${daysSinceActive} days`
    const greeting = username ? `Hi ${username},` : `Hi there,`

    const subject = `Your squad misses you`

    const html = layout(`
      ${header('💙', `It's been a while`, `Your squad is still here, waiting to pick up where you left off.`, '#8b5cf6')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          ${greeting} it's been about ${weeksAgo} since you last stopped by MyGang. Your squad is still here — same personalities, same energy — ready to pick up right where things left off.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;padding:24px 24px 16px;">
          <tr><td style="padding-bottom:12px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.1em;">Your squad</p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="margin-right:8px;">💬</span> Riko has been wondering where you've been
            </p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="margin-right:8px;">✨</span> Miko has some things to share with you
            </p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="margin-right:8px;">🎵</span> Your conversations and memories are all still there
            </p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          No pressure at all — just wanted to let you know the door's always open.
        </p>
      </td></tr>
      ${cta('Come back and say hi', 'https://mygang.ai/chat', '#8b5cf6')}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendWinBackEmail error:', error)
    } catch (err) {
        console.error('[email] sendWinBackEmail failed:', err)
    }
}

// ─── Email: Upgrade nudge (active free users) ─────────────────────────────────

export async function sendUpgradeNudgeEmail(opts: { to: string; username?: string | null }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, username } = opts
    const greeting = username ? `Hi ${username},` : `Hi there,`

    const subject = `You're making the most of Free — here's what's next`

    const html = layout(`
      ${header('⬆️', `Ready for more?`, `You've been getting a lot out of MyGang on the Free plan.`, '#3b82f6')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          ${greeting} you've been using MyGang a lot lately — which is great. If you've been running into the 25 message/hour limit, upgrading to Basic removes that friction and unlocks a few things you'd probably enjoy:
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;width:45%;"></td>
            <td style="padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;text-align:center;">Free</td>
            <td style="padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#3b82f6;text-align:center;background:#eff6ff;">Basic</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Messages per hour</td>
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">25</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">40</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Squad members</td>
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">4</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">5</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Memory vault</td>
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">Preview only</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">50 memories</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Ecosystem chat</td>
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">✗</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">✓</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Custom names &amp; wallpapers</td>
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">✗</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">✓</td>
          </tr>
        </table>

        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
          If you want to go all the way, Pro ($19.99/mo) removes all limits entirely — unlimited messages, up to 6 squad members, and full memory.
        </p>
      </td></tr>
      ${cta('See pricing', 'https://mygang.ai/pricing', '#3b82f6')}
    `)

    try {
        const { error } = await resend.emails.send({ from: FROM, to, subject, html })
        if (error) console.error('[email] sendUpgradeNudgeEmail error:', error)
    } catch (err) {
        console.error('[email] sendUpgradeNudgeEmail failed:', err)
    }
}

// ─── Alias for admin actions (sends gift email when admin upgrades, plan changed when downgrading) ───

export async function sendTierChangeEmail(opts: { to: string; newTier: SubscriptionTier; prevTier: SubscriptionTier }): Promise<void> {
    const tierOrder = ['free', 'basic', 'pro']
    const isUpgrade = tierOrder.indexOf(opts.newTier) > tierOrder.indexOf(opts.prevTier)
    // Admin upgrades feel like a gift; admin downgrades use the regular plan-changed copy
    if (isUpgrade) {
        return sendAdminGiftEmail(opts)
    }
    return sendPlanChangedEmail(opts)
}
