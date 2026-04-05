/**
 * Live chat context window tests.
 * Proves stale live-chat threads are dropped after a long gap even when WYWA rows exist.
 *
 * Run: pnpm exec tsx tests/live-chat-context.test.ts
 */

import { LIVE_CHAT_CONTEXT_RESET_MS, isChatSourceMessage, selectRecentLiveChatMessages } from '../src/lib/live-chat-context'

type Message = {
    id: string
    speaker: string
    content: string
    created_at: string
    source?: string
}

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  PASS: ${label}`)
        passed += 1
    } else {
        console.error(`  FAIL: ${label}`)
        failed += 1
    }
}

const base = Date.parse('2026-04-02T18:00:00.000Z')
const ts = (offsetMs: number) => new Date(base + offsetMs).toISOString()

function makeMessage(overrides: Partial<Message> & { id: string }): Message {
    return {
        speaker: 'user',
        content: 'hello',
        created_at: ts(0),
        ...overrides,
    }
}

console.log('\n1. Chat-source helper keeps chat and legacy messages only')
assert(isChatSourceMessage({ source: 'chat' }), 'chat source is included')
assert(isChatSourceMessage({ source: undefined }), 'legacy source is included')
assert(!isChatSourceMessage({ source: 'wywa' }), 'wywa source is excluded')

console.log('\n2. Recent contiguous chat segment survives when all messages are close together')
{
    const messages = [
        makeMessage({ id: '1', speaker: 'user', content: 'hey', source: 'chat', created_at: ts(-4_000) }),
        makeMessage({ id: '2', speaker: 'atlas', content: 'yo', source: 'chat', created_at: ts(-3_000) }),
        makeMessage({ id: '3', speaker: 'user', content: 'pizza?', source: 'chat', created_at: ts(-2_000) }),
    ]
    const result = selectRecentLiveChatMessages(messages, 10)
    assert(result.length === 3, 'all recent chat messages remain')
    assert(result[0].id === '1' && result[2].id === '3', 'order is preserved')
}

console.log('\n3. Ancient live-chat thread is dropped after a long gap')
{
    const messages = [
        makeMessage({ id: 'old-user', speaker: 'user', content: 'old business idea', source: 'chat', created_at: ts(-(LIVE_CHAT_CONTEXT_RESET_MS + 86_400_000)) }),
        makeMessage({ id: 'wywa-1', speaker: 'vee', content: 'away chatter', source: 'wywa', created_at: ts(-3_600_000) }),
        makeMessage({ id: 'new-user', speaker: 'user', content: 'how are you guys', source: 'chat', created_at: ts(-2_000) }),
    ]
    const result = selectRecentLiveChatMessages(messages, 10)
    assert(result.length === 1, 'only the fresh live-chat segment remains')
    assert(result[0].id === 'new-user', 'stale live-chat message is excluded')
}

console.log('\n4. Limit still applies inside the fresh segment')
{
    const messages = [
        makeMessage({ id: 'old-user', content: 'stale thread', source: 'chat', created_at: ts(-(LIVE_CHAT_CONTEXT_RESET_MS + 1_000)) }),
        makeMessage({ id: 'recent-1', content: 'a', source: 'chat', created_at: ts(-4_000) }),
        makeMessage({ id: 'recent-2', content: 'b', source: 'chat', created_at: ts(-3_000) }),
        makeMessage({ id: 'recent-3', content: 'c', source: 'chat', created_at: ts(-2_000) }),
    ]
    const result = selectRecentLiveChatMessages(messages, 2)
    assert(result.length === 2, 'window limit applies to the recent segment')
    assert(result[0].id === 'recent-2' && result[1].id === 'recent-3', 'keeps the newest messages inside the segment')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
