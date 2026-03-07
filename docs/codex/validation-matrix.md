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
- Verified on March 7, 2026: `test1@test.com` can log in to production.
- Verified on March 7, 2026: Dodo test-mode Pro checkout reaches the external payment simulator and returns to `https://www.mygang.ai/checkout/success?...`.
- Failed on March 7, 2026: production activation ended at “We’re still checking your upgrade,” and `POST /api/checkout/activate` returned `400`.
- Failed on March 7, 2026: after successful payment, production still showed no Pro badge, no congratulatory celebration, and the profile remained `subscription_tier = free`.
- Failed on March 7, 2026: farewell message `gn bye` produced a short sendoff but then duplicated the same goodbye pair again via idle autonomous follow-up.
- Observed on March 7, 2026: landing page still emits `404` for `/favicon.ico`.
- Observed on March 7, 2026: mobile comparison remains side by side, but the production layout still felt visually clipped enough to warrant a tighter mobile grid.
