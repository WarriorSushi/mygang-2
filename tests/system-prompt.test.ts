import { buildSystemPrompt, type BuildSystemPromptInput } from '../src/lib/ai/system-prompt'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  PASS: ${label}`)
        passed += 1
    } else {
        console.log(`  FAIL: ${label}`)
        failed += 1
    }
}

function assertContains(prompt: string, text: string, label: string) {
    assert(prompt.includes(text), `${label} — contains "${text.slice(0, 70)}"`)
}

function assertNotContains(prompt: string, text: string, label: string) {
    assert(!prompt.includes(text), `${label} — does NOT contain "${text.slice(0, 70)}"`)
}

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
        allowedStatusList: '- "is reading your message"\n- "saw your message"',
        silentTurns: 0,
        maxResponders: 2,
        isInactive: false,
        farewellTurn: false,
        openFloorRequested: false,
        vibeContext: null,
        ...overrides,
    }
}

console.log('=== System Prompt Regression Tests ===\n')

console.log('1. Baseline prompt contains the current humanized sections')
{
    const prompt = buildSystemPrompt(makeCtx({ greetingOnly: true }))
    assert(prompt.startsWith('You are the hidden "Director" of the MyGang group chat.'), 'starts with identity line')
    assertContains(prompt, 'TEXTING TENDENCIES', 'typing section label')
    assertContains(prompt, 'SUBTEXT', 'depth section label')
    assertContains(prompt, 'Default composition: one main responder', 'responder restraint rule')
    assertContains(prompt, 'Persona is a baseline, not a costume', 'anti-costume rule')
    assertContains(prompt, 'ANSWER FIRST', 'answer-first rule')
    assertContains(prompt, 'SMALL TALK', 'small-talk rule')
    assertContains(prompt, 'DIRECT INTROS', 'direct intros rule')
    assertContains(prompt, 'SELF-DISCLOSURE', 'self-disclosure rule')
    assertContains(prompt, 'ANTI-REPETITION', 'anti-repetition rule')
    assertContains(prompt, 'NO META-TALK', 'no-meta rule')
    assertContains(prompt, 'NO LOOPS', 'no-loops rule')
    assertContains(prompt, 'MEMORY/RELATIONSHIP: Updates disabled this turn.', 'memory disabled copy')
    assertNotContains(prompt, '== MEMORY SNAPSHOT ==', 'no snapshot in greeting-only baseline')
}

console.log('\n2. Memory-enabled prompt includes snapshot and extraction rules')
{
    const prompt = buildSystemPrompt(makeCtx({
        memorySnapshot: '== MEMORY SNAPSHOT ==\nUser likes purple.',
        allowMemoryUpdates: true,
        shouldUpdateSummary: true,
        userNickname: 'Testy',
    }))

    assertContains(prompt, '(called "Testy")', 'nickname interpolation')
    assertContains(prompt, '== MEMORY SNAPSHOT ==\nUser likes purple.', 'memory snapshot injected')
    assertContains(prompt, 'MEMORY_UPDATE_ALLOWED: YES', 'memory updates enabled')
    assertContains(prompt, 'SUMMARY_UPDATE_ALLOWED: YES', 'summary updates enabled')
    assertContains(prompt, 'MEMORY EXTRACTION RULES (CRITICAL)', 'memory extraction rules present')
    assertContains(prompt, 'inside_joke', 'inside joke category guidance')
    assertContains(prompt, 'QUALITY CHECK', 'memory quality gate')
}

console.log('\n3. Celebration and mode flags stay in the prompt')
{
    const prompt = buildSystemPrompt(makeCtx({
        chatMode: 'gang_focus',
        lowCostMode: true,
        purchaseCelebration: 'pro',
        maxResponders: 1,
    }))

    assertContains(prompt, 'MODE: GANG_FOCUS', 'gang focus mode')
    assertContains(prompt, 'LOW_COST_MODE: YES', 'low cost mode')
    assertContains(prompt, 'SPECIAL EVENT — PURCHASE CELEBRATION:', 'celebration block')
    assertContains(prompt, 'joining Pro', 'pro celebration wording')
    assertContains(prompt, 'MAX_RESPONDERS: 1', 'planning max responders')
}

console.log('\n4. Vibe context is optional but supported when present')
{
    const promptWithVibe = buildSystemPrompt(makeCtx({
        vibeContext: '- wants hype and encouragement\n- enjoys sarcastic unfiltered banter',
    }))
    const promptWithoutVibe = buildSystemPrompt(makeCtx())

    assertContains(promptWithVibe, 'USER VIBE PREFERENCES', 'vibe section header')
    assertContains(promptWithVibe, 'FIRST-LIVE-TURN', 'first live turn guidance')
    assertContains(promptWithVibe, 'Friendly beats impressive.', 'tentative user guidance')
    assertNotContains(promptWithoutVibe, 'USER VIBE PREFERENCES', 'vibe block omitted when absent')
}

console.log('\n5. Idle autonomous suppresses snapshot and keeps flags visible')
{
    const prompt = buildSystemPrompt(makeCtx({
        autonomousIdle: true,
        memorySnapshot: '== MEMORY SNAPSHOT ==\nShould not appear',
        openFloorRequested: true,
    }))

    assertContains(prompt, 'IDLE_AUTONOMOUS: YES', 'idle flag')
    assertContains(prompt, 'OPEN_FLOOR_REQUESTED: YES', 'open floor flag')
    assertContains(prompt, 'keep short (1-3 messages)', 'idle shortness instruction')
    assertNotContains(prompt, '== MEMORY SNAPSHOT ==', 'idle autonomous skips snapshot')
}

console.log('\n6. Custom names and safety directives are preserved')
{
    const prompt = buildSystemPrompt(makeCtx({
        customNamesDirective: '\nCUSTOM NAMES:\n- "kael" is called "Kale"\n',
        safetyDirective: 'SAFETY FLAG: YES. Respond with empathy.',
        farewellTurn: true,
        isInactive: true,
    }))

    assertContains(prompt, 'CUSTOM NAMES', 'custom names block')
    assertContains(prompt, '"kael" is called "Kale"', 'custom name detail')
    assertContains(prompt, 'SAFETY FLAG: YES. Respond with empathy.', 'safety directive')
    assertContains(prompt, 'FAREWELL_SIGNAL: YES', 'farewell flag')
    assertContains(prompt, 'INACTIVE_USER: YES', 'inactive flag')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
