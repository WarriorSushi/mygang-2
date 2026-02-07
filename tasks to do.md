# Tasks To Do

## Workflow Rule
- For every new user prompt:
- Add the request here first with `Status: Pending` or `In Progress` before coding.
- After implementation, update to `Done` with a short "what was changed" note.

## Current Prompt (2026-02-07)

### 1) Task Log System
- Status: Done
- Request:
  - Create this markdown file and keep it updated for every prompt.
  - Before starting any work, log the prompt here.
- Done:
  - Created `tasks to do.md`.
  - Logged this prompt before implementation.

### 2) Audit Last 15 Prompts
- Status: Done
- Request:
  - Review the recent last 15 user prompts.
  - Identify which requested items are still not done.
  - Add pending items in this file and implement them.
- Audit Result:
  - Most chat bubble, contrast, spacing, and desktop/mobile layout asks from recent prompts are already implemented in current codebase/history.
  - Pending and now being handled:
    - Ensure cross-device chat sync behavior is robust when two sessions are open.
    - Ensure "clear timeline" also clears DB history.
    - Rename action text to `Delete All Messages`.
    - Improve/refresh landing "How it works" + "Why it feels real" so it is clearly visible and strong on mobile.

### 3) Landing Page Items Reported As Missing
- Status: Done
- Request:
  - Replace the "4 Friends In Your Crew" style copy with a better non-limiting value proposition.
  - Make "How it works" section more beautiful, detailed, and fun.
  - Add a prewritten animated chat demo feeling warm/witty (no real API call).
  - Make mobile version swipable and desktop multi-instance if possible.
  - Ensure the hero CTA scrolls smoothly to this section.
  - Improve "Why it feels real" section quality.
- Done:
  - Updated value cards wording to avoid limiting framing.
  - Expanded `How it works` with a prominent `Live Walkthrough` panel.
  - Kept and polished prewritten animated demo threads.
  - Preserved mobile swipe cards and desktop multi-card layout; widened mobile card width for visibility.
  - Smooth scroll CTA is in place to `#how-it-works`.
  - Added a stronger `Why this feels different` comparison panel under `Why it feels real`.

## Pending Items Discovered During Audit
- Status: Done
- Items:
  - Cross-device sync reliability polish for authenticated users with periodic/focus refresh from cloud history.
  - Replace local-only timeline clear with DB-backed clear + local reset.
  - Rename danger action to `Delete All Messages`.
  - Strengthen landing mobile visibility/quality for:
    - stats/value cards copy impact
    - "How it works" visual walkthrough depth
    - "Why it feels real" presentation quality
- Done:
  - Added periodic/focus cloud history sync for authenticated chat sessions.
  - Added server action to delete `chat_history` rows for current user and wired settings button to use it.
  - Renamed action label to `Delete All Messages`.
  - Added local timeline-cleared event handling for immediate UI reset.
  - Added API resilience: retry on transient 5xx, safer fallback message generation when providers fail.
