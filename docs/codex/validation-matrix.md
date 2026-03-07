# Codex Validation Matrix

## Local
- Completed: billing copy matches the shared plan contract in pricing, settings, paywall, and banners.
- Completed: checkout success remains in a pending state until activation is confirmed.
- Completed: interrupted AI turns are persisted only after client render acknowledgement.
- Completed: farewell messages receive a short close-out without lingering autonomous chatter.
- Completed: onboarding supports a skippable intro/rename step and persists custom names.
- Completed: mobile pricing stays side by side on mobile and is horizontally scrollable without clipping the Pro column.
- Verified: `npx tsc --noEmit --pretty false`
- Verified: `npx playwright test tests/pricing-mobile.spec.ts`
- Verified: `npx playwright test tests/onboarding-auth.spec.ts`

## Production
- Use `www.mygang.ai`
- Keep local testing off port `3000`
- Create `test1@test.com` if absent before final production validation
- Run one Dodo test-mode checkout
- Confirm badge, limiter behavior, celebration, and console cleanliness
