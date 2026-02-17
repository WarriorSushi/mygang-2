# MyGang Monetization & Pricing Strategy Proposal

**Date:** February 17, 2026
**App:** MyGang - AI Group Chat with multiple AI friends
**Current Stack:** Next.js, Supabase, OpenRouter (Gemini 2.5 Flash Lite)

---

## Table of Contents

1. [Market Research: How Competitors Monetize](#1-market-research-how-competitors-monetize)
2. [Free Tier Design Standards](#2-free-tier-design-standards)
3. [Paid Tier Models Comparison](#3-paid-tier-models-comparison)
4. [Conversion Strategies](#4-conversion-strategies)
5. [MyGang-Specific Pricing Proposal](#5-mygang-specific-pricing-proposal)
6. [Feature Gating Plan](#6-feature-gating-plan)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Financial Projections](#8-financial-projections)

---

## 1. Market Research: How Competitors Monetize

### 1.1 Character.AI

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0/mo | Unlimited messaging, character creation, community access |
| c.ai+ | $9.99/mo ($7.92/mo annual) | Priority access, better memory, latest models, voice calls |

**Model:** Pure subscription. Free tier is generous (unlimited messages) to build habit, then upsells on quality/speed.

**Key Insight:** Character.AI keeps free messaging unlimited but gates model quality and response speed. This maximizes user acquisition and creates FOMO around the premium experience.

*Sources: [Character AI Pricing](https://www.eesel.ai/blog/character-ai-pricing), [Character.AI Subscription](https://character.ai/subscription/plus/pricing)*

### 1.2 Replika

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0/mo | Basic chat, 3D avatar, 24/7 access |
| Pro | $19.99/mo ($5.83/mo annual) | Adult roleplay, voice messages, phone calls, advanced AI model, coaching |
| Lifetime | $299.99 (one-time) | All Pro features, permanently |

**Model:** Feature-gated subscription. Free chat is available but emotionally compelling features (voice, deeper conversations, relationship modes) are locked behind Pro.

**Key Insight:** Replika charges a premium ($19.99/mo) because its user base is emotionally invested. The lifetime option captures high-LTV users upfront. Annual pricing ($69.99/year) creates a massive discount incentive.

*Sources: [Replika Pricing Breakdown](https://www.eesel.ai/blog/replika-ai-pricing), [Replika Pro Cost](https://replikapro.com/replika-pro-ai-cost-pricing/)*

### 1.3 ChatGPT (OpenAI)

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0/mo | GPT-4o-mini, 30 turns/hour, basic features |
| Go | $8/mo | 10x free limits, GPT-5.2 Instant, file uploads |
| Plus | $20/mo | GPT-5.2 Thinking, 5x higher limits, DALL-E 4, priority access |
| Pro | $200/mo | Unlimited GPT-5.2 Pro, Sora 2 Pro, max context windows |

**Model:** Multi-tier subscription with clear model quality escalation. Each tier unlocks progressively better models and higher limits.

**Key Insight:** The $8 "Go" tier is a brilliant entry-level product. It captures users who find free too limited but $20 too much. The $200 Pro tier extracts maximum value from power users.

*Sources: [ChatGPT Pricing](https://userjot.com/blog/chatgpt-pricing-2025-plus-pro-team-costs), [ChatGPT Plans](https://chatgpt.com/pricing)*

### 1.4 Claude (Anthropic)

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0/mo | Sonnet 4.5 only, basic capabilities |
| Pro | $20/mo | All models (Opus 4.5, Sonnet 4.5, Haiku 4.5), Claude Code, extended features |
| Max 5x | $100/mo | 5x Pro usage limits |
| Max 20x | $200/mo | 20x Pro usage limits |

**Model:** Usage-multiplier tiers. Base subscription at $20, then scale up usage limits for power users.

**Key Insight:** The Max tiers are pure usage scaling. Claude's approach of "same features, more usage" is clean and easy to understand.

*Sources: [Claude Pricing](https://intuitionlabs.ai/articles/claude-pricing-plans-api-costs), [Claude AI Pricing 2026](https://screenapp.io/blog/claude-ai-pricing)*

### 1.5 Chai AI

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0/mo | 70 messages every 3 hours |
| Premium | $13.99/mo ($134.99/yr) | Unlimited messages, no ads, full bot access |
| Ultra | $29.99/mo ($269.99/yr) | Premium + advanced models, exclusive chatbots |

**Model:** Message-limited free tier with subscription unlock. The 3-hour rolling window is clever: it creates frequent micro-frustration moments that prompt upgrades.

**Key Insight:** Chai's free limit of 70 messages per 3 hours is roughly 560/day in theory, but the rolling window means users hit walls during peak engagement moments. This is psychologically more effective than a flat daily cap.

*Sources: [Chai AI Review](https://scribehow.com/page/Chai_AI_Review_2026_Honest_Review_Features_Pricing_Legit___1GbGgMOYR6qcP9YIiKq0aw), [Chai AI Pricing](https://www.oreateai.com/blog/decoding-chai-ai-subscription-pricing-what-you-need-to-know/b15a0e9bfacead86ef54546f8d54c435)*

### 1.6 Janitor AI

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0/mo | JanitorLLM, public character access |
| Pro | ~$7.93/mo | Higher/unlimited message quotas, priority servers, more customization |
| API (BYOK) | Variable | Users bring their own API keys (OpenAI, etc.) |

**Model:** Hybrid free + optional subscription + BYOK. The BYOK option is unique: power users pay API costs directly.

**Key Insight:** Janitor AI offloads compute costs to power users via BYOK, while offering a cheap Pro tier for those who want convenience. This keeps the platform's own costs very low.

*Sources: [Janitor AI Guide](https://janitorai.org.uk/janitor-ai-2025-guide-features-pricing-safety-api-setup-and-best-alternatives/), [Janitor AI Pricing](https://www.howtobuysaas.com/product/janitor-ai/)*

### 1.7 Summary Comparison Table

| App | Free Messages | Lowest Paid | Mid Tier | Premium | Primary Model |
|-----|-------------|-------------|----------|---------|---------------|
| Character.AI | Unlimited | $9.99/mo | - | - | Quality/Speed gate |
| Replika | Unlimited (limited features) | $19.99/mo | - | $299.99 lifetime | Feature gate |
| ChatGPT | 30 turns/hour | $8/mo | $20/mo | $200/mo | Model + usage gate |
| Claude | Limited usage | $20/mo | $100/mo | $200/mo | Usage multiplier |
| Chai AI | 70/3hrs | $13.99/mo | $29.99/mo | - | Message limit |
| Janitor AI | Unlimited (basic) | ~$7.93/mo | BYOK | - | Hybrid |
| **Industry Median** | **50-80/day equiv** | **$9.99/mo** | **$19.99/mo** | **$99-200/mo** | - |

---

## 2. Free Tier Design Standards

### 2.1 Message Limits Across the Industry

- **ChatGPT Free:** 30 turns/hour (approximately 300-400/day for active users)
- **Chai AI Free:** 70 messages per 3-hour window (rolling)
- **Character.AI Free:** Unlimited messages (quality-gated)
- **Replika Free:** Unlimited messages (feature-gated)
- **MyGang Current:** 80 messages/day (flat daily cap)

### 2.2 Recommended Free Tier Standards

The industry is converging on two strategies:

**Strategy A - Usage-Limited (Chai/ChatGPT model):**
- Set a daily or rolling window message cap
- Make the limit generous enough for casual users (1-2 sessions/day)
- Trigger upgrade prompts when the limit is approached

**Strategy B - Quality-Limited (Character.AI/Replika model):**
- Allow unlimited or very high message counts
- Gate model quality, response speed, or feature access
- Upgrade prompts focus on "unlock the full experience"

### 2.3 What Works for MyGang

Given MyGang's unique multi-character dynamic (each user message generates 2-4 AI responses), the cost multiplier per user interaction is higher than 1:1 chat apps. This means **Strategy A (usage-limited) is more appropriate** for cost control, supplemented with feature gating from Strategy B.

**Current free limit of 80 messages/day is reasonable** but should be reframed:
- 80 user messages = 160-320 AI responses at $0.00041 each = $0.066-$0.131/day per active user
- At 30 days: $1.97-$3.94/month per daily-active free user
- This is sustainable if conversion rate is above 3-5%

### 2.4 Free-to-Paid Transition Best Practices

| Approach | Description | Effectiveness |
|----------|-------------|---------------|
| **Soft wall** | Show remaining messages, gentle prompts at 70% usage | Higher retention, slower conversion |
| **Hard wall** | Block access at limit, must upgrade or wait | Faster conversion, higher churn risk |
| **Progressive** | Gradually degrade experience (slower responses, fewer responders) | Best retention, moderate conversion |
| **Contextual** | Prompt upgrade only when user attempts a gated feature | Highest quality conversions |

**Recommendation for MyGang:** Use a **progressive + contextual hybrid**:
1. At 60/80 messages: Show a gentle "20 messages remaining today" indicator
2. At 80/80 messages: Soft wall with countdown to reset + upgrade CTA
3. Never hard-block mid-conversation (let the current exchange finish)

---

## 3. Paid Tier Models Comparison

### 3.1 Subscription Model (Monthly/Annual)

**How it works:** Fixed monthly fee for increased limits and features.

| Pros | Cons |
|------|------|
| Predictable revenue (MRR) | Users who underuse feel they're wasting money |
| Easy to understand | Hard to price optimally for all user segments |
| Industry standard, users expect it | Annual discounts reduce short-term revenue |
| Lower churn with annual plans | |

**Best for:** Apps with consistent daily engagement (Replika, Character.AI pattern).

### 3.2 Credit-Based Model (Pay-Per-Use)

**How it works:** Users buy credit packs, each message costs credits.

| Pros | Cons |
|------|------|
| Users pay exactly for what they use | Revenue is unpredictable |
| Lower barrier to first payment | Requires constant re-purchase decisions |
| Can monetize whale users heavily | Creates anxiety about spending |
| No "wasted subscription" feeling | Lower retention than subscriptions |

**Best for:** Apps with sporadic usage or where some users send 10x more than average.

### 3.3 Hybrid Model (Subscription + Credits)

**How it works:** Base subscription includes X messages/month, additional credits available for purchase.

| Pros | Cons |
|------|------|
| Captures both predictable revenue and whale spending | More complex to explain and implement |
| Flexible for different usage patterns | Can feel nickel-and-dime-y |
| Subscription builds habit, credits capture peaks | |

**Best for:** Apps targeting both casual and power users (ChatGPT Go+Plus+Pro pattern).

### 3.4 Verdict for MyGang

**Recommended: Subscription-first with optional credit top-ups (Hybrid Lite).**

Rationale:
- MyGang's group chat format encourages daily engagement (subscription-friendly)
- The multi-character responses mean usage is inherently "bursty" (credits help capture peaks)
- At $0.00041/message, the margin on even a $4.99 subscription is massive (covers ~12,195 messages)
- Keep the model simple at launch: subscription only. Add credits later if data shows demand.

---

## 4. Conversion Strategies

### 4.1 Soft Walls vs Hard Walls

**Soft walls** (recommended for MyGang):
- Show a progress bar: "42/80 messages used today"
- At 75% usage: Inline banner "Running low? Upgrade for 300 messages/day"
- At 100%: "You've reached today's limit. Reset in X hours, or upgrade to Pro"
- Never interrupt a conversation mid-flow

**Hard walls** (use sparingly):
- Only for clearly premium features (voice mode, premium characters, etc.)
- Always show what the feature does before asking for payment
- Include a "maybe later" dismiss option

### 4.2 Usage-Based Prompts (Specific to MyGang)

Trigger upgrade prompts at these moments:

| Trigger | Message | Conversion Potential |
|---------|---------|---------------------|
| 60/80 messages reached | "Your gang is vibing today! You've used 60 of 80 messages. [Upgrade for unlimited]" | Medium |
| Daily limit hit | "The gang isn't going anywhere. Come back tomorrow or unlock 300 messages/day with Pro." | High |
| User tries to add 5th character | "Pro members can chat with up to 6 characters at once. [Upgrade]" | High |
| User tries premium wallpaper | "This wallpaper is a Pro exclusive. [Preview it] or [Upgrade]" | Medium |
| After 7 days of consecutive use | "You've been chatting with your gang for a week straight! Unlock the full experience." | High |
| First time a character uses voice | "Want to hear Kael's voice? Voice mode is available with Pro. [Try it]" | High |

### 4.3 Feature Gating Strategy

**Tier 1 - Free (Hooks & Habit):**
- Core group chat experience
- 2-4 characters from the base roster
- 80 messages/day
- Basic wallpapers
- Chat history (limited)

**Tier 2 - Pro (Value & Retention):**
- Everything in Free
- 300+ messages/day
- Priority response speed
- All wallpapers
- Extended memory (characters remember more)
- Custom character nicknames
- Full chat history export
- Gang Focus + Ecosystem modes

**Tier 3 - Ultra (Whale Capture):**
- Everything in Pro
- Unlimited messages
- Up to 6 characters in a gang
- Premium/exclusive characters
- Voice mode
- Character customization (edit personality, voice style)
- Priority support
- Early access to new features

### 4.4 Conversion Rate Benchmarks

Industry standard freemium conversion rates:
- **Average SaaS:** 2-5%
- **AI chat apps:** 3-8% (higher due to emotional investment)
- **Replika:** Estimated 5-10% (emotional attachment drives conversion)
- **Character.AI:** Estimated 2-4% (high free-tier generosity)
- **Target for MyGang:** 5-7% (group chat creates stronger habits than 1:1)

---

## 5. MyGang-Specific Pricing Proposal

### 5.1 Cost Analysis

**Per-message cost:** $0.00041 (Gemini 2.5 Flash Lite via OpenRouter)

**Cost per user tier (monthly, assuming daily active use):**

| Scenario | User Messages/Day | AI Responses/Day | Monthly AI Cost |
|----------|-------------------|-------------------|-----------------|
| Light free user | 20 | 40-60 | $0.49-$0.74 |
| Heavy free user | 80 | 160-320 | $1.97-$3.94 |
| Pro user (moderate) | 150 | 300-600 | $3.69-$7.38 |
| Pro user (heavy) | 300 | 600-1200 | $7.38-$14.76 |
| Ultra user (max) | 500+ | 1000-2000 | $12.30-$24.60 |

**Key takeaway:** Even the heaviest Pro user costs under $15/month in API calls. Any subscription above $7.99/month is profitable for the vast majority of users.

### 5.2 Recommended Pricing Tiers

#### Free Tier - $0/month
- 80 messages/day (user messages; AI responses are unlimited within this)
- 2-4 characters from base roster (8 characters)
- Ecosystem + Gang Focus modes
- Basic wallpapers (3-4 options)
- 7-day chat history retention
- Standard response speed
- Basic memory (characters forget after ~20 turns)

#### Pro Tier - $7.99/month ($59.99/year)
- 300 messages/day
- All 8 base characters
- All wallpapers
- Unlimited chat history
- Extended memory (characters remember across sessions)
- Custom character nicknames
- Priority response speed
- Export chat history
- No "upgrade" prompts

**Why $7.99:** Undercuts Character.AI ($9.99) and sits at the ChatGPT Go price point ($8). For a niche app, the lower price reduces purchase friction. At 300 messages/day, worst-case cost is ~$7.38/month, leaving thin but positive margin. Most users will use 100-200 messages/day, making average margin ~60-70%.

**Annual pricing at $59.99/year ($5.00/month effective):** Creates strong incentive for annual commitment. Even at this rate, margin is positive for all but the most extreme users.

#### Ultra Tier - $14.99/month ($119.99/year)
- Unlimited messages (soft cap at 1000/day for abuse prevention)
- Everything in Pro
- Up to 6 characters in a gang (vs 4 for free/Pro)
- Premium/exclusive characters (2-3 special characters)
- Voice mode (text-to-speech for character messages)
- Character personality customization
- Priority API access (never see "capacity tight" messages)
- Early access to new features
- Custom character avatars

**Why $14.99:** Captures power users willing to pay more. Still cheaper than Replika Pro ($19.99) and Chai Ultra ($29.99). The 6-character gang and voice mode are genuinely differentiating features that justify the premium.

### 5.3 Optional Add-Ons (Phase 2)

| Add-On | Price | Description |
|--------|-------|-------------|
| Message Pack (50) | $0.99 | For free users who hit daily limit but don't want to subscribe |
| Message Pack (200) | $2.99 | Larger pack for occasional heavy days |
| Custom Character Slot | $2.99/mo | Create a fully custom character with your own personality/voice |
| Theme Pack | $1.99 (one-time) | Bundle of 5 premium wallpapers |

### 5.4 Pricing Comparison with Competitors

| Feature | MyGang Free | MyGang Pro ($7.99) | MyGang Ultra ($14.99) | Character.AI+ ($9.99) | Replika Pro ($19.99) | Chai Premium ($13.99) |
|---------|------------|--------------------|-----------------------|-----------------------|---------------------|-----------------------|
| Messages/day | 80 | 300 | Unlimited | Unlimited | Unlimited | Unlimited |
| Characters | 2-4 | 2-4 (all 8) | 2-6 (all + premium) | 1 | 1 | 1 |
| Group chat | Yes | Yes | Yes | No | No | No |
| Memory | Basic | Extended | Extended | Better (paid) | Basic | Basic |
| Voice | No | No | Yes | Yes (paid) | Yes (paid) | No |
| Custom names | No | Yes | Yes | No | No | No |

**MyGang's unique value proposition:** The only AI chat app offering group conversations with multiple AI characters who interact with each other. This justifies a competitive price point.

---

## 6. Feature Gating Plan

### 6.1 Features by Tier (Detailed)

#### Already Built (Gate Immediately)

| Feature | Free | Pro | Ultra | Current Status |
|---------|------|-----|-------|----------------|
| Daily message limit | 80 | 300 | 1000 (soft) | Already implemented in route.ts |
| Ecosystem mode | Yes | Yes | Yes | Built, available to all |
| Gang Focus mode | Yes | Yes | Yes | Built, available to all |
| Low-cost mode toggle | Hidden | Visible | Visible | Built in settings |
| Custom character names | No | Yes | Yes | Built, needs gating |
| Chat wallpapers | 3 basic | All | All + exclusive | Built, needs gating |
| Performance monitor | No | Yes | Yes | Built, needs gating |

#### Needs Building (Phase 1 - Priority)

| Feature | Free | Pro | Ultra | Effort |
|---------|------|-----|-------|--------|
| Upgrade prompts/paywall UI | N/A | N/A | N/A | Medium |
| Stripe/payment integration | N/A | N/A | N/A | High |
| Usage counter UI (messages remaining) | Yes | Yes | No | Low |
| Subscription management page | N/A | Yes | Yes | Medium |
| Chat history export | No | Yes | Yes | Low |

#### Needs Building (Phase 2 - Growth)

| Feature | Free | Pro | Ultra | Effort |
|---------|------|-----|-------|--------|
| 5-6 character gangs | No | No | Yes | Medium |
| Premium characters (2-3 new) | No | No | Yes | Medium |
| Voice mode (TTS) | No | No | Yes | High |
| Character personality editor | No | No | Yes | High |
| Message credit packs | Buy | Buy | N/A | Medium |
| Extended memory depth | No | Yes | Yes | Low |

### 6.2 Where to Gate in the Codebase

Based on the current code, here are the specific integration points:

**`src/app/api/chat/route.ts` (line 655):**
The daily limit check already reads `subscription_tier` from the profile:
```typescript
const dailyLimit = profile?.subscription_tier === 'pro' ? 300 : 80
```
This needs to be extended to handle 'ultra' tier:
```typescript
const dailyLimit = profile?.subscription_tier === 'ultra' ? 1000
    : profile?.subscription_tier === 'pro' ? 300
    : 80
```

**`src/stores/chat-store.ts`:**
Add a `subscriptionTier` field to the store so the UI can react to the user's tier without extra API calls.

**`src/components/settings/settings-panel.tsx`:**
The settings panel already receives `usage.subscriptionTier`. Add upgrade CTAs and tier-specific feature toggles here.

**`src/components/chat/chat-input.tsx`:**
Add a message counter/progress bar showing remaining daily messages. Show upgrade prompt when approaching limit.

**`src/app/api/chat/route.ts` (line 749):**
The `maxResponders` calculation can be tier-gated:
```typescript
const maxGangSize = profile?.subscription_tier === 'ultra' ? 6 : 4
```

---

## 7. Implementation Roadmap

### Phase 0: Foundation (Week 1-2)
**Goal:** Payment infrastructure

- [ ] Set up Stripe account and configure products/prices
- [ ] Create Supabase webhook handler for Stripe events
- [ ] Add `subscription_tier`, `subscription_expires_at`, `stripe_customer_id` columns to profiles table
- [ ] Build subscription management API routes
- [ ] Implement tier validation middleware

### Phase 1: Core Monetization (Week 3-4)
**Goal:** Users can subscribe and experience tier differences

- [ ] Build pricing page/modal component
- [ ] Implement Stripe Checkout flow (subscribe)
- [ ] Implement Stripe Customer Portal (manage/cancel)
- [ ] Add usage counter UI in chat input area
- [ ] Add upgrade prompt at 75% and 100% daily limit
- [ ] Gate custom character names behind Pro
- [ ] Gate premium wallpapers behind Pro/Ultra
- [ ] Add "Pro" badge next to subscriber usernames

### Phase 2: Conversion Optimization (Week 5-6)
**Goal:** Maximize free-to-paid conversion

- [ ] Implement contextual upgrade prompts (see Section 4.2)
- [ ] Add "try Pro free for 3 days" trial option
- [ ] Build analytics for conversion funnel tracking
- [ ] A/B test upgrade prompt copy and placement
- [ ] Add annual pricing option with discount badge
- [ ] Implement message credit packs as one-time purchases

### Phase 3: Ultra Features (Week 7-10)
**Goal:** Differentiate Ultra tier and capture power users

- [ ] Implement 5-6 character gang support for Ultra
- [ ] Design and build 2-3 premium characters
- [ ] Implement voice mode (TTS) for Ultra
- [ ] Build character personality editor for Ultra
- [ ] Add chat history export for Pro/Ultra
- [ ] Extended memory depth for Pro/Ultra

### Phase 4: Optimization (Ongoing)
**Goal:** Refine pricing and features based on data

- [ ] Monitor conversion rates by trigger point
- [ ] Adjust message limits based on usage data
- [ ] Test pricing variations ($6.99 vs $7.99 vs $9.99)
- [ ] Add referral program (give Pro trial to friend)
- [ ] Consider family/group plans
- [ ] Evaluate credit system demand

---

## 8. Financial Projections

### 8.1 Revenue Model Assumptions

| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|-----------|
| Monthly Active Users (MAU) | 1,000 | 5,000 | 20,000 |
| Daily Active Users (DAU) | 300 | 1,500 | 6,000 |
| Free-to-Pro conversion | 4% | 6% | 8% |
| Pro-to-Ultra conversion | 10% of Pro | 15% of Pro | 20% of Pro |
| Monthly churn (Pro) | 12% | 8% | 5% |
| Monthly churn (Ultra) | 8% | 5% | 3% |

### 8.2 Monthly Revenue Projection

**Conservative (1,000 MAU):**
- Pro subscribers: 40 x $7.99 = $319.60
- Ultra subscribers: 4 x $14.99 = $59.96
- Credit packs: ~$50
- **Total MRR: ~$430**
- API costs (all users): ~$300-600
- **Net margin: ~$0-130/month** (break-even to slightly positive)

**Moderate (5,000 MAU):**
- Pro subscribers: 300 x $7.99 = $2,397
- Ultra subscribers: 45 x $14.99 = $674.55
- Credit packs: ~$300
- **Total MRR: ~$3,372**
- API costs (all users): ~$1,200-2,400
- **Net margin: ~$972-2,172/month**

**Optimistic (20,000 MAU):**
- Pro subscribers: 1,600 x $7.99 = $12,784
- Ultra subscribers: 320 x $14.99 = $4,796.80
- Credit packs: ~$1,500
- **Total MRR: ~$19,081**
- API costs (all users): ~$4,500-9,000
- **Net margin: ~$10,081-14,581/month**

### 8.3 Break-Even Analysis

**Per free user cost:** ~$1.50-$3.00/month (assuming 30-50 messages/day average)
**Per Pro user revenue:** $7.99/month
**Per Pro user cost:** ~$3.50-$7.00/month
**Per Pro user margin:** $0.99-$4.49/month

**Break-even requires:** Each paying user must subsidize ~15-20 free users.
At 5% conversion rate, each Pro user subsidizes ~19 free users.
**Break-even cost per free user must be < $0.42/month** OR conversion must be > 5%.

**Recommendation:** Keep free tier at 80 messages/day (not higher) to maintain sustainability. Consider reducing to 50-60 messages/day if free-user costs exceed projections.

### 8.4 Key Metrics to Track

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Free-to-trial conversion | 10-15% | Users who start a trial / total free users |
| Trial-to-paid conversion | 40-60% | Users who subscribe after trial / trial users |
| Overall free-to-paid | 5-7% | Total paying users / total users |
| Monthly churn | < 8% | Users who cancel / total subscribers |
| ARPU (all users) | $0.50-1.00 | Total revenue / MAU |
| ARPPU (paying users) | $9-12 | Total revenue / paying users |
| DAU/MAU ratio | > 30% | Daily active / monthly active |
| Messages per session | 15-30 | Average messages sent per session |
| Sessions per day | 1.5-3 | Average sessions per DAU |
| Cost per user | < $3/month | Total API costs / DAU |

---

## Appendix A: Pricing Psychology Notes

1. **$7.99 vs $9.99:** The $7.99 price point feels significantly cheaper than $9.99 due to the left-digit effect. For a niche app without brand recognition, the lower price reduces friction.

2. **Annual pricing at 37% discount:** The $59.99/year ($5.00/month) vs $7.99/month represents a 37% savings. Industry standard discounts are 20-40%. This is aggressive enough to drive annual commitments.

3. **Three tiers, not two:** Having Free/Pro/Ultra follows the "decoy effect." Ultra makes Pro look like a better deal. Even if few users buy Ultra, it increases Pro conversion.

4. **Free trial over free tier:** Consider offering a 3-day Pro trial to new signups instead of (or in addition to) the permanent free tier. This lets users experience the full product before making a decision. Industry data shows trial-to-paid conversion (40-60%) is much higher than freemium-to-paid (3-8%).

5. **Price anchoring:** Always show the Ultra price first on the pricing page. This makes Pro look affordable by comparison.

## Appendix B: Competitive Moat Considerations

MyGang's group chat format is genuinely unique in the AI companion space. Most competitors offer 1:1 conversations. The multi-character dynamic creates:

1. **Higher engagement:** Users return to see how characters interact with each other, not just with the user.
2. **Higher switching costs:** Users develop relationships with their specific gang configuration.
3. **Natural upsell path:** More characters = more value = justifies higher tiers.
4. **Viral potential:** "Come see what my gang said" is more shareable than "come see what my AI said."

This moat justifies investing in the Ultra tier's 6-character gang feature as a key differentiator.

## Appendix C: Risk Factors

| Risk | Impact | Mitigation |
|------|--------|-----------|
| API cost increase | Margin compression | Negotiate volume discounts; maintain low-cost mode toggle; consider self-hosting smaller models |
| Low conversion rate (<3%) | Cannot cover free user costs | Reduce free tier limits; improve upgrade prompts; add trial |
| High churn (>15%) | Revenue instability | Improve product; add annual incentives; loyalty rewards |
| Competitor undercuts | Price pressure | Focus on unique group chat value; build community moat |
| Model quality decline | User satisfaction drops | Maintain model fallback options; A/B test models regularly |

---

*This proposal is based on market research conducted in February 2026 and current MyGang codebase analysis. Pricing recommendations should be validated with A/B testing before full rollout.*
