/**
 * Tests for VAPID base64url-to-Uint8Array helper.
 *
 * Proves:
 * - converts a known base64url string to correct bytes
 * - handles padding correctly for short strings
 * - replaces base64url chars (- _) with standard base64 chars (+ /)
 * - handles a realistic 65-byte VAPID public key
 * - returns empty Uint8Array for empty input
 *
 * Run: pnpm exec tsx tests/vapid.test.ts
 */

import { urlBase64ToUint8Array } from '../src/lib/push/vapid'

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

function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

// ── urlBase64ToUint8Array ──

console.log('\n1. converts a known base64url string to correct Uint8Array')
{
    // "AQAB" in base64url = bytes [1, 0, 1]
    const result = urlBase64ToUint8Array('AQAB')
    assert(result instanceof Uint8Array, 'returns Uint8Array instance')
    assert(arraysEqual(Array.from(result), [1, 0, 1]), 'AQAB decodes to [1, 0, 1]')
}

console.log('\n2. handles base64url padding correctly')
{
    // "AA" base64url = single byte 0x00
    const result = urlBase64ToUint8Array('AA')
    assert(arraysEqual(Array.from(result), [0]), 'AA decodes to [0]')
}

console.log('\n3. replaces - and _ with + and /')
{
    const resultUrl = urlBase64ToUint8Array('-_8')
    const resultStd = urlBase64ToUint8Array('+/8')
    assert(
        arraysEqual(Array.from(resultUrl), Array.from(resultStd)),
        'base64url chars produce same output as standard base64 chars'
    )
}

console.log('\n4. handles a 65-byte VAPID-like key')
{
    // Uncompressed P-256 point: 0x04 prefix + 32 bytes X + 32 bytes Y = 65 bytes = 88 base64url chars
    const fakeKey = 'BNkPbMRbftOaLq-4Sm8DWLGEHZOY90nP1dq06q8SyA0WuJQ-P4xW_YP-QTTtPt6WjEFCh_Ck0DPGzCT-7BIRj0A'
    const result = urlBase64ToUint8Array(fakeKey)
    assert(result instanceof Uint8Array, 'returns Uint8Array for VAPID key')
    assert(result.length === 65, 'VAPID key decodes to 65 bytes')
}

console.log('\n5. returns empty Uint8Array for empty string')
{
    const result = urlBase64ToUint8Array('')
    assert(result instanceof Uint8Array, 'returns Uint8Array for empty input')
    assert(result.length === 0, 'empty string decodes to 0 bytes')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
