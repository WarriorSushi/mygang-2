import { formatHistoryForLLM } from '../src/lib/ai/history-format'

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

console.log('\n1. Reply preview is included when target exists in the history slice')
{
    const history = formatHistoryForLLM([
        {
            id: 'msg-1',
            speaker: 'user',
            content: 'Can we tighten the launch checklist before Friday?',
        },
        {
            id: 'msg-2',
            speaker: 'atlas',
            content: 'yeah, lets lock the blockers first',
            replyToId: 'msg-1',
        },
    ], 1000)

    assert(
        history.includes('[msg-2] atlas: yeah, lets lock the blockers first |>msg-1("Can we tighten the launch checklist before Friday?")'),
        'reply preview appended to reply target'
    )
}

console.log('\n2. Reply preview is omitted when the target is outside the slice')
{
    const history = formatHistoryForLLM([
        {
            id: 'msg-2',
            speaker: 'atlas',
            content: 'still replying anyway',
            replyToId: 'msg-1',
        },
    ], 1000)

    assert(history.includes('|>msg-1'), 'reply id is still preserved')
    assert(!history.includes('|>msg-1("'), 'missing target does not invent a quoted preview')
}

console.log('\n3. Reply preview is sanitized for prompt-safe quoting')
{
    const history = formatHistoryForLLM([
        {
            id: 'msg-1',
            speaker: 'user',
            content: 'he said "go |> now"\nseriously',
        },
        {
            id: 'msg-2',
            speaker: 'nyx',
            content: 'ok, noted',
            replyToId: 'msg-1',
        },
    ], 1000)

    assert(
        history.includes('|>msg-1("he said \'go |\\> now\' seriously")'),
        'reply preview escapes structural markers and quote wrappers'
    )
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
