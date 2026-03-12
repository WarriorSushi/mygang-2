import { buildTimeoutFallbackTurn, shouldUseFastTimeoutFallback } from '../src/lib/ai/timeout-fallback'

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

console.log('\n1. Fast timeout fallback detection matches live directive turns')
assert(
    shouldUseFastTimeoutFallback('Give me one single action I should do in the next five minutes. No intro, no list.'),
    'detects direct one-action prompt'
)
assert(
    shouldUseFastTimeoutFallback('No, make it one concrete action only. No intro, no empathy preamble, no multiple suggestions.'),
    'detects correction-turn concrete-action prompt'
)

console.log('\n2. Timeout fallback prefers a concrete advice voice when available')
const directiveFallback = buildTimeoutFallbackTurn(
    'No, make it one concrete action only. No intro, no multiple suggestions.',
    ['kael', 'nyx', 'vee', 'cleo']
)
assert(directiveFallback.responders[0] === 'vee', 'chooses vee for concrete action fallback')
assert(directiveFallback.events.length === 1, 'produces exactly one message event')
assert(!/\n/.test(directiveFallback.events[0].content), 'keeps fallback to a single bubble')

console.log('\n3. Timeout fallback stays concrete for overwhelmed prompts')
const overwhelmedFallback = buildTimeoutFallbackTurn(
    'Give me one concrete step for tonight if I feel overwhelmed. No intro, no meta, just practical advice.',
    ['kael', 'nyx', 'vee', 'cleo']
)
assert(/five-minute timer|next smallest task/i.test(overwhelmedFallback.events[0].content), 'returns a specific concrete action')
assert(!/sorry|as an ai|meta/i.test(overwhelmedFallback.events[0].content), 'avoids meta fallback language')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
