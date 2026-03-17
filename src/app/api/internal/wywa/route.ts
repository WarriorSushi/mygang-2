/**
 * Phase 06D: Protected cron route for WYWA batch generation.
 *
 * Vercel Cron hits GET /api/internal/wywa on schedule.
 * Protected by CRON_SECRET — rejects requests without valid authorization.
 *
 * Local invocation:
 *   curl -H "Authorization: Bearer <your-CRON_SECRET>" http://localhost:3000/api/internal/wywa
 */

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runWywaBatch } from '@/lib/ai/wywa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
        console.error('[wywa-cron] CRON_SECRET not configured')
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

    try {
        const result = await runWywaBatch()

        console.log(
            `[wywa-cron] Batch complete: scanned=${result.scanned} eligible=${result.eligible} ` +
            `attempted=${result.attempted} generated=${result.generated} errored=${result.errored} ` +
            `cappedAt=${result.cappedAt ?? 'none'}`
        )

        return NextResponse.json({
            ok: true,
            ...result,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[wywa-cron] Batch failed:', message)
        return NextResponse.json({ error: 'Batch failed', message }, { status: 500 })
    }
}
