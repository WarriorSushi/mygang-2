/**
 * Tests for Phase 06C WYWA generator pure helpers.
 *
 * Proves:
 * - Tier eligibility: only basic/pro pass
 * - Inactivity threshold works correctly
 * - Cooldown check works correctly
 * - Participant picking: correct count, no duplicates
 * - Message ID generation: stable format
 * - Timestamp generation: ascending, spaced apart
 *
 * Run: pnpm exec tsx tests/wywa-generator.test.ts
 */

import {
    isEligibleTier,
    isInactiveEnough,
    isCooldownSatisfied,
    pickParticipants,
    buildWywaMessageId,
    buildStableTimestamps,
    buildParticipantBlock,
    INACTIVITY_THRESHOLD_MS,
    GENERATION_COOLDOWN_MS,
    MIN_SQUAD_SIZE,
} from '../src/lib/ai/wywa'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  PASS: ${label}`)
        passed++
    } else {
        console.error(`  FAIL: ${label}`)
        failed++
    }
}

const now = Date.now()

// ── isEligibleTier ──

console.log('\n1. isEligibleTier')
assert(isEligibleTier('basic') === true, 'basic is eligible')
assert(isEligibleTier('pro') === true, 'pro is eligible')
assert(isEligibleTier('free') === false, 'free is not eligible')
assert(isEligibleTier(null) === false, 'null is not eligible')
assert(isEligibleTier(undefined) === false, 'undefined is not eligible')
assert(isEligibleTier('') === false, 'empty string is not eligible')

// ── isInactiveEnough ──

console.log('\n2. isInactiveEnough')
{
    const twoHoursAgo = new Date(now - INACTIVITY_THRESHOLD_MS - 1000).toISOString()
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString()
    const justNow = new Date(now - 5000).toISOString()

    assert(isInactiveEnough(twoHoursAgo, now) === true, 'inactive >2h ago → eligible')
    assert(isInactiveEnough(oneHourAgo, now) === false, 'active 1h ago → not eligible')
    assert(isInactiveEnough(justNow, now) === false, 'active just now → not eligible')
    assert(isInactiveEnough(null, now) === true, 'null last_active → eligible (never active)')
    assert(isInactiveEnough(undefined, now) === true, 'undefined last_active → eligible')
    assert(isInactiveEnough('invalid-date', now) === true, 'invalid date → eligible (safe fallback)')
}

// ── isCooldownSatisfied ──

console.log('\n3. isCooldownSatisfied')
{
    const sevenHoursAgo = new Date(now - GENERATION_COOLDOWN_MS - 60 * 60 * 1000).toISOString()
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString()

    assert(isCooldownSatisfied(sevenHoursAgo, now) === true, 'last gen 7h ago → cooldown satisfied')
    assert(isCooldownSatisfied(threeHoursAgo, now) === false, 'last gen 3h ago → cooldown not met')
    assert(isCooldownSatisfied(null, now) === true, 'null → never generated → satisfied')
    assert(isCooldownSatisfied(undefined, now) === true, 'undefined → satisfied')
}

// ── pickParticipants ──

console.log('\n4. pickParticipants')
{
    const all = ['kael', 'nyx', 'atlas', 'luna', 'rico']

    const pick2 = pickParticipants(all, 2)
    assert(pick2.length === 2, 'picks exactly 2')
    assert(new Set(pick2).size === 2, 'no duplicates in pick of 2')
    assert(pick2.every(id => all.includes(id)), 'all picks are from squad')

    const pick3 = pickParticipants(all, 3)
    assert(pick3.length === 3, 'picks exactly 3')
    assert(new Set(pick3).size === 3, 'no duplicates in pick of 3')

    // Small squad: returns all
    const small = ['kael', 'nyx']
    const pickAll = pickParticipants(small, 3)
    assert(pickAll.length === 2, 'returns all when squad smaller than count')
    assert(pickAll.includes('kael') && pickAll.includes('nyx'), 'contains both members')

    // Single member
    const single = ['luna']
    const pickSingle = pickParticipants(single, 2)
    assert(pickSingle.length === 1, 'single member returns 1')

    // Empty squad
    const empty: string[] = []
    const pickEmpty = pickParticipants(empty, 3)
    assert(pickEmpty.length === 0, 'empty squad returns empty')
}

// ── buildWywaMessageId ──

console.log('\n5. buildWywaMessageId')
{
    const id0 = buildWywaMessageId('abc123', 0)
    const id1 = buildWywaMessageId('abc123', 1)
    assert(id0.startsWith('wywa-'), 'starts with wywa- prefix')
    assert(id0 !== id1, 'different index → different id')
    assert(id0 === 'wywa-abc123-0', 'correct format for index 0')
}

// ── buildStableTimestamps ──

console.log('\n6. buildStableTimestamps')
{
    const base = Date.now()
    const ts = buildStableTimestamps(base, 4)

    assert(ts.length === 4, 'generates correct count')

    const parsed = ts.map(t => new Date(t).getTime())
    assert(parsed.every(t => Number.isFinite(t)), 'all are valid timestamps')

    // All ascending
    let ascending = true
    for (let i = 1; i < parsed.length; i++) {
        if (parsed[i] <= parsed[i - 1]) ascending = false
    }
    assert(ascending, 'timestamps are strictly ascending')

    // All after base time
    assert(parsed[0] > base, 'first timestamp is after base')

    // Spacing: each gap is 30-90 seconds
    let spacingOk = true
    for (let i = 1; i < parsed.length; i++) {
        const gap = parsed[i] - parsed[i - 1]
        if (gap < 30_000 || gap > 90_000) spacingOk = false
    }
    assert(spacingOk, 'gaps are 30-90 seconds apart')
}

// ── Source field verification (structural) ──

// ── MIN_SQUAD_SIZE ──

console.log('\n7. MIN_SQUAD_SIZE enforcement')
{
    assert(MIN_SQUAD_SIZE === 2, 'minimum squad size is 2')

    // pickParticipants with 1 member returns 1 — caller must check < MIN_SQUAD_SIZE
    const single = pickParticipants(['kael'], 3)
    assert(single.length < MIN_SQUAD_SIZE, 'single member fails MIN_SQUAD_SIZE check')

    // pickParticipants with 2 members passes
    const pair = pickParticipants(['kael', 'nyx'], 3)
    assert(pair.length >= MIN_SQUAD_SIZE, 'pair passes MIN_SQUAD_SIZE check')
}

// ── buildParticipantBlock ──

console.log('\n8. buildParticipantBlock — IDs exposed in prompt')
{
    // Normal names (no custom)
    const block = buildParticipantBlock(['kael', 'luna'], {})
    assert(block.includes('speaker_id: "kael"'), 'includes kael speaker_id')
    assert(block.includes('speaker_id: "luna"'), 'includes luna speaker_id')
    assert(block.includes('name: "Kael"'), 'includes Kael display name')
    assert(block.includes('name: "Luna"'), 'includes Luna display name')
    // ID must come before name so LLM sees it first
    const kaelLine = block.split('\n').find(l => l.includes('kael'))!
    assert(kaelLine.indexOf('speaker_id') < kaelLine.indexOf('name:'), 'speaker_id appears before name')
}

console.log('\n9. buildParticipantBlock — custom names use ID not custom name as speaker')
{
    const block = buildParticipantBlock(['kael', 'nyx'], { kael: 'Kale', nyx: 'Shadow' })
    assert(block.includes('speaker_id: "kael"'), 'custom name: kael ID still present')
    assert(block.includes('name: "Kale"'), 'custom name: Kale display')
    assert(block.includes('speaker_id: "nyx"'), 'custom name: nyx ID still present')
    assert(block.includes('name: "Shadow"'), 'custom name: Shadow display')
    // Ensure the speaker_id is lowercase ID, not the custom name
    assert(!block.includes('speaker_id: "Kale"'), 'speaker_id is NOT the custom name')
    assert(!block.includes('speaker_id: "Shadow"'), 'speaker_id is NOT the custom name')
}

console.log('\n10. buildParticipantBlock — unknown character filtered out')
{
    const block = buildParticipantBlock(['kael', 'nonexistent'], {})
    assert(block.includes('speaker_id: "kael"'), 'known character included')
    assert(!block.includes('nonexistent'), 'unknown character excluded')
}

console.log('\n11. Row shaping verification')
{
    // Verify that the generator module exports the right constants
    assert(INACTIVITY_THRESHOLD_MS === 2 * 60 * 60 * 1000, 'inactivity threshold is 2 hours')
    assert(GENERATION_COOLDOWN_MS === 6 * 60 * 60 * 1000, 'cooldown is 6 hours')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
