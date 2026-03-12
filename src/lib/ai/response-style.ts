const CORRECTION_TURN_PATTERN = /\b(did you (read|hear|see)|i just (said|told)|pay attention|what i said|are you listening|listen to what i said|no, make it|one concrete (step|action)|single (step|action)|no re-introduction|no intro|no multiple suggestions|just the single best action)\b/i
const CLARIFICATION_TURN_PATTERN = /\b(let me be clear|to be clear|what i mean is|what i'm saying is|read that again|i meant|that's not what i said|you missed the point|you missed what i said|you'?re not getting it|keep it to one step|be more concrete)\b/i

export function isCorrectionOrClarificationTurn(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    return CORRECTION_TURN_PATTERN.test(trimmed) || CLARIFICATION_TURN_PATTERN.test(trimmed)
}

export function shouldPreserveSingleBubbleTurn(
    text: string,
    options: {
        allowLongReplies: boolean
        farewellTurn: boolean
    }
): boolean {
    if (options.farewellTurn) return true
    if (options.allowLongReplies) return true
    return isCorrectionOrClarificationTurn(text)
}
