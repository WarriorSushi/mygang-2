# MyGang.ai Admin Guide

A plain-English guide for managing the MyGang app. No coding knowledge required.

---

## 1. What is MyGang?

MyGang is an AI-powered group chat app. Users chat with a squad of AI friend characters who each have their own personality. It feels like a real group chat, not a one-on-one assistant.

**The Characters (14 total, users pick 4-6 for their squad):**

| Character | Vibe | Personality |
|-----------|------|-------------|
| Kael | Rich kid energy | Confident, slightly vain hype man |
| Nyx | Hacker energy | Dry, sarcastic, deadpan gamer |
| Atlas | Sergeant energy | Direct, protective dad-friend tactician |
| Luna | Mystic energy | Dreamy, emotional support empath |
| Rico | Chaos energy | Loud, impulsive party animal |
| Vee | Nerd energy | Walking encyclopedia, fact-checker |
| Ezra | Art House energy | Indie snob, philosophy major |
| Cleo | Gossip energy | High society socialite, dramatic and judgmental |
| Sage | Therapist energy | Calm, validating listener who asks the real questions |
| Miko | Anime protagonist energy | Over-the-top, everything is an epic battle |
| Dash | Hustle culture energy | Motivational but slightly unhinged startup bro |
| Zara | Older sister energy | Brutally honest but loves you |
| Jinx | Conspiracy theorist energy | Paranoid, connects dots that don't exist |
| Nova | Chill stoner energy | Laid-back, philosophical surfer, unfazed by everything |

**Two chat modes:**
- **Gang Focus** -- Characters respond directly to the user's messages. This is the default mode.
- **Ecosystem** -- Characters also talk to each other. They might react to each other's messages, start side conversations, or follow up on their own. This makes the group chat feel alive and spontaneous.

---

## 2. Subscription Tiers

MyGang has three tiers. Here is exactly what each one includes:

### Free (no charge)
- **25 messages per hour** -- After 25 messages in a rolling 60-minute window, the user has to wait until older messages age out.
- **Memory is saved but not used** -- The AI stores facts about the user, but does not recall them during conversation (0 memories in prompt). This means the AI won't reference past conversations.
- **4 squad members** -- The user picks 4 characters for their group chat.
- **15 context messages** -- The AI reads the last 15 messages to understand the conversation flow.
- **Ecosystem limited** -- Only the first 3 messages in an ecosystem exchange are free.

### Basic ($14.99/month)
- **40 messages per hour** -- A larger sliding window. No monthly cap.
- **Memory active (50 stored, 3 in prompt)** -- The AI stores up to 50 facts about the user and pulls the 3 most relevant ones into each conversation. Characters will remember your name, preferences, inside jokes, etc.
- **5 squad members** -- One extra character slot.
- **25 context messages** -- The AI reads more of the recent conversation, so it stays on topic better.
- **Full ecosystem access** -- No limits on ecosystem chat.
- **Wallpapers and custom names** -- Can change chat wallpaper and rename characters.

### Pro ($19.99/month)
- **Unlimited messages** -- No hourly or monthly limits at all.
- **Full memory (unlimited stored, 5 in prompt)** -- No cap on stored memories, and the AI uses up to 5 relevant memories per message. This gives the richest, most personalized experience.
- **6 squad members** -- Maximum squad size.
- **35 context messages** -- The deepest conversation context available.
- **Everything in Basic** plus priority response speed.

**What "context messages" means in practice:** When a user sends a message, the AI reads the last N messages of conversation history to understand what everyone has been talking about. More context = the AI stays on topic better and gives more relevant replies.

**What "memories in prompt" means:** Memories are separate from chat history. They are long-term facts the AI has learned about the user (like their name, hobbies, relationships). "In prompt" means how many of these facts the AI actually uses when generating a reply. Free users have memories saved for later (if they upgrade), but the AI doesn't use them yet.

---

## 3. How Billing Works

All payments go through **Dodo Payments**. Here is the flow:

1. **User subscribes** -- They visit the pricing page inside the app and choose Basic or Pro. Dodo Payments handles the checkout.
2. **Webhook fires** -- When the payment succeeds, Dodo sends a webhook to our server. The server automatically upgrades the user's tier.
3. **Tier updates instantly** -- The user's profile is updated and they immediately get access to their new tier's features. If they had squad members removed during a downgrade, those members are automatically restored.
4. **Purchase celebration** -- The next time the user opens chat after subscribing, their AI friends congratulate them on the upgrade.
5. **Renewals** -- Monthly renewals are handled automatically. A webhook confirms each successful renewal.
6. **Cancellations** -- When a subscription is cancelled or expires, a webhook fires and the user is downgraded back to Free. If they have more squad members than the Free tier allows, they are prompted to choose which to keep.
7. **Customer portal** -- Users can manage their subscription (cancel, update payment method) through the Dodo Payments customer portal, accessible from the settings page in the app.

**Orphaned payments:** If a webhook fires but the system can't find the user by their Dodo customer ID, it tries to match by email as a fallback. If that also fails, the event is logged as "orphaned" so you can investigate manually.

---

## 4. Features Explained

### Chat
The main feature. Users send messages in a group chat and AI characters respond in character. Multiple characters may reply to a single message. Each character has their own typing speed and style. The AI uses the user's tier limits to decide how many tokens to generate and how much context to use.

### Memory System
The AI automatically learns facts about the user from conversation. These are sorted into categories:

- **identity** -- Name, age, location, occupation, etc.
- **preference** -- Favorite things, likes, dislikes
- **life_event** -- Milestones, achievements, important happenings
- **relationship** -- Friends, family, partners mentioned
- **inside_joke** -- Recurring jokes or references from past chats
- **routine** -- Daily habits, schedules, patterns
- **mood** -- Emotional states and tendencies
- **topic** -- Subjects the user frequently discusses
- **compacted** -- Older memories that have been merged together to save space

Memories are stored as vector embeddings (a technical way of organizing text so the AI can find the most relevant memories by meaning, not just keywords). When the user sends a message, the system retrieves the memories most relevant to the current conversation.

Only facts about the user are stored. The AI does not memorize its own character behavior.

### Ecosystem Mode
In ecosystem mode, characters don't just respond to the user -- they also respond to each other. A character might:
- React to what another character said
- Start a side conversation
- Follow up on a topic after a pause

This creates a lively group chat feel. Free users get a taste (first 3 ecosystem messages), while Basic and Pro users get unlimited ecosystem chat.

### Wallpapers
Users can customize their chat background. There are 7 wallpapers available:
- Default
- Neon
- Soft
- Aurora
- Sunset
- Graphite
- Midnight

Wallpaper selection is available for Basic and Pro users.

### Custom Character Names
Basic and Pro users can rename any character in their squad. For example, renaming "Kael" to a friend's name for fun.

### Memory Vault
A section in the app where users can see all the memories the AI has stored about them. Users can view and delete individual memories. This gives users transparency and control over what the AI remembers.

### Capture Moment
Users can screenshot a particularly funny or memorable chat moment. This captures the visible chat as an image they can save or share.

---

## 5. Admin Panel Guide

### Accessing the Admin Panel
- **URL:** Go to your app URL followed by `/admin` (for example: `https://mygang.ai/admin`)
- **Login:** Enter the admin email and password. These are set via environment variables (see Section 7).
- **Session:** Once logged in, your session lasts 12 hours. After that, you will need to log in again.
- **Security:** The session cookie is httpOnly and secure (cannot be stolen by browser scripts).

### Brute-Force Protection
- **5 failed login attempts within 10 minutes** triggers a 15-minute lockout.
- Lockout applies per email+IP combination AND per IP address separately.
- During lockout, no login attempts are accepted -- even with the correct password.
- After 15 minutes, the lockout clears automatically.

### Overview Page (/admin/overview)

This is your dashboard. It shows:

**Top-level stats:**
- Total users
- Pro users count
- Low-cost mode users count
- Total chat rows (all-time messages)
- Chat rows in the last 24 hours
- Active users in the last 24 hours (unique users who chatted)
- Total memories stored

**Route Health (last 24 hours):**
- Route calls -- Total API calls to the chat endpoint
- Capacity blocks (429) -- Times the AI provider was at capacity and couldn't respond
- 500 errors -- Server errors
- Average latency -- How long responses take on average

**Source Mix (last 24 hours):**
- User -- Messages triggered by the user typing
- Autonomous -- Characters responding to each other (ecosystem)
- Autonomous Idle -- Characters chatting during quiet periods

**Provider Mix (last 24 hours):**
- OpenRouter -- Primary AI provider
- Fallback -- Backup provider when OpenRouter is unavailable

**Global Low-Cost Override:**
A toggle that forces all chat requests to use low-cost mode (shorter, cheaper AI responses). Use this if you need to reduce costs quickly across the entire app.

**Quick Operations:**
- Enable/Disable Low-Cost For All -- Turns low-cost mode on or off for every user
- Reset All Daily Counters -- Sets every user's daily message count back to zero

**Recent Chat Activity:**
Shows the last 12 chat rows with the character name, user ID snippet, and timestamp.

**Admin Audit Log:**
Shows the last 12 admin actions (who did what and when). Every admin action is recorded here for accountability.

### Users Page (/admin/users)

Shows the 40 most recently active users. For each user you can see:

- **Username** (or first 8 characters of their UUID if no username set)
- **Full UUID** -- Their unique user ID
- **Tier** -- Free, Basic, or Pro
- **Daily Count** -- Messages sent today
- **Messages 24h** -- Messages in the last 24 hours
- **Messages Total** -- All-time message count
- **Low-Cost Mode** -- Whether low-cost is enabled for this user
- **Last Reset** -- When their daily counter was last reset
- **Last Active** -- When they last used the app
- **Created** -- When they signed up

**Per-user actions (buttons next to each user):**
- **Set Tier** -- Change their subscription tier using the dropdown (Free/Basic/Pro) and clicking "Set"
- **Low-Cost: Enable/Disable** -- Toggle low-cost mode for this specific user
- **Reset Daily Usage** -- Set their daily message count back to zero
- **Delete Chat History** -- Permanently delete all their chat messages (you will be asked to confirm)

**Bulk controls:**
- Reset Daily Usage (all users)
- Enable Low-Cost For All
- Disable Low-Cost For All

---

## 6. Managing Users

### How to Change a User's Tier
1. Go to `/admin/users`
2. Find the user in the list
3. Use the dropdown next to their name to select Free, Basic, or Pro
4. Click "Set"
5. A confirmation banner will appear at the top of the page

Note: This manually overrides their tier. It does not create or cancel a Dodo Payments subscription. Use this for giving free upgrades, troubleshooting, or fixing webhook issues.

### How to Reset Usage
1. Go to `/admin/users`
2. Find the user
3. Click "Reset Daily Usage"
4. Their daily message counter goes back to zero

Use this if a user reports being incorrectly rate-limited or if you need to give someone a fresh start.

### How to Delete Chat History
1. Go to `/admin/users`
2. Find the user
3. Click "Delete Chat History"
4. Confirm in the popup dialog

**Warning: This is permanent and cannot be undone.** All of that user's chat messages are deleted from the database. Their memories are not affected (those are stored separately). Only use this if the user requests it or there is a specific reason to wipe their history.

### How to Enable/Disable Low-Cost Mode
Low-cost mode makes the AI generate shorter, cheaper responses for a specific user. This is useful for managing costs.

**For one user:**
1. Go to `/admin/users`
2. Find the user
3. Click "Low-Cost: Enable" or "Low-Cost: Disable"

**For all users at once:**
1. Go to `/admin/users` or `/admin/overview`
2. Click "Enable Low-Cost For All" or "Disable Low-Cost For All"

**Global override (from Overview page):**
The global low-cost override on the Overview page forces low-cost mode for every request, regardless of individual user settings. This is the fastest way to cut costs in an emergency.

---

## 7. Environment Variables

These are the settings the app needs to run. They are stored in Vercel (not in local files). If any are missing, the feature they power will not work.

### Supabase (Database and Auth)
- `NEXT_PUBLIC_SUPABASE_URL` -- Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Public anonymous key for client-side access
- `SUPABASE_SERVICE_ROLE_KEY` -- Secret service role key for server-side admin operations (never expose this publicly)

### Dodo Payments (Billing)
- `DODO_PAYMENTS_API_KEY` -- API key for creating subscriptions and accessing customer portal
- `DODO_PAYMENTS_WEBHOOK_KEY` -- Secret key for verifying incoming webhook signatures
- `DODO_PRODUCT_BASIC` -- Product ID for the Basic plan in Dodo Payments
- `DODO_PRODUCT_PRO` -- Product ID for the Pro plan in Dodo Payments
- `DODO_PAYMENTS_ENVIRONMENT` -- Set to `live_mode` for production, or `test_mode` for testing

### AI Provider
- `OPENROUTER_API_KEY` -- API key for OpenRouter (the AI service that powers character responses)

### Upstash Redis (Rate Limiting)
- `UPSTASH_REDIS_REST_URL` -- Redis instance URL
- `UPSTASH_REDIS_REST_TOKEN` -- Redis access token

These are required in production. Without them, the app will reject all chat requests (fail-closed behavior) and admin login lockout will block all attempts.

### Admin Panel
- `ADMIN_PANEL_EMAIL` -- The email address used to log in to the admin panel
- `ADMIN_PANEL_PASSWORD_HASH` -- The hashed password for admin login (PBKDF2 salt:key format or legacy SHA-256 hex)
- `ADMIN_PANEL_SESSION_SECRET` -- A secret string (at least 32 characters) used to sign admin session cookies

### Site
- `NEXT_PUBLIC_SITE_URL` -- The public URL of the app (for example: `https://mygang.ai`). Used for auth redirects, sitemap, and robots.txt.

---

## 8. Troubleshooting

### User can't log in
- Check Supabase Auth dashboard to see if their account exists and is not banned.
- Have them try resetting their password through the app's forgot-password flow.
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly in Vercel.

### User paid but didn't get upgraded
- Go to `/admin/users` and check their current tier.
- Check the billing_events table in Supabase for orphaned events (event_type ending in `.orphaned`).
- If the webhook failed to match the user, you can manually set their tier from the admin panel.
- Verify `DODO_PAYMENTS_WEBHOOK_KEY` matches the key in the Dodo Payments dashboard.

### Webhook not firing
- Check the Dodo Payments dashboard to see if the webhook URL is configured correctly. It should point to `https://your-domain.com/api/webhook/dodo-payments`.
- Make sure `DODO_PAYMENTS_WEBHOOK_KEY` is set in Vercel and matches the Dodo dashboard.
- Check Vercel function logs for any errors from the webhook handler.

### Rate limiting not working
- Make sure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel.
- Without Redis in production, the app will reject ALL chat requests as a safety measure.
- Check the Upstash dashboard to make sure the Redis instance is active and not over its quota.

### Admin panel locked out
- If you entered the wrong password 5 times in 10 minutes, you are locked out for 15 minutes. Just wait.
- If you forgot the password entirely, generate a new hash and update `ADMIN_PANEL_PASSWORD_HASH` in Vercel.
- If sessions are behaving strangely, rotate `ADMIN_PANEL_SESSION_SECRET` in Vercel. This will invalidate all existing admin sessions and require a fresh login.

### AI responses are slow or failing
- Check the Route Health section on the admin Overview page.
- If you see many 429 (capacity block) errors, the AI provider is overloaded. The app has automatic fallback, but response quality may decrease.
- If you see 500 errors, check Vercel function logs for details.
- As a temporary measure, enable the global low-cost override to reduce load on the AI provider.

### Characters not responding in ecosystem mode
- Ecosystem mode only works for Basic and Pro users (Free gets first 3 messages only).
- Check that the user's tier is correct in the admin panel.
- Ecosystem responses are triggered automatically and may have a short delay.
