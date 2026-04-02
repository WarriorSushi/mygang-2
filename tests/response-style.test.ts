import {
    classifyTurnIntent,
    enforceQuestionBudget,
    getTurnPolicy,
    isCorrectionOrClarificationTurn,
    shouldPreserveSingleBubbleTurn,
} from '../src/lib/ai/response-style'

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

console.log('\n5. Direct correction wording used in live signoff is detected')
assert(
    isCorrectionOrClarificationTurn('No, make it one concrete action only. No intro, no multiple suggestions.'),
    'detects concise correction request'
)

console.log('\n6. Turn intent classifier maps common user turns to balanced-human buckets')
assert(
    classifyTurnIntent('introduce yourselves', {
        farewellTurn: false,
        openFloorRequested: false,
        softSafetyFlag: false,
    }) === 'intro_request',
    'intro request bucket'
)
assert(
    classifyTurnIntent('?', {
        farewellTurn: false,
        openFloorRequested: false,
        softSafetyFlag: false,
    }) === 'confusion_repair',
    'confusion repair bucket'
)
assert(
    classifyTurnIntent('what are you guys up to', {
        farewellTurn: false,
        openFloorRequested: false,
        softSafetyFlag: false,
    }) === 'small_talk',
    'small talk bucket'
)
assert(
    classifyTurnIntent('i am overwhelmed and spiraling', {
        farewellTurn: false,
        openFloorRequested: false,
        softSafetyFlag: true,
    }) === 'vulnerable',
    'vulnerable bucket'
)

console.log('\n7. Question budget trims stacked questions without flattening the whole reply')
const budgeted = enforceQuestionBudget(
    [
        { type: 'message', content: 'what do you want to do?' },
        { type: 'message', content: 'and what kind of vibe should we bring?' },
        { type: 'message', content: 'cool.' },
    ],
    1
)
assert(budgeted[0].content === 'what do you want to do?', 'keeps the first question')
assert(budgeted[1].content === 'and what kind of vibe should we bring.', 'neutralizes later questions')
assert(getTurnPolicy('confusion_repair').questionBudget === 0, 'confusion repair gets zero question budget')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
