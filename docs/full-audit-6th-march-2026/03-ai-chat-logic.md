# AI Chat Logic Audit

## Prompt Construction

**Status: SOLID**

- System prompt built server-side from character catalog + custom names
- User's name and personality context included
- Chat mode (chill/roast/deep) affects prompt tone
- Memory (AI memories from vault) injected into system prompt for context
- History trimming: Only recent messages sent to API to manage token budget

## Multi-Character Handling

**Status: GOOD**

- `activeGangSafe` filters characters from the catalog on the server (not from client input)
- Speaker assignment uses JSON parsing of AI response
- Fallback to random character if speaker parsing fails
- Custom names applied as text replacement in prompts — doesn't break character IDs

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 2 | MEDIUM | **Autonomous flow** can trigger unprompted AI messages. While this is a feature, there's a risk of runaway loops if multiple autonomous triggers fire simultaneously. The `isGeneratingRef` guard should prevent this, but edge cases with network delays could slip through. | `src/hooks/use-autonomous-flow.ts` |
| 3 | MEDIUM | **Low-cost mode fallback** switches to a cheaper model when capacity is hit. The quality difference should be communicated more clearly to users. Currently shows a small amber dot in header. | `src/hooks/use-capacity-manager.ts` |
| 4 | MEDIUM | **Purchase celebration** triggers an autonomous API call after purchase. If the celebration call fails, it silently logs and doesn't retry. Users might miss the celebration. | `src/app/chat/page.tsx:208-249` |
| 5 | LOW | **History sync** loads older messages from Supabase. The deduplication logic in `use-chat-history.ts` is correct but could be simplified. |
| 6 | LOW | **Typing simulation** creates realistic delays with per-character variation. Well implemented. | `src/hooks/use-typing-simulation.ts` |

## Rate Limiting & Paywall

**Status: GOOD**

- Free tier: Message count limit with cooldown timer
- Basic tier: Higher limits
- Pro tier: Unlimited
- Server-side verification: The API route checks `subscription_tier` from database, not from client
- Cooldown seconds returned from server to client
- PaywallPopup shows countdown and upgrade CTA

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Network failure mid-request | Message stays in "sending" state, retry button appears |
| Rapid user messages | Debounced — pending messages queued |
| Empty AI response | Caught and logged, no empty bubble displayed |
| Squad conflict (multi-device) | SquadReconcile dialog offers local vs cloud choice |
| Stale messages after refresh | `onRehydrateStorage` resets "sending" to "failed" |
| Browser offline | Offline banner shown, messages blocked, reconnect auto-resumes |
