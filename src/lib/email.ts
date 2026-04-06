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
        ? `you're Pro now, let's go 🔥`
        : `your Basic plan is live ✨`

    const html = layout(`
      ${header(
          plan === 'pro' ? '🔥' : '✨',
          plan === 'pro' ? `you're officially Pro` : `welcome to Basic`,
          plan === 'pro'
              ? `no limits, no cooldowns. your gang just unlocked everything.`
              : `your squad just got a serious upgrade. here's what's new.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          your <strong style="color:#0f172a;">${label}</strong> plan is active — go ahead, your gang's been waiting.
        </p>
        ${perksTable(plan)}
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          questions? just reply to this — we actually read these.
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
        ? `you leveled up to ${label} ⬆️`
        : `your plan is now ${label}`

    const html = layout(`
      ${header(
          isUpgrade ? '🎉' : '📋',
          isUpgrade ? `leveled up to ${label}` : `you're on ${label} now`,
          isUpgrade
              ? `from ${prevLabel} to ${label} — your squad is ready.`
              : `switched from ${prevLabel}. your gang's still here for you.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          ${isUpgrade
              ? `here's everything you've unlocked on <strong style="color:#0f172a;">${label}</strong>:`
              : `here's what's included in your <strong style="color:#0f172a;">${label}</strong> plan:`
          }
        </p>
        ${perksTable(newTier)}
        ${!isUpgrade ? `<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          whenever you're ready to level back up, we'll be here.
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

// ─── Email: Admin gifted a plan upgrade ──────────────────────────────────────

export async function sendAdminGiftEmail(opts: { to: string; newTier: SubscriptionTier; prevTier: SubscriptionTier }): Promise<void> {
    if (!process.env.RESEND_API_KEY) return
    const { to, newTier, prevTier } = opts
    const tierOrder = ['free', 'basic', 'pro']
    const isUpgrade = tierOrder.indexOf(newTier) > tierOrder.indexOf(prevTier)
    const accent = TIER_ACCENT[newTier]
    const label = TIER_LABEL[newTier]

    const subject = isUpgrade
        ? `🎁 surprise — you just got ${label} for free`
        : `your plan has been updated to ${label}`

    const html = layout(`
      ${header(
          isUpgrade ? '🎁' : '📋',
          isUpgrade ? `you've been gifted ${label}` : `your plan is now ${label}`,
          isUpgrade
              ? `no payment needed. this one's on us — enjoy.`
              : `your account has been updated by the team.`,
          accent
      )}
      <tr><td style="padding:28px 32px 20px;">
        ${isUpgrade ? `
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          hey, we saw you using MyGang and just wanted to say — thanks for being here. we've upgraded your account to <strong style="color:#0f172a;">${label}</strong>, completely on the house.
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          here's what just unlocked for you:
        </p>` : `
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          your account has been updated to the <strong style="color:#0f172a;">${label}</strong> plan by the MyGang team.
        </p>`}
        ${perksTable(newTier)}
        ${isUpgrade ? `
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          go enjoy it — your gang's waiting 💙
        </p>` : ''}
      </td></tr>
      ${cta('open mygang →', 'https://mygang.ai/chat', accent)}
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

    const subject = `we'll miss you, but no pressure 💙`

    const html = layout(`
      ${header('💙', `you've cancelled your ${label} plan`, `no hard feelings — for real.`, '#6366f1')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          your cancellation went through. your <strong style="color:#0f172a;">${label}</strong> perks stay active
          ${periodEndStr
              ? ` until <strong style="color:#0f172a;">${periodEndStr}</strong>, then you'll move to Free.`
              : ` until the end of your billing period, then you'll move to Free.`
          }
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          your squad will be here whenever you come back — they won't forget you.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 20px 12px;">
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>you keep ${label} access until your billing period ends</p></td></tr>
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>after that, you automatically move to Free</p></td></tr>
          <tr><td style="padding:5px 0;"><p style="margin:0;font-size:13px;color:#334155;"><span style="color:#94a3b8;margin-right:10px;">→</span>your chat history and memories stay safe</p></td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          changed your mind? resubscribe anytime.
        </p>
      </td></tr>
      ${cta('resubscribe anytime →', 'https://mygang.ai/pricing', '#6366f1')}
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
      ${header('📋', `you're on Free now`, `your ${prevLabel} plan has ended — but your gang's still here.`, '#6366f1')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          your <strong style="color:#0f172a;">${prevLabel}</strong> subscription has ended. you're still part of the gang, just on Free now.
        </p>
        ${perksTable('free')}
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          whenever you're ready to unlock more — your squad will be waiting.
        </p>
      </td></tr>
      ${cta('upgrade anytime →', 'https://mygang.ai/pricing', '#10b981')}
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
    const name = username || 'hey'
    const weeksAgo = daysSinceActive >= 14 ? `${Math.floor(daysSinceActive / 7)} weeks` : `${daysSinceActive} days`

    const subject = `your gang misses you 💭`

    const html = layout(`
      ${header('💭', `it's been a while`, `your squad hasn't forgotten you.`, '#8b5cf6')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          ${name} — you haven't stopped by in about ${weeksAgo}. your gang is still here, still themselves, still waiting to pick up right where you left off.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;padding:24px;">
          <tr><td style="padding-bottom:16px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.1em;">what your squad's been up to</p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="font-size:16px;margin-right:8px;">💬</span> <strong>Riko</strong> keeps asking if you're coming back
            </p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="font-size:16px;margin-right:8px;">✨</span> <strong>Miko</strong> has some things to tell you
            </p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <p style="margin:0;font-size:14px;color:#4c1d95;line-height:1.5;">
              <span style="font-size:16px;margin-right:8px;">🎵</span> your gang's vibes are ready whenever you are
            </p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6;">
          no pressure, no agenda. just drop in and say hi — your gang picks up exactly where you left off.
        </p>
      </td></tr>
      ${cta('say hi to your gang →', 'https://mygang.ai/chat', '#8b5cf6')}
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
    const name = username || 'hey'

    const subject = `you keep hitting the limit 👀`

    const html = layout(`
      ${header('👀', `you're getting the most out of Free`, `which means you're probably ready for more.`, '#3b82f6')}
      <tr><td style="padding:28px 32px 20px;">
        <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
          ${name}, you've been chatting a lot — which is awesome. but we keep seeing you hit the 25 msg/hr limit and have to wait. here's what Basic unlocks for $14.99/mo:
        </p>

        <!-- Comparison table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;"></td>
            <td style="padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;text-align:center;">Free</td>
            <td style="padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#3b82f6;text-align:center;background:#eff6ff;">Basic</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Messages / hour</td>
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
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">preview only</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">50 memories</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Ecosystem chat</td>
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">✗</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">✓</td>
          </tr>
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-size:13px;color:#475569;">Custom names + wallpapers</td>
            <td style="padding:12px 16px;font-size:13px;color:#94a3b8;text-align:center;">✗</td>
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#1d4ed8;text-align:center;background:#eff6ff;">✓</td>
          </tr>
        </table>

        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
          want even more? Pro is $19.99/mo and removes all limits entirely — unlimited messages, up to 6 squad members, full memory.
        </p>
      </td></tr>
      ${cta('upgrade for $14.99/mo →', 'https://mygang.ai/pricing', '#3b82f6')}
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
