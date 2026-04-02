export type MemoryMutationErrorCode =
    | 'not_authenticated'
    | 'rate_limited'
    | 'invalid_content'
    | 'forbidden'
    | 'unknown'

export type MemoryMutationResult =
    | { ok: true }
    | { ok: false; errorCode: MemoryMutationErrorCode; message: string }

export function createMemoryMutationSuccess(): MemoryMutationResult {
    return { ok: true }
}

export function createMemoryMutationFailure(errorCode: MemoryMutationErrorCode, message: string): MemoryMutationResult {
    return { ok: false, errorCode, message }
}
