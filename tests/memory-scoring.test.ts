/**
 * Memory scoring & retrieval helper tests for Phase 04A.
 * Tests the pure computeCompositeScore function and category priority behavior.
 *
 * Run: pnpm exec tsx tests/memory-scoring.test.ts
 */
import { computeCompositeScore, CATEGORY_PRIORITY } from '../src/lib/ai/memory'

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

function assertClose(actual: number, expected: number, epsilon: number, label: string) {
    assert(Math.abs(actual - expected) < epsilon, `${label} (got ${actual.toFixed(4)}, expected ~${expected.toFixed(4)})`)
}

console.log('=== Memory Scoring Tests ===\n')

// -------------------------------------------------------
// 1. Base formula preserved
// -------------------------------------------------------
console.log('1. Base formula with no category boost')
{
    const score = computeCompositeScore({
        similarity: 0.8,
        recency: 0.5,
        importance: 2,
        usageFrequency: 0.3,
        category: null,
    })
    // 0.5*0.8 + 0.2*0.5 + 0.15*(2/3) + 0.15*0.3 + 0 = 0.4 + 0.1 + 0.1 + 0.045 = 0.645
    assertClose(score, 0.645, 0.001, 'composite score without category')
}

// -------------------------------------------------------
// 2. Stable identity fact survives (gets category boost)
// -------------------------------------------------------
console.log('\n2. Identity fact gets category boost')
{
    const identityScore = computeCompositeScore({
        similarity: 0.7,
        recency: 0.3,
        importance: 2,
        usageFrequency: 0.2,
        category: 'identity',
    })
    const topicScore = computeCompositeScore({
        similarity: 0.7,
        recency: 0.3,
        importance: 2,
        usageFrequency: 0.2,
        category: 'topic',
    })
    assert(identityScore > topicScore, 'identity beats topic at equal base scores')
    assertClose(identityScore - topicScore, 0.06, 0.001, 'difference equals identity priority (0.06)')
}

// -------------------------------------------------------
// 3. Inside joke beats bland topical memory when scores are close
// -------------------------------------------------------
console.log('\n3. Inside joke tiebreaker')
{
    // Topic memory with slightly better similarity
    const topicScore = computeCompositeScore({
        similarity: 0.72,
        recency: 0.4,
        importance: 1,
        usageFrequency: 0.1,
        category: 'topic',
    })
    // Inside joke with slightly worse similarity but category boost
    const jokeScore = computeCompositeScore({
        similarity: 0.70,
        recency: 0.4,
        importance: 1,
        usageFrequency: 0.1,
        category: 'inside_joke',
    })
    // Topic base: 0.5*0.72 + 0.2*0.4 + 0.15*(1/3) + 0.15*0.1 + 0 = 0.36+0.08+0.05+0.015 = 0.505
    // Joke base:  0.5*0.70 + 0.2*0.4 + 0.15*(1/3) + 0.15*0.1 + 0.05 = 0.35+0.08+0.05+0.015+0.05 = 0.545
    assert(jokeScore > topicScore, 'inside joke beats topic when close (tiebreaker works)')
}

// -------------------------------------------------------
// 4. Fresh mood fact can surface (recency dominates)
// -------------------------------------------------------
console.log('\n4. Fresh mood fact surfaces via recency')
{
    const freshMood = computeCompositeScore({
        similarity: 0.5,
        recency: 1.0,
        importance: 1,
        usageFrequency: 0.0,
        category: 'mood',
    })
    const oldIdentity = computeCompositeScore({
        similarity: 0.5,
        recency: 0.0,
        importance: 2,
        usageFrequency: 0.0,
        category: 'identity',
    })
    // freshMood: 0.25 + 0.2 + 0.05 + 0 + 0.01 = 0.51
    // oldIdentity: 0.25 + 0 + 0.1 + 0 + 0.06 = 0.41
    assert(freshMood > oldIdentity, 'fresh mood fact beats old identity when very recent')
}

// -------------------------------------------------------
// 5. Importance effect preserved
// -------------------------------------------------------
console.log('\n5. Importance still matters')
{
    const lowImportance = computeCompositeScore({
        similarity: 0.6,
        recency: 0.5,
        importance: 1,
        usageFrequency: 0.2,
        category: 'preference',
    })
    const highImportance = computeCompositeScore({
        similarity: 0.6,
        recency: 0.5,
        importance: 3,
        usageFrequency: 0.2,
        category: 'preference',
    })
    assert(highImportance > lowImportance, 'higher importance produces higher score')
    assertClose(highImportance - lowImportance, 0.10, 0.001, 'importance 3 vs 1 difference = 0.10')
}

// -------------------------------------------------------
// 6. Usage frequency effect preserved
// -------------------------------------------------------
console.log('\n6. Usage frequency effect')
{
    const neverUsed = computeCompositeScore({
        similarity: 0.6,
        recency: 0.5,
        importance: 1,
        usageFrequency: 0.0,
        category: null,
    })
    const recentlyUsed = computeCompositeScore({
        similarity: 0.6,
        recency: 0.5,
        importance: 1,
        usageFrequency: 1.0,
        category: null,
    })
    assert(recentlyUsed > neverUsed, 'recently used memory scores higher')
}

// -------------------------------------------------------
// 7. Category priority values are valid
// -------------------------------------------------------
console.log('\n7. Category priority map')
{
    assert(CATEGORY_PRIORITY['identity'] === 0.06, 'identity is highest priority')
    assert(CATEGORY_PRIORITY['inside_joke'] === 0.05, 'inside_joke is second')
    assert(CATEGORY_PRIORITY['topic'] === 0.00, 'topic has no boost')
    assert(Object.values(CATEGORY_PRIORITY).every(v => v >= 0 && v <= 0.1), 'all priorities are small tiebreakers (0-0.1)')
}

// -------------------------------------------------------
// 8. Importance caps at 3
// -------------------------------------------------------
console.log('\n8. Importance caps at 3')
{
    const capped = computeCompositeScore({
        similarity: 0.5,
        recency: 0.5,
        importance: 10,
        usageFrequency: 0.5,
        category: null,
    })
    const maxNormal = computeCompositeScore({
        similarity: 0.5,
        recency: 0.5,
        importance: 3,
        usageFrequency: 0.5,
        category: null,
    })
    assertClose(capped, maxNormal, 0.0001, 'importance 10 equals importance 3 (capped)')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
