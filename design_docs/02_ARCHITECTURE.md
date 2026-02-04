# MyGang.ai 2.0 - Technical Architecture

## 1. High-Level Stack
- **Framework**: Next.js 15 (App Router, Server Actions).
- **Language**: TypeScript.
- **Styling**: Tailwind CSS v4 + `framer-motion` (heavily used for transitions).
- **Database**: Supabase (Postgres).
- **AI Provider**: Google Gemini API (via Vercel AI SDK).
- **State Management**: `zustand` (minimal client state for chat).

## 2. The "Orchestrator" Pattern (The Secret Sauce)
Instead of making 3 parallel API calls to "simulated agents" (which is slow and expensive), we use a single "Scriptwriter" call.

### The Flow:
1.  User sends: *"I'm bored, entertain me."*
2.  **Server Action**:
    - Fetches User Profile ("Name: Ali, Vibe: Chaotic").
    - Fetches Active Gang Members (Rico, Nyx, Kael).
    - Fetches recent Chat History (~10 msgs).
3.  **Prompt Assembly**:
    - *"You are the scriptwriter for a group chat. The user Ali is bored. Write the next 1-3 messages. Characters available: Rico (Chaos), Nyx (Sarcastic)..."*
4.  **Gemini 2.0 Flash Streaming**:
    - Generates a **JSON Stream**:
      ```json
      [
        {"character": "Rico", "text": "LETS GO SKYDIVING RN!!!", "delay": 500},
        {"character": "Nyx", "text": "Rico, he said bored, not suicidal.", "delay": 1500}
      ]
      ```
5.  **Client UI**:
    - Parses the stream.
    - Shows "Rico is typing..." for 500ms.
    - Pops Rico's message.
    - Shows "Nyx is typing..." for 1000ms.
    - Pops Nyx's message.

## 3. Database Schema (Supabase)

### `profiles`
- `id` (uuid, PK)
- `username` (text)
- `subscription_tier` ('free', 'pro')
- `daily_msg_count` (int) - Resets daily via simple logic (no cron).
- `gang_vibe_score` (int) - 0 (Chill) to 100 (Chaotic). Updates based on chats.

### `gang_members`
- `user_id` (uuid, FK)
- `character_id` (text) - e.g., 'rico', 'nyx'.
- `relationship_score` (int) - How much they like the user.

### `chat_history`
- `id` (uuid)
- `user_id` (uuid)
- `speaker` (text) - 'user' or Character Name.
- `content` (text)
- `created_at` (timestamp)

## 4. Frontend "Midnight Holographic" System
- **Colors**:
    - Background: `#050505` (Not pure black, but close).
    - Primary Gradient: `linear-gradient(to right, #00f260, #0575E6)` (adjust for "Holographic" feel - cyan/magenta/purple).
    - Glassmorphism: `backdrop-filter: blur(12px); bg-opacity-10`.
- **Typography**: `Inter` (UI) + `JetBrains Mono` (Data/Stats).
- **Components**:
    - **Chat Bubble**: Not solid color. Has a subtle border-gradient and faint glow.
    - **Avatars**: Hexagons or floating circles with breathing glow effects.

## 5. Folder Structure
```
/src
  /app
    /(landing)      -> Premium Landing Page
    /(app)          -> Authenticated App Layout
      /chat         -> The Main View
      /settings     -> Managing the Gang
    /api/chat       -> Streaming Endpoint
  /components
    /holographic    -> Custom UI kit (Cards, Buttons, Inputs)
    /orchestrator   -> Chat Logic Components
  /lib
    /ai             -> Gemini Prompt Logic
    /supabase       -> DB Client
```
