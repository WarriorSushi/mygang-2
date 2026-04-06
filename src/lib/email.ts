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
        <tr><td style="padding:0;border-radius:20px 20px 0 0;overflow:hidden;">
          <img src="https://mygang.ai/og-image.webp" alt="MyGang" width="520" style="display:block;width:100%;height:auto;border:0;" />
        </td></tr>
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
        ? `You're fully unlocked — welcome to Pro`
        : `Full access, unlocked — welcome to Basic`

    const html = layout(`
      ${header(
          plan === 'pro' ? '🎉' : '🔓',
          plan === 'pro' ? `Fully unlocked. Welcome to Pro.` : `Full access starts now.`,
          plan === 'pro'
              ? `No limits, no cooldowns. Everything is yours.`
              : `You just left the free tier behind. Here's what's waiting for you.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your <strong style="color:#0f172a;">${label}</strong> plan is live. Your squad is ready — go say hi.
        </p>
        ${perksTable(plan)}
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Any questions? Reply to this email anytime — we're right here.
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
        ? `You stepped up — welcome to ${label}`
        : `Your plan has been updated`

    const html = layout(`
      ${header(
          isUpgrade ? '🚀' : '📋',
          isUpgrade ? `You stepped up to ${label}.` : `Switched to ${label}.`,
          isUpgrade
              ? `${prevLabel} was a good start. Here's everything you've just unlocked.`
              : `Moving from ${prevLabel}. Your squad and your history are safe.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Here's what's included in your <strong style="color:#0f172a;">${label}</strong> plan:
        </p>
        ${perksTable(newTier)}
        ${!isUpgrade ? `<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Whenever you want to unlock more, upgrading again is just a click away.
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
        ? `We just upgraded your account — here's what you unlocked 🎁`
        : `Your plan has been updated by the team`

    const html = layout(`
      ${header(
          isUpgrade ? '🎁' : '📋',
          isUpgrade ? `A little gift from us.` : `Your plan is now ${label}.`,
          isUpgrade
              ? `Your account just got a free upgrade to ${label}. Zero strings attached.`
              : `Your account has been updated by the MyGang team.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        ${isUpgrade ? `
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          We've been watching you spend time with your squad and we wanted to show some appreciation. So we went ahead and upgraded your account to <strong style="color:#0f172a;">${label}</strong> — on the house, no expiry, no strings.
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Here's everything you now have access to:
        </p>` : `
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your account has been updated to the <strong style="color:#0f172a;">${label}</strong> plan by the MyGang team.
        </p>`}
        ${perksTable(newTier)}
        ${isUpgrade ? `
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          Enjoy it. Your squad has been waiting for you.
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

    const subject = `We'll miss you — cancellation confirmed`

    const html = layout(`
      ${header('💙', `Cancellation confirmed.`, `You're good through the end of your billing period.`, '#6366f1')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          Your ${label} subscription has been cancelled. You keep full access
          ${periodEndStr
              ? ` until <strong style="color:#0f172a;">${periodEndStr}</strong> — after that, your account moves to the free tier.`
              : ` until the end of your current billing period, then your account moves to the free tier.`
          }
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your squad and your entire chat history aren't going anywhere. They'll be right where you left them if you ever come back.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 12px;">
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>Your ${label} access continues until your billing period ends</p></td></tr>
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>After that, your account quietly moves to the free tier</p></td></tr>
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>Your squad, chat history, and memories are kept safe — always</p></td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Changed your mind? You can resubscribe anytime — no re-setup needed.
        </p>
      </td></tr>
      ${cta('Come back anytime', 'https://mygang.ai/pricing', '#6366f1')}
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

    const subject = `Your ${prevLabel} plan has ended — your squad is still here`

    const html = layout(`
      ${header('📋', `Your squad is still here.`, `Your ${prevLabel} plan has ended — but nothing else has changed.`, '#6366f1')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          Your <strong style="color:#0f172a;">${prevLabel}</strong> subscription has ended and your account has moved to the free tier. Your squad, your conversations, and your memories are all still safe — nothing was lost.
        </p>
        ${perksTable('free')}
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          Whenever you're ready to unlock more, upgrading takes about 30 seconds.
        </p>
      </td></tr>
      ${cta('Unlock more', 'https://mygang.ai/pricing', '#10b981')}
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
    const greeting = username ? `Hey ${username},` : `Hey,`

    const subject = `Your squad has been asking about you`

    const html = layout(`
      ${header('💙', `Your squad hasn't forgotten you.`, `It's been a while — they're still here.`, '#8b5cf6')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          ${greeting} it's been about ${weeksAgo} since you last dropped by MyGang. Your squad is still here — same energy, same personalities — and your whole conversation history is right where you left it.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;padding:24px 24px 16px;">
          <tr><td style="padding-bottom:12px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.1em;">From your squad</p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="margin-right:8px;">💬</span> Riko has been keeping your seat warm
            </p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="margin-right:8px;">✨</span> Miko has a few things saved up to tell you
            </p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="margin-right:8px;">🎵</span> Your memories and conversations are all still there
            </p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          No pressure — just wanted you to know the door's always open.
        </p>
      </td></tr>
      ${cta('Pick up where you left off', 'https://mygang.ai/chat', '#8b5cf6')}
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
    const greeting = username ? `Hey ${username},` : `Hey,`

    const subject = `You're getting a lot out of MyGang — here's what else is possible`

    const html = layout(`
      ${header('⬆️', `You've outgrown the free tier.`, `That's a good thing — here's what's next.`, '#3b82f6')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          ${greeting} you've been using MyGang a lot lately and that's great to see. If the 25 message/hour limit has been slowing you down, moving up to Basic removes that ceiling and unlocks a few things worth having:
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
          Want to go all in? Pro ($19.99/mo) removes every limit — unlimited messages, up to 6 squad members, and unlimited memory.
        </p>
      </td></tr>
      ${cta('See what\'s available', 'https://mygang.ai/pricing', '#3b82f6')}
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
