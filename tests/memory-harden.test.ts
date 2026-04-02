/**
 * Memory hardening regression tests.
 * Run: pnpm exec tsx tests/memory-harden.test.ts
 */

import {
    buildLightMemorySnapshot,
    filterActiveMemories,
    getMemoryRecallLimit,
} from '../src/lib/ai/memory'
import {
    createMemoryMutationFailure,
    createMemoryMutationSuccess,
} from '../src/app/auth/actions'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  PASS: ${label}`)
        passed += 1
    } else {
        console.log(`  FAIL: ${label}`)
        failed += 1
    }
}

function assertContains(value: string, needle: string, label: string) {
    assert(value.includes(needle), `${label} — contains "${needle}"`)
}

console.log('=== Memory Hardening Tests ===\n')

console.log('1. Expired memories are filtered out consistently')
{
    const now = Date.parse('2026-04-02T12:00:00.000Z')
    const rows = [
        { id: 'active', content: 'still alive', expires_at: null },
        { id: 'future', content: 'still valid', expires_at: '2026-04-03T12:00:00.000Z' },
        { id: 'expired', content: 'should disappear', expires_at: '2026-04-01T12:00:00.000Z' },
    ]

    const active = filterActiveMemories(rows, now)
    assert(active.length === 2, 'only active/future memories remain')
    assert(active.some((row) => row.id === 'active'), 'permanent memory remains')
    assert(active.some((row) => row.id === 'future'), 'future-expiring memory remains')
    assert(!active.some((row) => row.id === 'expired'), 'expired memory is removed')
}

console.log('\n2. Free tier recall limit is tiny and paid tiers keep their prompt limit')
{
    assert(getMemoryRecallLimit('free') === 2, 'free tier recall limit is 2')
    assert(getMemoryRecallLimit('basic') === 3, 'basic tier uses its prompt limit')
    assert(getMemoryRecallLimit('pro') === 5, 'pro tier uses its prompt limit')
}

console.log('\n3. Light memory snapshot keeps only active memories')
{
    const snapshot = buildLightMemorySnapshot([
        { id: 'a', content: 'User loves pizza', category: 'preference', expires_at: null },
        { id: 'b', content: 'User felt stressed', category: 'mood', expires_at: '2026-04-01T12:00:00.000Z' },
    ])

    assertContains(snapshot, 'LIGHT RECALL', 'snapshot labels the lightweight recall mode')
    assertContains(snapshot, 'User loves pizza', 'active memory is included')
    assert(!snapshot.includes('User felt stressed'), 'expired memory is excluded from the snapshot')
}

console.log('\n4. Memory mutation helpers return typed success and failure results')
{
    const success = createMemoryMutationSuccess()
    const failure = createMemoryMutationFailure('rate_limited', 'Too many attempts. Please wait.')

    assert(success.ok === true, 'success result is ok')
    assert(failure.ok === false, 'failure result is not ok')
    if (!failure.ok) {
        assert(failure.errorCode === 'rate_limited', 'failure exposes a stable error code')
        assert(failure.message === 'Too many attempts. Please wait.', 'failure exposes the message')
    }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
