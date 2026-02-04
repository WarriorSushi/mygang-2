# MyGang.ai 2.0 - Component & UI Map

## Theme Strategy: "Dual Reality"
We support **Seamless Dark/Light Mode** switching.
- **Dark (Midnight Holographic)**: Deep #050505 bg, Neon gradients, Glassmorphism with white opacity (10%).
- **Light (Solar Glass)**: Soft #F0F4F8 bg, Pastel gradients, Glassmorphism with blur and heavy shadows.

## 1. The "Squad Builder" (Onboarding)
This is the most critical flow. It uses **Aceternity UI** heavily.

### The Component: `FocusCards` or `ExpandableCardDemo`
Instead of a simple list, we use a grid of 8 cards (2 rows of 4 on desktop, swipeable on mobile).
- **State**: Default (Dimmed), Hover (Glow), Selected (Highlighted Border + Checkmark).
- **Interaction**:
    - Tap Card -> Expands slightly, plays a short voice/sound byte or shows a pithy quote.
    - Tap "Add" -> Flies into a "Squad Dock" at the bottom of the screen.
- **The Dock**: Shows 4 slots. As you fill them, they populate with avatars.
- **Validation**: "Select 4 Friends" button is disabled until exactly 4 are picked.

## 2. The Auth Wall (Gatekeeper)
A custom `Dialog` (Shadcn) that cannot be closed easily.
- **Trigger**: `onSubmit` of the Chat Input *if* `user.isGuest`.
- **Content**:
    - Header: "Wait! Don't lose the flow."
    - Body: "Save your squad and this conversation forever."
    - Visual: A preview of the message waiting to be sent.

## 3. The Chat Experience
- **Bubble Architecture**:
    - **Header**: Sticky glass bar with the 4 Active Avatars + "Vibe Meter" (Color changing pill).
    - **Message Stream**:
        - *Guest Mode*: Messages stored in `localStorage` or `sessionStorage` temporarily.
        - *Auth Mode*: Hydrated from Supabase.
    - **Typing**: "Smooth Orb" animation (3 dots that morph colors).

## 4. Light/Dark Token Map (Tailwind v4)
We define these in `globals.css` using HSL.

| Token | Dark (Midnight) | Light (Solar) |
|-------|----------------|---------------|
| `--bg-app` | `hsl(240 10% 3%)` | `hsl(210 20% 98%)` |
| `--glass-panel` | `hsla(0 0% 100% / 0.05)` | `hsla(0 0% 100% / 0.6)` |
| `--acc-primary` | `hsl(142 70% 50%)` (Neon Green) | `hsl(142 70% 40%)` (Forest Green) |
| `--text-body` | `hsl(0 0% 90%)` | `hsl(210 20% 20%)` |

## 5. Assets (Production)
- **Avatars**: We need 8 distinct, high-quality generated avatars.
    - Style: "3D Pixar/Arcane hybrid" or "Abstract Memetic".
    - Expressions: Neutral, Happy, Angry (for future expansion).
