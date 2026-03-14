/**
 * Pure character recommendation engine.
 * Maps vibe quiz answers to ranked character IDs.
 * Deterministic — no randomness, no side effects.
 */

export type VibeProfile = {
    primary_intent: 'hype' | 'honest' | 'humor' | 'chill'
    warmth_style: 'warm' | 'balanced' | 'edgy'
    chaos_level: 'calm' | 'lively' | 'chaotic'
}

// Affinity tables: character_id → score per trait value
const INTENT_AFFINITY: Record<string, Record<string, number>> = {
    hype:   { kael: 3, dash: 3, miko: 2, rico: 1, cleo: 1 },
    honest: { sage: 3, zara: 3, atlas: 2, vee: 1, luna: 1 },
    humor:  { rico: 3, jinx: 2, cleo: 2, nyx: 2, miko: 1 },
    chill:  { nova: 3, luna: 3, vee: 2, ezra: 2, sage: 1 },
}

const WARMTH_AFFINITY: Record<string, Record<string, number>> = {
    warm:     { luna: 2, sage: 2, vee: 2, nova: 1, atlas: 1 },
    balanced: {},
    edgy:     { nyx: 2, rico: 2, zara: 1, jinx: 1 },
}

const CHAOS_AFFINITY: Record<string, Record<string, number>> = {
    calm:    { atlas: 2, sage: 1, vee: 2, nova: 1, ezra: 1 },
    lively:  { kael: 2, cleo: 2, dash: 2, miko: 1 },
    chaotic: { rico: 2, jinx: 2, nyx: 1, miko: 1 },
}

/**
 * Score all characters and return ranked IDs.
 * Top 4 are "recommended" — all remain available for selection.
 */
export function recommendCharacters(vibe: VibeProfile): string[] {
    const scores: Record<string, number> = {}

    const intentMap = INTENT_AFFINITY[vibe.primary_intent] || {}
    const warmthMap = WARMTH_AFFINITY[vibe.warmth_style] || {}
    const chaosMap = CHAOS_AFFINITY[vibe.chaos_level] || {}

    for (const [id, score] of Object.entries(intentMap)) {
        scores[id] = (scores[id] || 0) + score
    }
    for (const [id, score] of Object.entries(warmthMap)) {
        scores[id] = (scores[id] || 0) + score
    }
    for (const [id, score] of Object.entries(chaosMap)) {
        scores[id] = (scores[id] || 0) + score
    }

    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
}
