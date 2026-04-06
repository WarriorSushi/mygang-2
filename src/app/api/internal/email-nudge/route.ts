/**
 * Cron: /api/internal/email-nudge
 *
 * Runs daily. Sends two types of emails to free-plan users only:
 *
 * 1. WIN-BACK: free users inactive for 7–60 days (haven't used the app in a while)
 *    — send once, then mark as sent so they don't get it again
 *
 * 2. UPGRADE NUDGE: free users who are actively using (active in last 7 days)
 *    and sending lots of messages (close to / hitting the hourly limit)
 *    — send once per 30 days max
 *
 * Paid users are never touched.
 *
 * Idempotency: tracks sends in billing_events table using event_type
 * 'email.winback_sent' and 'email.nudge_sent' with a composite dodo_event_id
 * of `<type>:<userId>:<YYYY-WW>` so each user gets at most one per week slot.
 *
 * Local invocation:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/internal/email-nudge
 */

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWinBackEmail, sendUpgradeNudgeEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// How many users to process per run (stay well within 60s)
const BATCH_LIMIT = 80

// Win-back: inactive for at least this many days
const WINBACK_MIN_INACTIVE_DAYS = 7

// Win-back: don't bother users who've been gone more than this (probably churned for good)
const WINBACK_MAX_INACTIVE_DAYS = 60

// Upgrade nudge: user must have been active within this many days
const NUDGE_ACTIVE_WITHIN_DAYS = 7

// Upgrade nudge: minimum total messages to qualify (shows they're engaged)
const NUDGE_MIN_MSGS_24H = 15

// Re-nudge cooldown: don't send the same email type to the same user more often than this
const NUDGE_COOLDOWN_DAYS = 30
const WINBACK_COOLDOWN_DAYS = 30

function isoNDaysAgo(n: number) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString()
}

// ISO week key like "2026-W14" — used for idempotency so replayed cron runs don't double-send
function weekKey() {
    const now = new Date()
    const jan1 = new Date(now.getFullYear(), 0, 1)
    const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

async function wasRecentlySent(admin: ReturnType<typeof createAdminClient>, eventKey: string): Promise<boolean> {
    const { data } = await admin
        .from('billing_events')
        .select('id')
        .eq('dodo_event_id', eventKey)
        .maybeSingle()
    return !!data
}

async function markSent(admin: ReturnType<typeof createAdminClient>, userId: string, eventType: string, eventKey: string) {
    await admin.from('billing_events').insert({
        user_id: userId,
        event_type: eventType,
        dodo_event_id: eventKey,
        payload: {},
    })
}

async function getUserEmail(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
    try {
        const { data } = await admin.auth.admin.getUserById(userId)
        return data?.user?.email ?? null
    } catch {
        return null
    }
}

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
        console.error('[email-nudge-cron] CRON_SECRET not configured')
        return NextResponse.json({ error: 'Not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    const expected = `Bearer ${cronSecret}`
    if (
        !authHeader ||
        authHeader.length !== expected.length ||
        !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const wk = weekKey()

    let winbackSent = 0
    let nudgeSent = 0
    let winbackSkipped = 0
    let nudgeSkipped = 0

    // ── 1. Win-back: free users inactive for 7–60 days ─────────────────────

    const winbackCutoffNew = isoNDaysAgo(WINBACK_MIN_INACTIVE_DAYS)   // inactive since at least 7d ago
    const winbackCutoffOld = isoNDaysAgo(WINBACK_MAX_INACTIVE_DAYS)   // but not more than 60d ago

    const { data: dormantUsers } = await admin
        .from('profiles')
        .select('id, username, last_active_at')
        .eq('subscription_tier', 'free')
        .lt('last_active_at', winbackCutoffNew)
        .gt('last_active_at', winbackCutoffOld)
        .order('last_active_at', { ascending: false })
        .limit(BATCH_LIMIT / 2)

    for (const user of dormantUsers ?? []) {
        const eventKey = `email.winback:${user.id}:${wk}`
        const alreadySent = await wasRecentlySent(admin, eventKey)
        if (alreadySent) { winbackSkipped++; continue }

        // Also check if we sent ANY winback recently (30-day cooldown)
        const cooldownCutoff = isoNDaysAgo(WINBACK_COOLDOWN_DAYS)
        const { data: recentSend } = await admin
            .from('billing_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_type', 'email.winback_sent')
            .gt('created_at', cooldownCutoff)
            .maybeSingle()
        if (recentSend) { winbackSkipped++; continue }

        const email = await getUserEmail(admin, user.id)
        if (!email) { winbackSkipped++; continue }

        const daysSince = user.last_active_at
            ? Math.floor((Date.now() - new Date(user.last_active_at).getTime()) / 86400000)
            : WINBACK_MIN_INACTIVE_DAYS

        try {
            await sendWinBackEmail({ to: email, username: user.username, daysSinceActive: daysSince })
            await markSent(admin, user.id, 'email.winback_sent', eventKey)
            winbackSent++
        } catch (err) {
            console.error(`[email-nudge-cron] winback failed for ${user.id}:`, err)
        }
    }

    // ── 2. Upgrade nudge: active free users hitting limits ──────────────────

    const nudgeActiveCutoff = isoNDaysAgo(NUDGE_ACTIVE_WITHIN_DAYS)
    const since24h = isoNDaysAgo(1)

    // Find free users who've been active recently and sent a lot of messages today
    const { data: activeUsers } = await admin
        .from('profiles')
        .select('id, username, daily_msg_count')
        .eq('subscription_tier', 'free')
        .gte('last_active_at', nudgeActiveCutoff)
        .gte('daily_msg_count', NUDGE_MIN_MSGS_24H)
        .order('daily_msg_count', { ascending: false })
        .limit(BATCH_LIMIT / 2)

    for (const user of activeUsers ?? []) {
        const eventKey = `email.nudge:${user.id}:${wk}`
        const alreadySent = await wasRecentlySent(admin, eventKey)
        if (alreadySent) { nudgeSkipped++; continue }

        // 30-day cooldown on nudge emails
        const cooldownCutoff = isoNDaysAgo(NUDGE_COOLDOWN_DAYS)
        const { data: recentSend } = await admin
            .from('billing_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_type', 'email.nudge_sent')
            .gt('created_at', cooldownCutoff)
            .maybeSingle()
        if (recentSend) { nudgeSkipped++; continue }

        const email = await getUserEmail(admin, user.id)
        if (!email) { nudgeSkipped++; continue }

        try {
            await sendUpgradeNudgeEmail({ to: email, username: user.username })
            await markSent(admin, user.id, 'email.nudge_sent', eventKey)
            nudgeSent++
        } catch (err) {
            console.error(`[email-nudge-cron] nudge failed for ${user.id}:`, err)
        }
    }

    console.log(
        `[email-nudge-cron] done: winback=${winbackSent} (skipped=${winbackSkipped}) nudge=${nudgeSent} (skipped=${nudgeSkipped})`
    )

    return NextResponse.json({ ok: true, winbackSent, nudgeSent, winbackSkipped, nudgeSkipped })
}
