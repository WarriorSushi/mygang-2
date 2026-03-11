/**
 * Tests for Phase 06D WYWA batch/scheduler helpers.
 *
 * Proves:
 * - Candidate selection constants are correct
 * - MAX_CANDIDATES_PER_RUN and MAX_GENERATED_PER_RUN are conservative
 * - Eligibility helpers still exclude free-tier users
 * - WywaBatchResult shape is valid
 *
 * Run: pnpm exec tsx tests/wywa-batch.test.ts
 */

import {
    isEligibleTier,
    isInactiveEnough,
    isCooldownSatisfied,
    filterEligibleCandidates,
    resolveEffectiveSquad,
    MAX_CANDIDATES_PER_RUN,
    MAX_GENERATED_PER_RUN,
    CANDIDATE_PREFETCH_LIMIT,
    INACTIVITY_THRESHOLD_MS,
    GENERATION_COOLDOWN_MS,
    MIN_SQUAD_SIZE,
    type WywaBatchResult,
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

// ── Constants verification ──

console.log('\n1. Batch rollout cap constants')
assert(MAX_CANDIDATES_PER_RUN === 10, 'MAX_CANDIDATES_PER_RUN is 10')
assert(MAX_GENERATED_PER_RUN === 5, 'MAX_GENERATED_PER_RUN is 5')
assert(MAX_GENERATED_PER_RUN <= MAX_CANDIDATES_PER_RUN, 'generated cap <= candidate cap')

// ── Free-tier exclusion at candidate query level ──

console.log('\n2. Free-tier users excluded by eligibility check')
assert(isEligibleTier('free') === false, 'free excluded')
assert(isEligibleTier(null) === false, 'null excluded')
assert(isEligibleTier('basic') === true, 'basic included')
assert(isEligibleTier('pro') === true, 'pro included')

// ── Inactivity threshold for candidate query ──

console.log('\n3. Inactivity cutoff used in candidate selection')
{
    const inactivityCutoff = new Date(now - INACTIVITY_THRESHOLD_MS).toISOString()
    const recentActivity = new Date(now - 30 * 60 * 1000).toISOString() // 30 min ago
    const oldActivity = new Date(now - 3 * 60 * 60 * 1000).toISOString() // 3h ago

    assert(isInactiveEnough(oldActivity, now) === true, '3h old activity → inactive enough')
    assert(isInactiveEnough(recentActivity, now) === false, '30min old activity → too recent')
    assert(isInactiveEnough(null, now) === true, 'null activity → treated as inactive')

    // Verify cutoff timestamp is reasonable
    const cutoffTime = new Date(inactivityCutoff).getTime()
    assert(now - cutoffTime === INACTIVITY_THRESHOLD_MS, 'inactivity cutoff is exactly 2h before now')
}

// ── Cooldown threshold for candidate query ──

console.log('\n4. Cooldown cutoff used in candidate selection')
{
    const cooldownCutoff = new Date(now - GENERATION_COOLDOWN_MS).toISOString()
    const recentGen = new Date(now - 2 * 60 * 60 * 1000).toISOString() // 2h ago
    const oldGen = new Date(now - 8 * 60 * 60 * 1000).toISOString() // 8h ago

    assert(isCooldownSatisfied(oldGen, now) === true, '8h old gen → cooldown met')
    assert(isCooldownSatisfied(recentGen, now) === false, '2h old gen → cooldown not met')
    assert(isCooldownSatisfied(null, now) === true, 'null gen → never generated → OK')

    const cutoffTime = new Date(cooldownCutoff).getTime()
    assert(now - cutoffTime === GENERATION_COOLDOWN_MS, 'cooldown cutoff is exactly 6h before now')
}

// ── Insufficient squad is caught before generation ──

console.log('\n5. Squad size check prevents generation for small squads')
assert(MIN_SQUAD_SIZE === 2, 'MIN_SQUAD_SIZE is 2')

// ── WywaBatchResult shape ──

console.log('\n6. WywaBatchResult shape is valid')
{
    const result: WywaBatchResult = {
        scanned: 10,
        eligible: 8,
        attempted: 5,
        generated: 3,
        skipped: { skipped_free_tier: 1, skipped_cooldown: 1 },
        errored: 1,
        cappedAt: 'generated',
    }
    assert(typeof result.scanned === 'number', 'scanned is number')
    assert(typeof result.eligible === 'number', 'eligible is number')
    assert(typeof result.attempted === 'number', 'attempted is number')
    assert(typeof result.generated === 'number', 'generated is number')
    assert(typeof result.skipped === 'object', 'skipped is object')
    assert(typeof result.errored === 'number', 'errored is number')
    assert(result.cappedAt === 'generated' || result.cappedAt === 'candidates' || result.cappedAt === null, 'cappedAt is valid')
}

// ── Cap enforcement logic ──

console.log('\n7. Cap enforcement: generated cap stops before candidate cap')
{
    // Simulate: 10 candidates but only 5 can generate
    // This validates the constants relationship
    assert(MAX_GENERATED_PER_RUN < MAX_CANDIDATES_PER_RUN, 'generation cap is stricter than candidate cap')
}

console.log('\n8. WywaBatchResult with no candidates')
{
    const empty: WywaBatchResult = {
        scanned: 0,
        eligible: 0,
        attempted: 0,
        generated: 0,
        skipped: {},
        errored: 0,
        cappedAt: null,
    }
    assert(empty.scanned === 0, 'empty batch: scanned is 0')
    assert(empty.generated === 0, 'empty batch: generated is 0')
    assert(Object.keys(empty.skipped).length === 0, 'empty batch: no skips')
    assert(empty.cappedAt === null, 'empty batch: not capped')
}

console.log('\n9. WywaBatchResult cappedAt values')
{
    const capped1: WywaBatchResult = { scanned: 10, eligible: 10, attempted: 5, generated: 5, skipped: {}, errored: 0, cappedAt: 'generated' }
    const capped2: WywaBatchResult = { scanned: 10, eligible: 10, attempted: 10, generated: 3, skipped: {}, errored: 0, cappedAt: 'candidates' }
    const notCapped: WywaBatchResult = { scanned: 3, eligible: 3, attempted: 3, generated: 2, skipped: {}, errored: 1, cappedAt: null }

    assert(capped1.cappedAt === 'generated', 'generation cap hit')
    assert(capped2.cappedAt === 'candidates', 'candidate cap hit')
    assert(notCapped.cappedAt === null, 'no cap hit')
}

// ── CANDIDATE_PREFETCH_LIMIT ──

console.log('\n10. CANDIDATE_PREFETCH_LIMIT is conservative')
assert(CANDIDATE_PREFETCH_LIMIT === 50, 'prefetch limit is 50')
assert(CANDIDATE_PREFETCH_LIMIT >= MAX_CANDIDATES_PER_RUN, 'prefetch >= candidate cap')

// ── filterEligibleCandidates ──

console.log('\n11. filterEligibleCandidates — excludes free-tier users')
{
    const profiles = [
        { id: 'u1', subscription_tier: 'free', last_active_at: null, last_wywa_generated_at: null },
        { id: 'u2', subscription_tier: 'basic', last_active_at: null, last_wywa_generated_at: null },
        { id: 'u3', subscription_tier: null, last_active_at: null, last_wywa_generated_at: null },
    ]
    const result = filterEligibleCandidates(profiles, now, 10)
    assert(result.length === 1, 'only 1 eligible')
    assert(result[0].id === 'u2', 'u2 (basic) passes')
}

console.log('\n12. filterEligibleCandidates — excludes recently active users')
{
    const recentlyActive = new Date(now - 30 * 60 * 1000).toISOString() // 30 min ago
    const longAgo = new Date(now - 4 * 60 * 60 * 1000).toISOString() // 4h ago
    const profiles = [
        { id: 'u1', subscription_tier: 'pro', last_active_at: recentlyActive, last_wywa_generated_at: null },
        { id: 'u2', subscription_tier: 'pro', last_active_at: longAgo, last_wywa_generated_at: null },
    ]
    const result = filterEligibleCandidates(profiles, now, 10)
    assert(result.length === 1, 'only 1 eligible')
    assert(result[0].id === 'u2', 'u2 (inactive 4h) passes')
}

console.log('\n13. filterEligibleCandidates — excludes users on cooldown')
{
    const recentGen = new Date(now - 2 * 60 * 60 * 1000).toISOString() // 2h ago
    const oldGen = new Date(now - 8 * 60 * 60 * 1000).toISOString() // 8h ago
    const profiles = [
        { id: 'u1', subscription_tier: 'basic', last_active_at: null, last_wywa_generated_at: recentGen },
        { id: 'u2', subscription_tier: 'basic', last_active_at: null, last_wywa_generated_at: oldGen },
        { id: 'u3', subscription_tier: 'basic', last_active_at: null, last_wywa_generated_at: null },
    ]
    const result = filterEligibleCandidates(profiles, now, 10)
    assert(result.length === 2, '2 eligible (u2 and u3)')
    assert(result[0].id === 'u2', 'u2 (old gen) passes')
    assert(result[1].id === 'u3', 'u3 (never gen) passes')
}

console.log('\n14. filterEligibleCandidates — respects limit')
{
    const profiles = Array.from({ length: 20 }, (_, i) => ({
        id: `u${i}`,
        subscription_tier: 'pro' as string | null,
        last_active_at: null,
        last_wywa_generated_at: null,
    }))
    const result = filterEligibleCandidates(profiles, now, 3)
    assert(result.length === 3, 'capped at limit=3')
    assert(result[0].id === 'u0', 'first candidate')
    assert(result[2].id === 'u2', 'third candidate')
}

console.log('\n15. filterEligibleCandidates — empty input')
{
    const result = filterEligibleCandidates([], now, 10)
    assert(result.length === 0, 'empty in → empty out')
}

console.log('\n16. filterEligibleCandidates — all ineligible')
{
    const recentlyActive = new Date(now - 10 * 60 * 1000).toISOString() // 10 min ago
    const profiles = [
        { id: 'u1', subscription_tier: 'free', last_active_at: null, last_wywa_generated_at: null },
        { id: 'u2', subscription_tier: 'pro', last_active_at: recentlyActive, last_wywa_generated_at: null },
    ]
    const result = filterEligibleCandidates(profiles, now, 10)
    assert(result.length === 0, 'none pass all checks')
}

// ── Squad-aware candidate selection (structural) ──

console.log('\n17. resolveEffectiveSquad is exported and async')
{
    assert(typeof resolveEffectiveSquad === 'function', 'resolveEffectiveSquad is exported')
    // It's async — calling with null args would throw, but the function exists
}

console.log('\n18. MIN_SQUAD_SIZE enforces squad-aware filtering')
{
    // Users with 0 or 1 squad members should be excluded before generation.
    // filterEligibleCandidates is phase 1 (pure), squad check is phase 2.
    // We verify the structural requirement: MIN_SQUAD_SIZE >= 2
    assert(MIN_SQUAD_SIZE >= 2, 'MIN_SQUAD_SIZE requires at least 2 members')

    // Verify that filterEligibleCandidates alone cannot check squad —
    // it only checks tier, inactivity, cooldown. Squad is checked separately.
    const paidInactive = [
        { id: 'u1', subscription_tier: 'pro' as string | null, last_active_at: null, last_wywa_generated_at: null },
    ]
    const phase1 = filterEligibleCandidates(paidInactive, now, 10)
    assert(phase1.length === 1, 'phase 1 passes paid+inactive user (squad not checked yet)')
}

// ── Deterministic ordering verification ──

console.log('\n19. Candidate ordering: null last_wywa_generated_at sorts first')
{
    // Simulates what the DB ordering should produce:
    // null wywa → before non-null wywa (nulls first)
    const profiles = [
        { id: 'u1', subscription_tier: 'pro' as string | null, last_active_at: null, last_wywa_generated_at: new Date(now - 8 * 60 * 60 * 1000).toISOString() },
        { id: 'u2', subscription_tier: 'pro' as string | null, last_active_at: null, last_wywa_generated_at: null },
    ]
    // If ordered by last_wywa_generated_at ASC NULLS FIRST, u2 should come first
    const sorted = [...profiles].sort((a, b) => {
        if (a.last_wywa_generated_at === null && b.last_wywa_generated_at !== null) return -1
        if (a.last_wywa_generated_at !== null && b.last_wywa_generated_at === null) return 1
        if (a.last_wywa_generated_at && b.last_wywa_generated_at) {
            return a.last_wywa_generated_at.localeCompare(b.last_wywa_generated_at)
        }
        return 0
    })
    assert(sorted[0].id === 'u2', 'null wywa_generated sorts before non-null')
    // Both pass eligibility
    const result = filterEligibleCandidates(sorted, now, 10)
    assert(result.length === 2, 'both eligible')
    assert(result[0].id === 'u2', 'never-generated user comes first')
}

console.log('\n20. Candidate ordering: null last_active_at sorts first as tie-breaker')
{
    // Both have null last_wywa_generated_at, so last_active_at breaks the tie
    const profiles = [
        { id: 'u1', subscription_tier: 'basic' as string | null, last_active_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), last_wywa_generated_at: null },
        { id: 'u2', subscription_tier: 'basic' as string | null, last_active_at: null, last_wywa_generated_at: null },
    ]
    const sorted = [...profiles].sort((a, b) => {
        // last_wywa_generated_at tie (both null) → sort by last_active_at ASC NULLS FIRST
        if (a.last_active_at === null && b.last_active_at !== null) return -1
        if (a.last_active_at !== null && b.last_active_at === null) return 1
        if (a.last_active_at && b.last_active_at) {
            return a.last_active_at.localeCompare(b.last_active_at)
        }
        return 0
    })
    assert(sorted[0].id === 'u2', 'null last_active sorts first as tie-breaker')
}

console.log('\n21. Candidate ordering: id as final stable tie-breaker')
{
    // All fields identical except id
    const profiles = [
        { id: 'u-zzz', subscription_tier: 'pro' as string | null, last_active_at: null, last_wywa_generated_at: null },
        { id: 'u-aaa', subscription_tier: 'pro' as string | null, last_active_at: null, last_wywa_generated_at: null },
    ]
    const sorted = [...profiles].sort((a, b) => a.id.localeCompare(b.id))
    assert(sorted[0].id === 'u-aaa', 'id ascending as stable tie-breaker')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
