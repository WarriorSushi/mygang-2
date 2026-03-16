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
