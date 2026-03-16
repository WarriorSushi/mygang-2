# Tasks Log

## Task 001: Fix resume banner gap calculation skewed by WYWA messages
- **Date:** 2026-03-16
- **Commit:** `fix: calculate resume banner gap from last non-WYWA message`

### Problem
The "Welcome back. It has been X days." banner calculates the time gap using the **last message in chat**, regardless of source. If WYWA (While You Were Away) generated background messages while the user was gone, the last message might be a WYWA message from just hours ago — making the gap appear much shorter than the user's actual absence.

**Example:** User leaves for 3 days. WYWA fires at 9 AM today. User opens app at 2 PM. Banner says "Welcome back. It has been 5 hours." instead of "3 days."

### Decision
- Use the last **non-WYWA** message's timestamp to calculate the gap, so the banner reflects the user's actual time away.
- WYWA messages are background-generated content — they shouldn't count as "activity" for the welcome-back calculation.
- Keep the rest of the logic (10min threshold, 6hr threshold, 6s display) unchanged.

### What Changed
- `src/app/chat/page.tsx` — Resume banner useEffect: filter out `source === 'wywa'` messages before picking the last message for gap calculation.

---

## Task 002: Fix rename panel closing when clicking between input fields
- **Date:** 2026-03-16
- **Commit:** `fix: remove onBlur auto-save from rename inputs to prevent panel closing`

### Problem
In Settings → Custom Nicknames, clicking from one character's rename input to another would close the entire settings panel. The `onBlur` handler on each input was calling `handleRenameCharacter` which updates the Zustand store (`setCustomCharacterNames`) and fires a server call (`updateUserSettings`). The store update triggered a re-render cascade that closed the Sheet.

### Decision
- Remove the `onBlur` handler entirely. The "Save Names" button (`handleSaveAllNames`) already handles saving all inputs at once — that's the correct save path.
- `onBlur` auto-saving per field is unnecessary when there's an explicit Save button, and it caused the bug.
- No other logic changes needed — `onChange` still updates local `renameInputs` state, and the Save button reads from that.

### What Changed
- `src/components/chat/chat-settings.tsx` — Removed `onBlur` handler from rename input fields (line 884).

---

## Task 003: Fix resume banner staying permanently visible
- **Date:** 2026-03-16
- **Commit:** `fix: resume banner persistence and load-earlier-messages vanishing`

### Problem
The "Resumed your last session" banner shows up and never disappears. It's supposed to auto-dismiss after 6 seconds.

### Root Cause
The 6-second `setTimeout` was inside a `useEffect` that depends on `[isHydrated, messages]`. Every time `messages` changes (which happens constantly — new messages, typing, syncs), React runs the effect cleanup which **cancels the timer**. The `resumeBannerRef` guard then prevents the effect from scheduling a new timer. Result: timer cancelled, never rescheduled, banner stays forever.

### Decision
- Separate the dismiss timer into its own `useEffect` that only depends on `showResumeBanner`. This isolates it from `messages` churn entirely.
- The timer fires exactly once when the banner appears, and nothing else can cancel it.

### What Changed
- `src/app/chat/page.tsx` — Extracted the 6-second auto-dismiss into a standalone `useEffect` depending only on `showResumeBanner`.

---

## Task 004: Fix "Load Earlier Messages" loading then immediately vanishing
- **Date:** 2026-03-16
- **Commit:** `fix: resume banner persistence and load-earlier-messages vanishing`

### Problem
Clicking "Load Earlier Messages" briefly shows older messages then they vanish. Two bugs working together:

**Bug A:** `setMessages` in the Zustand store does `slice(-MAX_PERSISTED_MESSAGES)` where max was 100. Since the initial bootstrap already loads 100 messages, prepending 40 older ones makes 140, and `slice(-100)` immediately chops off all 40 older messages.

**Bug B:** The polling/sync `useEffect` has `syncLatestHistory` in its dependency array. When `loadOlderHistory` sets `isLoadingOlderHistory` to false, `syncLatestHistory` gets a new function reference (it depends on `isLoadingOlderHistory`), which re-triggers the polling effect, which calls `syncLatestHistory(true)` — overwriting the store with only the latest 40 messages.

### Decision
- **Bug A fix:** Increase `MAX_PERSISTED_MESSAGES` from 100 to 200. This gives enough room for the initial 100 + multiple pages of older history without silent truncation.
- **Bug B fix:** Use a stable ref (`syncLatestHistoryRef`) in the polling effect instead of putting `syncLatestHistory` directly in the dependency array. This prevents the effect from re-running every time `isLoadingOlderHistory` changes. The ref is kept up-to-date on every render so it always calls the latest version.

### What Changed
- `src/stores/chat-store.ts` — `MAX_PERSISTED_MESSAGES` changed from 100 to 200.
- `src/hooks/use-chat-history.ts` — Added `syncLatestHistoryRef`, replaced all `syncLatestHistory` calls in the polling effect with `syncLatestHistoryRef.current`, removed `syncLatestHistory` from the effect's dependency array.

---

## Task 005: Fix silent character swap at max squad capacity (code review red item)
- **Date:** 2026-03-16
- **Commit:** `fix: prevent silent character swap at max squad capacity on onboarding`

### Problem
On the onboarding selection step, when the user already had the maximum number of characters selected and tapped another one, the code silently dropped the first-selected character and added the new one (`previous.slice(1)`). No feedback was shown — the user's original pick just disappeared.

### Decision
- Revert to "do nothing" behavior when at max capacity (`return previous`). The UI already shows the selection counter (e.g. "4/4") so the user understands why nothing happens.
- Silent swap is confusing UX — users don't expect their first pick to vanish without warning.
- If swap behavior is wanted later, it should come with a toast or animation showing what was replaced.

### What Changed
- `src/app/onboarding/page.tsx` — `toggleCharacter` now returns `previous` unchanged when at `squadLimit`, instead of `[...previous.slice(1), id]`.

### Also Investigated (False Alarm)
- **Split message `message_id: undefined`** — Reviewed and confirmed safe. `assignMessageIdsToEvents` (route.ts:665-666) generates a new ID via `createServerEventMessageId()` when `message_id` is undefined/falsy. No DB error possible.

---

## Task 006: Add confirmation before removing a squad member
- **Date:** 2026-03-16
- **Commit:** `feat: add remove confirmation on squad member in settings`

### Problem
Users could accidentally remove a squad member with a single tap on the remove button. No warning or confirmation.

### Decision
- Use an inline two-tap confirm pattern: first tap changes the button from the icon to "Remove?", second tap actually removes.
- Clicking away (onBlur) resets the confirm state after 200ms.
- No modal — too heavy for this action. Inline confirm is quick and non-disruptive.

### What Changed
- `src/components/settings/settings-panel.tsx` — Added `confirmRemoveId` state, two-tap confirm logic on the remove button with visual transition (red highlight + "Remove?" text).

---

## Task 007: Add visual selection to "Add Friend" modal in settings
- **Date:** 2026-03-16
- **Commit:** `feat: add visual selection and confirm button to add-friend modal`

### Problem
The "Add a Friend" modal in settings instantly added a character on tap — no visual selection, no confirmation. Felt accidental and lacked feedback.

### Decision
- Tap a card to **select** it (highlighted border + checkmark badge + slight scale-up).
- Tap again to deselect.
- "Add [Name]" button appears at the bottom only when a character is selected.
- Closing the modal resets the selection.
- Keeps the flow simple: select → confirm → done.

### What Changed
- `src/components/settings/settings-panel.tsx` — Added `selectedAddId` state, replaced instant-add onClick with toggle selection, added primary border + check badge for selected state, added bottom "Add [Name]" button.
