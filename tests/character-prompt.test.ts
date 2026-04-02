import { buildCharacterContextEntry, buildPersonaRegisterGuidance } from '../src/lib/ai/character-prompt'

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

console.log('\n1. Rich DB-backed character rows preserve voice nuance')
const richEntry = buildCharacterContextEntry({
    id: 'atlas',
    name: 'Atlas',
    archetype: 'The tactician',
    voice_description: 'Steady, plainspoken, practical, and calm.',
    typing_style: 'Short and useful. Never robotic.',
    sample_line: "let's keep this simple and move forward.",
    personality_prompt: 'He cares about the room and wants people to feel backed up.',
})
assert(richEntry.includes('Voice: "Steady, plainspoken, practical, and calm."'), 'uses rich voice field')
assert(richEntry.includes('Typing: "Short and useful. Never robotic."'), 'uses typing style field')
assert(richEntry.includes('Sample: "let\'s keep this simple and move forward."') || richEntry.includes('move forward'), 'uses sample line field')

console.log('\n2. Persona register guidance adapts to the turn intent')
const introRegisters = buildPersonaRegisterGuidance(['vee', 'atlas', 'sage'], 'intro_request')
assert(introRegisters.includes('TURN INTENT REGISTER: intro_request'), 'mentions intro request register')
assert(introRegisters.includes('Give concrete preferences, habits, and tiny stories instead of mission statements.'), 'intent guidance is specific')
assert(introRegisters.includes('vee: playful/casual'), 'includes active character defaults')

const repairRegisters = buildPersonaRegisterGuidance(['vee', 'atlas', 'sage'], 'confusion_repair')
assert(repairRegisters.includes('Drop the bit, rephrase simply'), 'repair intent guidance is direct')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
