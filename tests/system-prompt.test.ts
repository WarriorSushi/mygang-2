/**
 * System prompt regression tests for Phase 03.
 * Verifies the modular builder produces correct output for representative scenarios.
 * Run: pnpm exec npx tsx tests/system-prompt.test.ts
 */
import { buildSystemPrompt, type BuildSystemPromptInput } from '../src/lib/ai/system-prompt'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  PASS: ${label}`)
        passed++
    } else {
        console.log(`  FAIL: ${label}`)
        failed++
    }
}

function assertContains(prompt: string, text: string, label: string) {
    assert(prompt.includes(text), `${label} — contains "${text.slice(0, 60)}"`)
}

function assertNotContains(prompt: string, text: string, label: string) {
    assert(!prompt.includes(text), `${label} — does NOT contain "${text.slice(0, 60)}"`)
}

// Base context factory — override per scenario
function makeCtx(overrides: Partial<BuildSystemPromptInput> = {}): BuildSystemPromptInput {
    return {
        userName: 'TestUser',
        userNickname: null,
        characterContext: 'kael|Kael|M|The Influencer|Confident\nnyx|Nyx|F|The Hacker|Dry deadpan',
        activeIds: ['kael', 'nyx'],
        customNamesDirective: '',
        memorySnapshot: 'No memory snapshot available.',
        greetingOnly: false,
        autonomousIdle: false,
        allowMemoryUpdates: false,
        shouldUpdateSummary: false,
        safetyDirective: 'SAFETY FLAG: NO.',
        chatMode: 'ecosystem',
        lowCostMode: false,
        purchaseCelebration: null,
        allowedStatusList: '- "vibing"\n- "thinking"',
        silentTurns: 0,
        maxResponders: 4,
        isInactive: false,
        farewellTurn: false,
        openFloorRequested: false,
        ...overrides,
    }
}

console.log('=== System Prompt Regression Tests ===\n')

// -------------------------------------------------------
// Scenario 1: Free tier + greeting-only + no memory snapshot
// -------------------------------------------------------
console.log('1. Free tier + greeting-only + no memory snapshot')
{
    const ctx = makeCtx({
        greetingOnly: true,
        memorySnapshot: 'No memory snapshot available.',
        allowMemoryUpdates: false,
        shouldUpdateSummary: false,
    })
    const prompt = buildSystemPrompt(ctx)

    assertContains(prompt, 'You are the hidden "Director"', 'identity block')
    assertContains(prompt, 'User: TestUser', 'user block')
    assertContains(prompt, 'SQUAD (id|name|gender|role|voice)', 'squad header')
    assertContains(prompt, 'kael|Kael|M|The Influencer', 'character context passed through')
    assertNotContains(prompt, '== MEMORY SNAPSHOT ==', 'no memory snapshot when greeting-only')
    assertContains(prompt, 'Updates disabled this turn', 'memory updates disabled')
    assertContains(prompt, 'CORE RULES:', 'core rules present')
    assertContains(prompt, 'FLOW FLAGS:', 'flow flags present')
    assertContains(prompt, 'SAFETY FLAG: NO.', 'safety directive present')
}

// -------------------------------------------------------
// Scenario 2: Basic tier + ecosystem + memory snapshot
// -------------------------------------------------------
console.log('\n2. Basic tier + ecosystem + memory snapshot')
{
    const fakeSnapshot = '== MEMORY SNAPSHOT ==\nUser likes purple.\nUser builds fitness apps.'
    const ctx = makeCtx({
        memorySnapshot: fakeSnapshot,
        allowMemoryUpdates: true,
        shouldUpdateSummary: true,
        chatMode: 'ecosystem',
    })
    const prompt = buildSystemPrompt(ctx)

    assertContains(prompt, fakeSnapshot, 'memory snapshot injected')
    assertContains(prompt, 'MEMORY_UPDATE_ALLOWED: YES', 'memory updates enabled')
    assertContains(prompt, 'SUMMARY_UPDATE_ALLOWED: YES', 'summary updates enabled')
    assertContains(prompt, 'MEMORY EXTRACTION RULES (CRITICAL)', 'extraction rules present')
    assertContains(prompt, 'Ecosystem: natural group banter', 'ecosystem mode')
    assertNotContains(prompt, 'Gang Focus:', 'not gang focus')
}

// -------------------------------------------------------
// Scenario 3: Pro tier + low-cost mode
// -------------------------------------------------------
console.log('\n3. Pro tier + low-cost mode')
{
    const ctx = makeCtx({
        lowCostMode: true,
        chatMode: 'gang_focus',
    })
    const prompt = buildSystemPrompt(ctx)

    assertContains(prompt, 'LOW_COST_MODE: YES', 'low-cost mode flag')
    assertContains(prompt, 'Gang Focus: user-focused only', 'gang focus mode')
    assertContains(prompt, 'MODE: GANG_FOCUS', 'mode header')
    assertContains(prompt, 'should_continue should be FALSE', 'continuation suppressed')
}

// -------------------------------------------------------
// Scenario 4: Purchase celebration
// -------------------------------------------------------
console.log('\n4. Purchase celebration')
{
    const ctx = makeCtx({
        purchaseCelebration: 'pro',
    })
    const prompt = buildSystemPrompt(ctx)

    assertContains(prompt, 'SPECIAL EVENT — PURCHASE CELEBRATION', 'celebration block present')
    assertContains(prompt, 'upgraded to the PRO plan', 'plan name')
    assertContains(prompt, 'joining Pro', 'tier label')
    assertContains(prompt, 'FIRST thing the gang should address', 'priority instruction')
}

// Also test basic tier celebration
{
    const ctx = makeCtx({ purchaseCelebration: 'basic' })
    const prompt = buildSystemPrompt(ctx)
    assertContains(prompt, 'upgraded to the BASIC plan', 'basic plan name')
    assertContains(prompt, 'joining Basic', 'basic tier label')
}

// No celebration
{
    const ctx = makeCtx({ purchaseCelebration: null })
    const prompt = buildSystemPrompt(ctx)
    assertNotContains(prompt, 'PURCHASE CELEBRATION', 'no celebration when null')
}

// -------------------------------------------------------
// Scenario 5: Idle-autonomous turn
// -------------------------------------------------------
console.log('\n5. Idle-autonomous turn')
{
    const ctx = makeCtx({
        autonomousIdle: true,
        memorySnapshot: '== MEMORY SNAPSHOT ==\nSome data',
    })
    const prompt = buildSystemPrompt(ctx)

    assertContains(prompt, 'IDLE_AUTONOMOUS: YES', 'idle flag set')
    assertNotContains(prompt, '== MEMORY SNAPSHOT ==', 'no memory snapshot when autonomous idle')
    assertContains(prompt, 'keep short (1-3 messages)', 'idle length instruction')
}

// -------------------------------------------------------
// Scenario 6: Custom names active
// -------------------------------------------------------
console.log('\n6. Custom names active')
{
    const customDirective = `\nCUSTOM NAMES (user renamed these characters — ALWAYS use the custom name, NEVER the original):
- "kael" is called "Kale" (not "Kael"). Refer to yourself and each other using ONLY the custom name.\n`
    const ctx = makeCtx({
        customNamesDirective: customDirective,
    })
    const prompt = buildSystemPrompt(ctx)

    assertContains(prompt, 'CUSTOM NAMES', 'custom names block present')
    assertContains(prompt, '"kael" is called "Kale"', 'custom name directive')
}

// -------------------------------------------------------
// Scenario 7: All structural blocks present
// -------------------------------------------------------
console.log('\n7. Structural completeness check')
{
    const ctx = makeCtx({
        userNickname: 'Testy',
        memorySnapshot: '== MEMORY SNAPSHOT ==\ndata here',
        allowMemoryUpdates: true,
        shouldUpdateSummary: true,
        purchaseCelebration: 'pro',
    })
    const prompt = buildSystemPrompt(ctx)

    const requiredSections = [
        'IDENTITY:',
        'USER:',
        'CONVERSATION FORMAT:',
        'SQUAD (id|name|gender|role|voice)',
        'TYPING STYLE',
        'CHARACTER DEPTH',
        'SQUAD DYNAMICS:',
        'DEPTH MOMENT:',
        'SAFETY:',
        'MODE:',
        'LOW_COST_MODE:',
        'CORE RULES:',
        'MEMORY/RELATIONSHIP:',
        'PLANNING:',
        'FLOW FLAGS:',
        'SPECIAL EVENT',
    ]
    for (const section of requiredSections) {
        assertContains(prompt, section, `has section: ${section}`)
    }
    assertContains(prompt, '(called "Testy")', 'nickname rendered')
}

// -------------------------------------------------------
// Scenario 8: Memory updates disabled but summary enabled
// -------------------------------------------------------
console.log('\n8. Memory disabled, summary enabled')
{
    const ctx = makeCtx({
        allowMemoryUpdates: false,
        shouldUpdateSummary: true,
    })
    const prompt = buildSystemPrompt(ctx)

    assertContains(prompt, 'MEMORY_UPDATE_ALLOWED: NO', 'memory updates no')
    assertContains(prompt, 'SUMMARY_UPDATE_ALLOWED: YES', 'summary updates yes')
    assertNotContains(prompt, 'MEMORY EXTRACTION RULES', 'no extraction rules when memory disabled')
}

// -------------------------------------------------------
// Scenario 9: Safety flag soft
// -------------------------------------------------------
console.log('\n9. Safety flag active')
{
    const ctx = makeCtx({
        safetyDirective: 'SAFETY FLAG: YES. Respond with empathy and support. Avoid harmful instructions or graphic details.',
    })
    const prompt = buildSystemPrompt(ctx)
    assertContains(prompt, 'SAFETY FLAG: YES', 'safety flag yes')
    assertContains(prompt, 'empathy and support', 'empathy instruction')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
