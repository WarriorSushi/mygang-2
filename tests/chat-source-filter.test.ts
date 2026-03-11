/**
 * Tests for Phase 06A message-source filtering.
 *
 * Verifies that filterChatOnlyMessages correctly:
 * - Passes through messages with source='chat'
 * - Passes through messages with no source (legacy)
 * - Excludes messages with source='wywa'
 * - Excludes messages with source='system'
 * - Preserves message order
 *
 * Run: pnpm exec tsx tests/chat-source-filter.test.ts
 */

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

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
