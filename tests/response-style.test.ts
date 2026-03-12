import { isCorrectionOrClarificationTurn, shouldPreserveSingleBubbleTurn } from '../src/lib/ai/response-style'

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

console.log('\n1. Correction turns are preserved as a single coherent reply')
assert(
    isCorrectionOrClarificationTurn('did you read what i just said about the deadline?'),
    'detects correction turn'
)

console.log('\n2. Clarification turns are preserved as a single coherent reply')
assert(
    isCorrectionOrClarificationTurn("that's not what i said, let me be clear"),
    'detects clarification turn'
)

console.log('\n3. Long serious replies also preserve a single bubble')
assert(
    shouldPreserveSingleBubbleTurn('can you walk me through this breakup without sugarcoating it?', {
        allowLongReplies: true,
        farewellTurn: false,
    }),
    'allowLongReplies keeps coherence'
)

console.log('\n4. Casual short banter can still split for style')
assert(
    !shouldPreserveSingleBubbleTurn('lol thats wild', {
        allowLongReplies: false,
        farewellTurn: false,
    }),
    'casual short turn does not force coherence mode'
)

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
