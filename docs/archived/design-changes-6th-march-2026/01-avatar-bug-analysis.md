# Avatar Image Missing After Custom Names — Root Cause Analysis

**Date:** 6th March 2026
**Status:** Root cause identified, fix pending

## Problem

When a user assigns custom names to their squad members (via chat settings), persona avatar images sometimes stop showing — only the fallback initial letter is displayed.

## Root Cause

**localStorage hydration with stale `activeGang` data.**

### How it happens

1. `activeGang` (array of `Character` objects) is persisted to localStorage via Zustand's `persist` middleware (`src/stores/chat-store.ts:132-145`)
2. The `Character.avatar` field is **optional** (`src/stores/chat-store.ts:24`)
3. If `activeGang` was saved to localStorage before avatars were added, or if the avatar field was lost during serialization, the persisted data has no avatar URLs
4. On page load, localStorage hydrates first — the app renders `activeGang` **without avatars**
5. Auth-manager (`src/components/orchestrator/auth-manager.tsx:88-91`) eventually refreshes from the `CHARACTERS` catalog, but there's a render window where stale data shows

### Why custom names trigger it

- `message-list.tsx:96-110` has defensive merging: it looks up the catalog and merges `avatar: character.avatar || catalogCharacter.avatar`
- **BUT** `chat-header.tsx:118-137` reads `activeGang` directly without catalog enrichment
- Custom naming via `chat-settings.tsx:368-378` stores names separately in `custom_character_names` — it does NOT touch `activeGang`
- However, the act of renaming may coincide with a state where `activeGang` was hydrated from localStorage without avatars

### Key code paths

| File | Lines | Role |
|------|-------|------|
| `src/stores/chat-store.ts` | 132-145 | Persists `activeGang` to localStorage |
| `src/stores/chat-store.ts` | 18-31 | `Character` interface — `avatar?: string` (optional) |
| `src/constants/characters.ts` | all | Source of truth for avatar URLs |
| `src/components/orchestrator/auth-manager.tsx` | 60-91 | Loads gang from DB, enriches from catalog |
| `src/components/chat/message-list.tsx` | 96-110 | Merges catalog data for messages (defensive) |
| `src/components/chat/chat-header.tsx` | 118-137 | Renders avatars from `activeGang` (no catalog merge) |
| `src/components/chat/message-item.tsx` | 13-38 | `MessageAvatar` — falls back to initial if no `avatar` |
| `src/components/chat/chat-settings.tsx` | 368-378 | `handleRenameCharacter` — only updates names, not gang |

## Recommended Fix

**Best approach:** When hydrating `activeGang` from localStorage, always enrich each character from the `CHARACTERS` catalog to ensure avatar URLs are present.

This can be done in the Zustand store's `onRehydrateStorage` callback or in `auth-manager.tsx` before first render.

```typescript
// In chat-store.ts onRehydrateStorage:
const enriched = state.activeGang.map(char => {
  const catalogChar = CHARACTERS.find(c => c.id === char.id)
  return catalogChar ? { ...catalogChar, ...char, avatar: catalogChar.avatar } : char
})
```
