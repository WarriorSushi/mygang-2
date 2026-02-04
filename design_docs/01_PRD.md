# MyGang.ai 2.0 - Product Requirements Document

## 1. Vision & Core Value
**MyGang.ai** is not just another chatbot. It is a **digital entourage**. It simulates the feeling of being in a lively, 24/7 group chat with a squad of distinct personalities who know you, roast you, hype you, and—crucially—talk to *each other*.

**The "Wow" Factor**:
- **Aesthetic**: "**Holographic Duality**".
    - **Dark Mode**: "Midnight Holographic" (Deep blacks, neon accents, cyber-glass).
    - **Light Mode**: "Solar Glass" (Soft whites, prism reflections, clean Apple-like translucency).
    - *Switching must be instant and glitch-free.*
- **Dynamics**: When you text the group, they don't just answer you. They answer *each other*.

## 2. Target Audience
- Gen Z / Digital Natives seeking low-friction social interaction.
- Users wanting a "safe space" to vent or share wins.

## 3. The "Product-Level" User Journey (The Funnel)

### A. The Landing (Zero Friction)
- **Hero**: Immersive "Hero Parallax" showing a chaotic, funny group chat scrolling automatically.
- **CTA**: "Assemble Your Squad" (No email asked yet).

### B. The Selection (The Investment)
- User enters the **"Squad Builder"** interface.
- **Action**: Select exactly **4** friends from the roster of 8.
- **UI**: High-end 3D Carousel or Grid. Tapping a character plays a mini sound/animation and shows their bio.
- **Name Input**: Before proceeding, ask "What should the squad call you?" (User input).

### C. The Drop (The "Guest Mode")
- User is *immediately* dropped into the chat interface.
- **The Hook**: The Gang is **mid-argument** (e.g., about pizza toppings, aliens, or fashion). The user initiates by "interrupting" them.
- **The First Messages**: 
    - *Rico*: "PINEAPPLE BELONGS ON PIZZA FIGHT ME!!!"
    - *Cleo*: "Oh god, please stop screaming. It's culinary trash."
    - *Nyx*: "users joined. maybe they have taste."
    - *User*: Types their first opinion to break the tie.

### D. The Hook (The Auth Wall)
- **Trigger**: As the user hits **"Send"** on their first reply...
- **Action**: A beautiful glass modal slides up.
    - "Save your progress to chat with the Gang."
    - "Google / Apple / Email" Sign up.
- *Reasoning*: They are already emotionally invested in the reply they just typed. Conversion rate will be higher.

## 4. Key Feature Set (Production MVP)

### Core Chat
- **One Brain Engine**: Single AI orchestrator call Generate responses for 1-3 characters at once.
- **Streaming**: Responses stream in character-by-character.
- **Memory**:
    - **Free**: **Context Window Limit**. Remembers last ~20 messages only.
    - **Pro**: **Episodic Memory** (Vector DB). Remembers facts mentioned days/weeks ago ("You mentioned you like sushi last Tuesday").
- **Safety**: **"HBO" Mode**. 
    - Allowed: Swearing, adult themes (dating/partying), flirting/romance.
    - Blocked: Illegal acts, hate speech, extreme violence.
- **Virality**: **One-Click Screenshot**. Generates a branded, high-res image of the current chat thread for social sharing.


### The Roster (8 Archetypes)
See `03_CHARACTERS.md` for full profiles.
1. Kael (Influencer)
2. Nyx (Hacker)
3. Atlas (Ops/Dad)
4. Luna (Mystic)
5. Rico (Chaos)
6. Vee (Nerd)
7. Ezra (The Artist/Snob) - *New*
8. Cleo (The Gossip/Elite) - *New*

## 5. Technical Architecture (Production)
- **Frontend**: Next.js 15, Tailwind v4, Framer Motion.
- **Backend**: Supabase (Auth, DB, Realtime, Vector).
- **AI**: Gemini 2.0 Flash (Fast, Cheap, Multimodal).
- **Theme Engine**: `next-themes` with CSS variables for seamless HSL color switching.

## 6. Monetization
- **Free**: 30 messages/day. Standard Avatars.
- **Pro ($9/mo)**: Unlimited messages. Animated Avatars. Long-term Memory. Custom Gang Themes (extra colors).
