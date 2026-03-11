/**
 * Character recommendation engine tests.
 * Tests the pure recommendCharacters function.
 *
 * Run: pnpm exec tsx tests/character-recommendation.test.ts
 */
import { recommendCharacters } from '../src/lib/ai/character-recommendation'
import type { VibeProfile } from '../src/lib/ai/character-recommendation'

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

console.log('=== Character Recommendation Tests ===\n')

// -------------------------------------------------------
// 1. Hype intent recommends hype characters
// -------------------------------------------------------
console.log('1. Hype intent')
{
    const result = recommendCharacters({ primary_intent: 'hype', warmth_style: 'balanced', chaos_level: 'lively' })
    assert(result.length > 0, 'returns non-empty array')
    assert(result[0] === 'kael' || result[0] === 'dash', `top pick is kael or dash (got ${result[0]})`)
    assert(result.includes('kael'), 'includes kael')
    assert(result.includes('dash'), 'includes dash')
}

// -------------------------------------------------------
// 2. Honest intent recommends support characters
// -------------------------------------------------------
console.log('\n2. Honest intent')
{
    const result = recommendCharacters({ primary_intent: 'honest', warmth_style: 'warm', chaos_level: 'calm' })
    assert(result[0] === 'sage' || result[0] === 'atlas', `top pick is sage or atlas (got ${result[0]})`)
    assert(result.includes('sage'), 'includes sage')
    assert(result.includes('zara'), 'includes zara')
}

// -------------------------------------------------------
// 3. Humor intent recommends chaos/funny characters
// -------------------------------------------------------
console.log('\n3. Humor intent')
{
    const result = recommendCharacters({ primary_intent: 'humor', warmth_style: 'edgy', chaos_level: 'chaotic' })
    assert(result[0] === 'rico', `top pick is rico (got ${result[0]})`)
    assert(result.includes('jinx'), 'includes jinx')
    assert(result.includes('nyx'), 'includes nyx')
}

// -------------------------------------------------------
// 4. Chill intent recommends chill characters
// -------------------------------------------------------
console.log('\n4. Chill intent')
{
    const result = recommendCharacters({ primary_intent: 'chill', warmth_style: 'warm', chaos_level: 'calm' })
    assert(result.includes('nova'), 'includes nova')
    assert(result.includes('luna'), 'includes luna')
    assert(result.includes('vee'), 'includes vee')
}

// -------------------------------------------------------
// 5. Results are deterministic
// -------------------------------------------------------
console.log('\n5. Deterministic')
{
    const vibe: VibeProfile = { primary_intent: 'humor', warmth_style: 'balanced', chaos_level: 'lively' }
    const r1 = recommendCharacters(vibe)
    const r2 = recommendCharacters(vibe)
    assert(JSON.stringify(r1) === JSON.stringify(r2), 'same input produces same output')
}

// -------------------------------------------------------
// 6. Warmth modulation works
// -------------------------------------------------------
console.log('\n6. Warmth modulation')
{
    const warm = recommendCharacters({ primary_intent: 'chill', warmth_style: 'warm', chaos_level: 'calm' })
    const edgy = recommendCharacters({ primary_intent: 'chill', warmth_style: 'edgy', chaos_level: 'calm' })
    // Same intent but different warmth should produce different rankings
    assert(JSON.stringify(warm) !== JSON.stringify(edgy), 'warm vs edgy produces different rankings')
}

// -------------------------------------------------------
// 7. All results are valid character IDs
// -------------------------------------------------------
console.log('\n7. Valid character IDs')
{
    const validIds = ['kael', 'nyx', 'atlas', 'luna', 'rico', 'vee', 'ezra', 'cleo', 'sage', 'miko', 'dash', 'zara', 'jinx', 'nova']
    const result = recommendCharacters({ primary_intent: 'hype', warmth_style: 'edgy', chaos_level: 'chaotic' })
    assert(result.every(id => validIds.includes(id)), 'all returned IDs are valid characters')
    assert(new Set(result).size === result.length, 'no duplicate IDs')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
