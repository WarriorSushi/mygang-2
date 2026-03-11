/**
 * Tests for push send pure helpers.
 *
 * Proves:
 * - isStaleStatus: 404 and 410 are stale
 * - isStaleStatus: other codes are not stale
 * - buildPushPayload: produces correct JSON shape
 * - buildPushPayload: output is valid JSON string
 *
 * Run: pnpm exec tsx tests/push-send.test.ts
 */

import { isStaleStatus, buildPushPayload } from '../src/lib/push/send'

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

// ── isStaleStatus ──

console.log('\n1. isStaleStatus — 404 is stale')
assert(isStaleStatus(404) === true, '404 returns true')

console.log('\n2. isStaleStatus — 410 is stale')
assert(isStaleStatus(410) === true, '410 returns true')

console.log('\n3. isStaleStatus — 200 is not stale')
assert(isStaleStatus(200) === false, '200 returns false')

console.log('\n4. isStaleStatus — 500 is not stale')
assert(isStaleStatus(500) === false, '500 returns false')

console.log('\n5. isStaleStatus — 403 is not stale')
assert(isStaleStatus(403) === false, '403 returns false')

console.log('\n6. isStaleStatus — 429 is not stale')
assert(isStaleStatus(429) === false, '429 returns false')

console.log('\n7. isStaleStatus — 0 is not stale')
assert(isStaleStatus(0) === false, '0 returns false')

// ── buildPushPayload ──

console.log('\n8. buildPushPayload — produces valid JSON')
{
    const payload = { title: 'MyGang', body: 'Test message', url: '/chat' }
    const result = buildPushPayload(payload)
    let parsed: Record<string, unknown> | null = null
    try {
        parsed = JSON.parse(result)
    } catch {
        // parsed stays null
    }
    assert(parsed !== null, 'output is valid JSON')
}

console.log('\n9. buildPushPayload — contains correct fields')
{
    const payload = { title: 'MyGang', body: 'Your gang started talking.', url: '/chat' }
    const result = buildPushPayload(payload)
    const parsed = JSON.parse(result)
    assert(parsed.title === 'MyGang', 'title matches')
    assert(parsed.body === 'Your gang started talking.', 'body matches')
    assert(parsed.url === '/chat', 'url matches')
}

console.log('\n10. buildPushPayload — no extra fields')
{
    const payload = { title: 'T', body: 'B', url: '/u' }
    const result = buildPushPayload(payload)
    const parsed = JSON.parse(result)
    const keys = Object.keys(parsed)
    assert(keys.length === 3, 'exactly 3 keys in output')
    assert(keys.includes('title') && keys.includes('body') && keys.includes('url'), 'only title/body/url')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
