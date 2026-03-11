/**
 * Tests for Phase 07A tab-presence pure helpers.
 *
 * Proves:
 * - countUnseenMessages: counts only non-user messages after cutoff
 * - countUnseenMessages: stops counting at first message before cutoff
 * - countUnseenMessages: handles empty messages
 * - countUnseenMessages: WYWA messages count as unseen
 * - countUnseenMessages: user messages are skipped
 * - buildPresenceTitle: returns base title for 0 unread
 * - buildPresenceTitle: formats count correctly
 *
 * Run: pnpm exec tsx tests/tab-presence.test.ts
 */

import { countUnseenMessages, buildPresenceTitle } from '../src/hooks/use-tab-presence'
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

function makeMsg(overrides: Partial<Message> & { id: string; speaker: string; created_at: string }): Message {
    return {
        content: 'hello',
        ...overrides,
    }
}

const now = Date.now()
const ts = (offsetMs: number) => new Date(now + offsetMs).toISOString()

// ── countUnseenMessages ──

console.log('\n1. countUnseenMessages — basic counting')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'hey', created_at: ts(-5000) }),
        makeMsg({ id: '2', speaker: 'luna', content: 'sup', created_at: ts(-3000) }),
        makeMsg({ id: '3', speaker: 'kael', content: 'what up', created_at: ts(1000) }),
        makeMsg({ id: '4', speaker: 'luna', content: 'yo', created_at: ts(2000) }),
    ]
    // Cutoff at now — messages 3 and 4 are after cutoff
    const count = countUnseenMessages(msgs, now)
    assert(count === 2, 'counts 2 messages after cutoff')
}

console.log('\n2. countUnseenMessages — stops at cutoff boundary')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'old', created_at: ts(-10000) }),
        makeMsg({ id: '2', speaker: 'luna', content: 'also old', created_at: ts(-5000) }),
        makeMsg({ id: '3', speaker: 'kael', content: 'new', created_at: ts(1000) }),
    ]
    const count = countUnseenMessages(msgs, now)
    assert(count === 1, 'counts only 1 message after cutoff')
}

console.log('\n3. countUnseenMessages — empty messages')
{
    const count = countUnseenMessages([], now)
    assert(count === 0, 'empty array returns 0')
}

console.log('\n4. countUnseenMessages — all messages before cutoff')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'hey', created_at: ts(-5000) }),
        makeMsg({ id: '2', speaker: 'luna', content: 'sup', created_at: ts(-3000) }),
    ]
    const count = countUnseenMessages(msgs, now)
    assert(count === 0, 'no unseen when all before cutoff')
}

console.log('\n5. countUnseenMessages — user messages skipped')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'hey', created_at: ts(-5000) }),
        makeMsg({ id: '2', speaker: 'user', content: 'my msg', created_at: ts(1000) }),
        makeMsg({ id: '3', speaker: 'luna', content: 'reply', created_at: ts(2000) }),
    ]
    const count = countUnseenMessages(msgs, now)
    assert(count === 1, 'user message not counted, only luna reply counted')
}

console.log('\n6. countUnseenMessages — WYWA messages count')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'old chat', source: 'chat', created_at: ts(-5000) }),
        makeMsg({ id: '2', speaker: 'kael', content: 'wywa msg', source: 'wywa', created_at: ts(1000) }),
        makeMsg({ id: '3', speaker: 'luna', content: 'wywa reply', source: 'wywa', created_at: ts(2000) }),
    ]
    const count = countUnseenMessages(msgs, now)
    assert(count === 2, 'WYWA messages are counted as unseen')
}

console.log('\n7. countUnseenMessages — stops at first old non-user message (reverse scan)')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'old', created_at: ts(-10000) }),
        makeMsg({ id: '2', speaker: 'user', content: 'user typed', created_at: ts(500) }),
        makeMsg({ id: '3', speaker: 'luna', content: 'new', created_at: ts(1000) }),
        makeMsg({ id: '4', speaker: 'kael', content: 'newest', created_at: ts(2000) }),
    ]
    const count = countUnseenMessages(msgs, now)
    assert(count === 2, 'counts luna and kael, skips user, stops at old kael')
}

console.log('\n8. countUnseenMessages — only user messages after cutoff')
{
    const msgs: Message[] = [
        makeMsg({ id: '1', speaker: 'kael', content: 'old', created_at: ts(-5000) }),
        makeMsg({ id: '2', speaker: 'user', content: 'hi', created_at: ts(1000) }),
        makeMsg({ id: '3', speaker: 'user', content: 'hello', created_at: ts(2000) }),
    ]
    const count = countUnseenMessages(msgs, now)
    // User messages are skipped, then we hit the old kael message and break
    assert(count === 0, '0 unseen when only user messages are new')
}

// ── buildPresenceTitle ──

console.log('\n9. buildPresenceTitle — zero unread')
{
    const title = buildPresenceTitle(0)
    assert(title === 'MyGang.ai', 'returns base title for 0')
}

console.log('\n10. buildPresenceTitle — negative unread')
{
    const title = buildPresenceTitle(-1)
    assert(title === 'MyGang.ai', 'returns base title for negative')
}

console.log('\n11. buildPresenceTitle — positive unread')
{
    const title = buildPresenceTitle(3)
    assert(title === '(3) MyGang.ai', 'formats (3) MyGang.ai')
}

console.log('\n12. buildPresenceTitle — large count')
{
    const title = buildPresenceTitle(42)
    assert(title === '(42) MyGang.ai', 'formats (42) MyGang.ai')
}

console.log('\n13. buildPresenceTitle — single message')
{
    const title = buildPresenceTitle(1)
    assert(title === '(1) MyGang.ai', 'formats (1) MyGang.ai')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
