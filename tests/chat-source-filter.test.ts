/**
 * Tests for Phase 06A message-source filtering.
 *
 * Part 1: Server-side filterChatOnlyMessages (route.ts)
 * Part 2: Client-side isLiveChatMessage + payload window (use-chat-api.ts)
 *
 * Run: pnpm exec tsx tests/chat-source-filter.test.ts
 */

import { getPayloadWindowLimit, isLiveChatMessage } from '../src/hooks/use-chat-api'

type ChatMessageInput = {
    id: string
    speaker: string
    content: string
    created_at: string
    reaction?: string
    replyToId?: string
    source?: string
}

// Extracted filter logic matching route.ts
function filterChatOnlyMessages(messages: ChatMessageInput[]): ChatMessageInput[] {
    return messages.filter((m) => !m.source || m.source === 'chat')
}

// Simulates the client payload window construction
function buildPayloadWindow(messages: ChatMessageInput[], payloadLimit: number): ChatMessageInput[] {
    return messages
        .filter((m) => !(m.speaker === 'user' && (m as { deliveryStatus?: string }).deliveryStatus === 'failed'))
        .filter((m) => isLiveChatMessage(m))
        .slice(-payloadLimit)
}

// ── Test runner ──

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

function makeMsg(overrides: Partial<ChatMessageInput> & { id: string }): ChatMessageInput {
    return {
        speaker: 'user',
        content: 'hello',
        created_at: new Date().toISOString(),
        ...overrides,
    }
}

// ── Tests ──

console.log('\n1. Chat source messages pass through')
{
    const msgs = [makeMsg({ id: '1', source: 'chat' })]
    const result = filterChatOnlyMessages(msgs)
    assert(result.length === 1, 'chat source message included')
    assert(result[0].id === '1', 'correct message returned')
}

console.log('\n2. Legacy messages (no source) pass through')
{
    const msgs = [makeMsg({ id: '2' })]
    const result = filterChatOnlyMessages(msgs)
    assert(result.length === 1, 'legacy message included')
}

console.log('\n3. WYWA messages excluded')
{
    const msgs = [makeMsg({ id: '3', source: 'wywa' })]
    const result = filterChatOnlyMessages(msgs)
    assert(result.length === 0, 'wywa message excluded')
}

console.log('\n4. System messages excluded')
{
    const msgs = [makeMsg({ id: '4', source: 'system' })]
    const result = filterChatOnlyMessages(msgs)
    assert(result.length === 0, 'system message excluded')
}

console.log('\n5. Mixed sources — only chat and legacy pass')
{
    const msgs = [
        makeMsg({ id: 'a', source: 'chat' }),
        makeMsg({ id: 'b', source: 'wywa' }),
        makeMsg({ id: 'c' }),
        makeMsg({ id: 'd', source: 'system' }),
        makeMsg({ id: 'e', source: 'chat' }),
    ]
    const result = filterChatOnlyMessages(msgs)
    assert(result.length === 3, 'only 3 messages pass')
    assert(result[0].id === 'a', 'first is chat source')
    assert(result[1].id === 'c', 'second is legacy (no source)')
    assert(result[2].id === 'e', 'third is chat source')
}

console.log('\n6. Empty array returns empty')
{
    const result = filterChatOnlyMessages([])
    assert(result.length === 0, 'empty in, empty out')
}

console.log('\n7. Order preserved')
{
    const msgs = [
        makeMsg({ id: '1', source: 'chat', content: 'first' }),
        makeMsg({ id: '2', source: 'chat', content: 'second' }),
        makeMsg({ id: '3', source: 'chat', content: 'third' }),
    ]
    const result = filterChatOnlyMessages(msgs)
    assert(result[0].content === 'first', 'order preserved — first')
    assert(result[1].content === 'second', 'order preserved — second')
    assert(result[2].content === 'third', 'order preserved — third')
}

console.log('\n8. All WYWA returns empty')
{
    const msgs = [
        makeMsg({ id: '1', source: 'wywa' }),
        makeMsg({ id: '2', source: 'wywa' }),
    ]
    const result = filterChatOnlyMessages(msgs)
    assert(result.length === 0, 'all wywa excluded')
}

// ── Part 2: isLiveChatMessage + payload window ──

console.log('\n9. isLiveChatMessage — chat source')
assert(isLiveChatMessage({ source: 'chat' }) === true, 'chat is live')

console.log('\n10. isLiveChatMessage — no source (legacy)')
assert(isLiveChatMessage({}) === true, 'legacy is live')
assert(isLiveChatMessage({ source: undefined }) === true, 'undefined is live')

console.log('\n11. isLiveChatMessage — wywa/system excluded')
assert(isLiveChatMessage({ source: 'wywa' }) === false, 'wywa is not live')
assert(isLiveChatMessage({ source: 'system' }) === false, 'system is not live')

console.log('\n12. Payload window — trailing WYWA rows do not crowd out real chat')
{
    // 8 real chat messages, then 5 WYWA rows at the end
    const msgs: ChatMessageInput[] = []
    for (let i = 1; i <= 8; i++) {
        msgs.push(makeMsg({ id: `chat-${i}`, source: 'chat', content: `chat msg ${i}` }))
    }
    for (let i = 1; i <= 5; i++) {
        msgs.push(makeMsg({ id: `wywa-${i}`, source: 'wywa', content: `wywa msg ${i}` }))
    }
    const payload = buildPayloadWindow(msgs, 6)
    assert(payload.length === 6, 'payload has 6 messages')
    assert(payload.every(m => m.source === 'chat'), 'all payload messages are chat')
    assert(payload[0].id === 'chat-3', 'starts at chat-3 (last 6 of 8 chat msgs)')
    assert(payload[5].id === 'chat-8', 'ends at chat-8')
}

console.log('\n13. Payload window — legacy rows count as chat')
{
    const msgs: ChatMessageInput[] = [
        makeMsg({ id: 'legacy-1', content: 'old msg' }),
        makeMsg({ id: 'chat-1', source: 'chat', content: 'new msg' }),
        makeMsg({ id: 'wywa-1', source: 'wywa', content: 'away msg' }),
    ]
    const payload = buildPayloadWindow(msgs, 10)
    assert(payload.length === 2, 'only 2 messages in payload')
    assert(payload[0].id === 'legacy-1', 'legacy included')
    assert(payload[1].id === 'chat-1', 'chat included')
}

console.log('\n14. Payload window — order preserved with mixed sources')
{
    const msgs: ChatMessageInput[] = [
        makeMsg({ id: '1', source: 'chat', content: 'a' }),
        makeMsg({ id: '2', source: 'wywa', content: 'b' }),
        makeMsg({ id: '3', source: 'chat', content: 'c' }),
        makeMsg({ id: '4', source: 'system', content: 'd' }),
        makeMsg({ id: '5', source: 'chat', content: 'e' }),
    ]
    const payload = buildPayloadWindow(msgs, 10)
    assert(payload.length === 3, '3 chat messages')
    assert(payload[0].id === '1', 'first')
    assert(payload[1].id === '3', 'second')
    assert(payload[2].id === '5', 'third')
}

console.log('\n15. Payload window limit follows billing tier context')
assert(getPayloadWindowLimit('free', false) === 15, 'free tier uses 15-message context window')
assert(getPayloadWindowLimit('basic', false) === 25, 'basic tier uses 25-message context window')
assert(getPayloadWindowLimit('pro', false) === 35, 'pro tier uses 35-message context window')
assert(getPayloadWindowLimit(undefined, false) === 15, 'missing tier falls back to free window')

console.log('\n16. Low-cost mode overrides tier context window')
assert(getPayloadWindowLimit('pro', true) === 10, 'pro low-cost mode uses reduced 10-message window')
assert(getPayloadWindowLimit('basic', true) === 10, 'basic low-cost mode uses reduced 10-message window')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
