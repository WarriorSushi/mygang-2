/**
 * Tests for Phase 06B source-aware history reconciliation.
 *
 * Proves:
 * - Same speaker/content with different source do NOT collapse
 * - Legacy (no source) + 'chat' still reconcile correctly
 * - Order preservation holds with mixed sources
 * - normalizeSource defaults to 'chat'
 *
 * Run: pnpm exec tsx tests/chat-history-source.test.ts
 */

import { collapseLikelyDuplicateMessages, normalizeSource } from '../src/hooks/use-chat-history'
import type { Message } from '../src/stores/chat-store'

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

const ts = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

function makeMsg(overrides: Partial<Message> & { id: string; speaker: string }): Message {
    return {
        content: 'hello',
        created_at: ts(0),
        ...overrides,
    }
}

// ── normalizeSource ──

console.log('\n1. normalizeSource')
assert(normalizeSource('chat') === 'chat', 'chat stays chat')
assert(normalizeSource('wywa') === 'wywa', 'wywa stays wywa')
assert(normalizeSource('system') === 'system', 'system stays system')
assert(normalizeSource(undefined) === 'chat', 'undefined defaults to chat')
assert(normalizeSource('') === 'chat', 'empty string defaults to chat')

// ── Collapse: different source prevents collapse ──

console.log('\n2. Same speaker+content, different source — should NOT collapse')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'hey', source: 'chat', created_at: ts(0) }),
        makeMsg({ id: '2', speaker: 'kael', content: 'hey', source: 'wywa', created_at: ts(1000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 2, 'both messages kept — different source')
    assert(result[0].id === '1', 'first is chat')
    assert(result[1].id === '2', 'second is wywa')
}

console.log('\n3. Same speaker+content+source — should collapse (normal dedupe)')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'hey', source: 'chat', created_at: ts(0) }),
        makeMsg({ id: '2', speaker: 'kael', content: 'hey', source: 'chat', created_at: ts(1000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 1, 'collapsed to 1 — same source')
}

console.log('\n4. Legacy (no source) + chat — should collapse (treated as same)')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'luna', content: 'hi there', created_at: ts(0) }),
        makeMsg({ id: '2', speaker: 'luna', content: 'hi there', source: 'chat', created_at: ts(1000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 1, 'collapsed — legacy treated as chat')
}

console.log('\n5. Legacy (no source) + wywa — should NOT collapse')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'luna', content: 'hi there', created_at: ts(0) }),
        makeMsg({ id: '2', speaker: 'luna', content: 'hi there', source: 'wywa', created_at: ts(1000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 2, 'both kept — legacy vs wywa')
}

// ── Order preservation ──

console.log('\n6. Order preserved with mixed sources')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'user', content: 'yo', source: 'chat', created_at: ts(0) }),
        makeMsg({ id: '2', speaker: 'kael', content: 'sup', source: 'chat', created_at: ts(1000) }),
        makeMsg({ id: '3', speaker: 'kael', content: 'been chatting', source: 'wywa', created_at: ts(2000) }),
        makeMsg({ id: '4', speaker: 'luna', content: 'same', source: 'wywa', created_at: ts(3000) }),
        makeMsg({ id: '5', speaker: 'user', content: 'back!', source: 'chat', created_at: ts(4000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 5, 'all 5 kept — different speakers/sources')
    assert(result[0].id === '1', 'order 1')
    assert(result[1].id === '2', 'order 2')
    assert(result[2].id === '3', 'order 3')
    assert(result[3].id === '4', 'order 4')
    assert(result[4].id === '5', 'order 5')
}

// ── User messages never collapse (existing behavior preserved) ──

console.log('\n7. User messages never collapse even with same source')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'user', content: 'test', source: 'chat', created_at: ts(0) }),
        makeMsg({ id: '2', speaker: 'user', content: 'test', source: 'chat', created_at: ts(1000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 2, 'user messages never collapse')
}

// ── WYWA batch stays intact ──

console.log('\n8. Contiguous WYWA batch does not merge with surrounding chat')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'later', source: 'chat', created_at: ts(0) }),
        makeMsg({ id: '2', speaker: 'kael', content: 'later', source: 'wywa', created_at: ts(1000) }),
        makeMsg({ id: '3', speaker: 'luna', content: 'yep', source: 'wywa', created_at: ts(2000) }),
        makeMsg({ id: '4', speaker: 'kael', content: 'later', source: 'chat', created_at: ts(3000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 4, 'all 4 kept — source boundaries prevent collapse')
}

// ── ID-based dedupe still works ──

console.log('\n9. Same ID still deduped regardless of source')
{
    const msgs: Message[] = [
        makeMsg({ id: 'same-id', speaker: 'kael', content: 'hey', source: 'chat', created_at: ts(0) }),
        makeMsg({ id: 'same-id', speaker: 'kael', content: 'hey', source: 'wywa', created_at: ts(1000) }),
    ]
    const result = collapseLikelyDuplicateMessages(msgs)
    assert(result.length === 1, 'same ID deduped')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
