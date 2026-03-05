# Design System Deep Review

**Project:** MyGang.ai 2.0 (`C:/coding/mygangbyantig`)
**Reviewer:** Senior Design Systems Engineer
**Date:** 2026-02-18
**Scope:** UI component library, design tokens, visual consistency, accessibility, responsive design

---

## Executive Summary

The project uses a **shadcn/ui v2-style component library** built on Radix UI primitives with Tailwind CSS v4 and `class-variance-authority` (CVA). The foundation is solid -- components follow modern React patterns, the color system uses cutting-edge OKLCH tokens, and the custom holographic/glassmorphism layer adds genuine personality. However, there are meaningful gaps in accessibility, animation safety, responsive touch targets, and documentation drift that should be addressed before scaling.

**Overall Grade: B+** -- Strong foundation with production-ready base components, creative visual identity, but accessibility and consistency gaps that need focused work.

---

## 1. DESIGN SYSTEM CONSISTENCY

### What's Great

- **Uniform `data-slot` convention**: Every single UI component consistently applies `data-slot` attributes (50 total across 12 files). This is an excellent pattern for CSS targeting, testing selectors, and debugging. It shows intentional architecture.
- **CVA pattern consistency**: `button.tsx`, `badge.tsx`, `tabs.tsx`, and `label.tsx` all use `class-variance-authority` for variant management. The variant/size matrix in `button.tsx` is particularly well-structured with 6 variants and 8 sizes including icon variants.
- **Consistent `cn()` utility usage**: Every component pipes classNames through `cn()` (which wraps `clsx` + `tailwind-merge`). This is the correct pattern and applied everywhere without exception.
- **Prop spreading pattern**: Components consistently use `React.ComponentProps<>` for typing and spread remaining props, which is the modern shadcn/ui v2 approach.

### What's Inconsistent

- **Variant architecture is uneven across components**: `Button` has 6 variants + 8 sizes. `Badge` has 6 variants but no sizes. `GlassCard` has 3 variants but uses string union instead of CVA. `Avatar` has 3 sizes via `data-size` attributes instead of CVA. There is no single authoritative pattern for how variants are implemented.
- **`GlassCard` vs `Card` overlap**: Two card components exist -- `Card` (shadcn standard, `src/components/ui/card.tsx`) and `GlassCard` (custom, `src/components/holographic/glass-card.tsx`). They serve different purposes but there is no clear guidance on when to use which. `GlassCard` appears in only 2 files (glass-card itself and memory-vault), while `backdrop-blur` is used across 16 files via ad-hoc inline classes, suggesting the glassmorphism pattern is being applied inconsistently rather than through the designated component.
- **Label component uses CVA but defines no variants**: `label.tsx` imports `cva` and `VariantProps` but the `labelVariants` is just a single string with no actual variants object. This is dead complexity.

### Recommendations

1. Either standardize all variant components on CVA or adopt a different pattern for simple components. The Avatar `data-size` approach is clever but diverges from the CVA pattern used elsewhere.
2. Create a `GlassPanel` primitive that encapsulates the `backdrop-blur-xl` + `bg-*/opacity` + `border-*/opacity` pattern currently scattered across 16 files. Retire ad-hoc glassmorphism.
3. Remove unused CVA machinery from `label.tsx`.

---

## 2. COMPONENT API QUALITY

### What's Great

- **`asChild` pattern via Radix Slot**: Both `Button` and `Badge` support `asChild` prop using `Slot.Root`, enabling polymorphic rendering without sacrificing type safety. This is best-practice composability.
- **`showCloseButton` prop on DialogContent/SheetContent**: A thoughtful addition that avoids the common problem of needing to conditionally render close buttons. Clean API surface.
- **`DialogFooter` with `showCloseButton`**: Nice convenience prop that auto-renders a close button with correct Radix binding.
- **`SheetContent` `side` prop**: Clean four-direction support with corresponding slide animations. Well-implemented.
- **Avatar system composability**: `Avatar` + `AvatarImage` + `AvatarFallback` + `AvatarBadge` + `AvatarGroup` + `AvatarGroupCount` -- this is a complete, composable avatar system. The group-aware sizing via `group-data-[size=*]/avatar` selectors is sophisticated.

### What's Inconsistent

- **`GlassCard` has redundant prop declarations**: The interface explicitly declares `children`, `className`, `onClick`, and `style` -- all of which are already included in `React.HTMLAttributes<HTMLDivElement>`. This causes potential confusion and means the `...props` spread could double-apply them.
- **Missing `ref` forwarding**: None of the components use `React.forwardRef` or the newer React 19 ref-as-prop pattern. For a chat application where scroll management and focus control are critical, this is a gap. The `ScrollArea`, `Input`, `Textarea`, and `Button` components particularly need ref support for programmatic focus and scroll-to operations.
- **No loading/pending states**: Button has no `loading` variant or `isLoading` prop, which is needed for the chat send action and auth flows.

### Recommendations

1. Clean up `GlassCard` interface to extend `HTMLAttributes` without redeclaring built-in props.
2. Add ref forwarding to `Input`, `Textarea`, `Button`, and `ScrollArea` at minimum.
3. Add a `loading` state to `Button` that shows a spinner and disables interaction.

---

## 3. CSS / STYLING ANALYSIS

### What's Great

- **OKLCH color space throughout**: The entire token system in `globals.css` uses OKLCH, which is the most perceptually uniform color space available in CSS. This is genuinely forward-thinking -- 62 OKLCH values define the full light and dark palettes. This means color manipulations (opacity, mixing) will look more natural than HSL equivalents.
- **Tailwind v4 `@theme inline` usage**: The bridge between CSS custom properties and Tailwind utility classes is correctly implemented. The `@custom-variant dark` directive is the proper Tailwind v4 way to handle class-based dark mode.
- **Radius scale system**: A smart `--radius` base variable with computed derivatives (`--radius-sm` through `--radius-4xl`). This ensures consistent rounding across all components from a single control point.
- **Chat wallpaper system**: The `chat-wallpaper-layer` CSS with `data-wallpaper` attribute selectors is an elegant approach. Seven wallpapers defined entirely in CSS with consistent structure (multi-stop radial gradients + linear gradient base + repeating-linear-gradient texture overlay). The `::after` pseudo-element for the subtle line texture is a nice touch.
- **Performance-aware CSS**: `content-visibility: auto` with `contain-intrinsic-size` in the `.content-auto` class shows awareness of rendering performance for long message lists.
- **Safe-area utilities**: `.pb-safe` and `.pt-safe` using `env(safe-area-inset-*)` for notched/dynamic-island devices.

### What's Broken or Risky

- **Design doc says HSL, implementation uses OKLCH**: The `design_docs/04_UI_COMPONENTS.md` specifies tokens in HSL (`hsl(240 10% 3%)`), but the actual `globals.css` uses OKLCH. The doc is stale and misleading.
- **Hardcoded colors bypass the token system**: The `message-item.tsx` file contains an entire RGB color manipulation engine (60+ lines) that operates on raw hex values from `character.color` (e.g., `#FFD700`, `#8A2BE2`). These character colors are completely outside the design token system. While the contrast-ratio math is correct and thorough, it means character-themed UI bypasses the OKLCH palette entirely.
- **Mixed animation approaches**: CSS `@keyframes` in `globals.css` (5 custom animations) coexist with Framer Motion animations in components. There is no shared timing/easing vocabulary between them. CSS animations use `ease`, `ease-in-out`, `linear`, while Framer Motion components define their own durations.
- **Dark mode wallpaper opacity is a blanket rule**: `.dark .chat-wallpaper-layer { opacity: 0.74 }` applies to ALL wallpapers, but some wallpapers (like `midnight`) need different treatment, which is why `midnight` has a specific override. This suggests the blanket rule may not be appropriate for future wallpapers.

### Recommendations

1. Update `design_docs/04_UI_COMPONENTS.md` to reflect OKLCH reality.
2. Consider defining character colors as OKLCH values and creating a utility that works within that space, rather than maintaining a parallel RGB color system.
3. Create shared animation tokens: define easing curves and duration scales as CSS custom properties, then reference them from both CSS animations and Framer Motion configs.

---

## 4. VISUAL DESIGN

### Glassmorphism Execution

- **GlassCard quality**: The `GlassCard` component for the `default` variant uses `backdrop-blur-xl` + `bg-muted/40` + `border-border/40` -- a tasteful, not overdone implementation. The `ai` variant has appropriate dark/light differentiation (`dark:bg-white/5` vs `bg-white/90`).
- **Inconsistent glass application**: `backdrop-blur` appears across 16 files but through ad-hoc Tailwind classes, not through `GlassCard`. For example, `chat-header.tsx`, `chat-settings.tsx`, `auth-wall.tsx`, and `message-item.tsx` all apply glassmorphism directly. This means glass intensity, border opacity, and background tint vary across the app.

### Color Palette

- **Light mode**: Cool blue-tinted neutrals (hue 240) with a vivid purple accent (hue 300). Clean and modern.
- **Dark mode**: Deep blue-violet background (hue 255) with a striking **teal primary** (hue 170) and **magenta accent** (hue 325). This is a bold, distinctive palette that gives the app strong identity.
- **The primary color shifts dramatically between modes**: Light primary is a blue (hue 240), dark primary is teal-green (hue 170). This is a 70-degree hue shift. While this can work aesthetically (and creates visual interest), it means the "brand color" is not consistent across modes. Users who associate the app with blue in light mode will see a different identity in dark mode.

### Typography Hierarchy

- **`CardTitle`**: `font-semibold leading-none` (no explicit size -- inherits parent)
- **`DialogTitle`**: `text-lg leading-none font-semibold`
- **`SheetTitle`**: `font-semibold` (no size specified)
- **`CardDescription` / `DialogDescription` / `SheetDescription`**: All use `text-muted-foreground text-sm` -- consistent.
- **Issue**: Title sizing is inconsistent. `DialogTitle` has `text-lg`, `SheetTitle` and `CardTitle` have no explicit size. This means titles will render at different sizes depending on context without the consumer realizing it.

### Recommendations

1. Define a typography scale with explicit named sizes for headings, and apply consistently to all Title components.
2. Decide whether the primary hue shift between modes is intentional brand strategy or an oversight. Document the rationale.
3. Extract glassmorphism into 2-3 named utility classes or component variants to ensure consistent glass rendering.

---

## 5. ACCESSIBILITY

### What's Good

- **Screen reader text**: `sr-only` is used on close buttons in `Dialog` and `Sheet` (both include `<span className="sr-only">Close</span>`).
- **Focus-visible rings**: Consistent `focus-visible:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50` pattern across `Button`, `Input`, `Textarea`, `Badge`, `Switch`, `ScrollArea`, and `Tabs`.
- **ARIA invalid states**: `Input`, `Textarea`, `Button`, and `Badge` all handle `aria-invalid` with destructive ring styling.
- **Disabled states**: Consistent `disabled:pointer-events-none disabled:opacity-50` across interactive components.
- **Keyboard navigation in message bubbles**: `message-item.tsx` implements `onKeyDown` handlers for Enter, Space, and Escape on message bubbles. This is above-average for a chat UI.
- **Contrast calculation engine**: The `message-item.tsx` contains a full WCAG contrast ratio implementation (`channelToLinear`, `luminance`, `contrastRatio`) with a target of 7.0:1 for persona names in light mode (`ensureReadablePersonaNameOnLight`). This is AAA-level compliance for that specific element.

### What's Missing or Broken

- **Total `sr-only` count is only 5 across the entire app**: For a chat application with complex interactions (reactions, replies, typing indicators, character avatars, wallpaper selectors), this is insufficient. Key missing locations:
  - Character selection cards in onboarding (no accessible labels for screen readers)
  - Reaction buttons on messages
  - Typing indicator (no live region announcement)
  - Wallpaper picker
  - Avatar images (the `alt` text in `message-item.tsx` is just the character name, but the role/vibe context is missing)
- **No `aria-live` regions**: A chat application **must** have `aria-live="polite"` on the message list so screen readers announce new messages. This appears to be completely absent.
- **No skip navigation**: No skip-to-content link for keyboard users.
- **Dialog close button uses non-standard focus ring**: `DialogContent`'s close button uses `focus:ring-2 focus:ring-offset-2` while every other component uses `focus-visible:ring-[3px]`. This inconsistency means the close button's focus ring looks different and appears on click (not just keyboard focus).
- **`SheetContent` close button has the same issue**: Uses `focus:ring-2 focus:ring-offset-2` instead of `focus-visible`.
- **`role` attributes are sparse**: Only 5 `role=` occurrences across all components. Chat bubbles, the message list, the typing indicator, and the wallpaper picker lack semantic roles.
- **`GlassCard` with `onClick` but no keyboard handling**: When `onClick` is passed, the div becomes interactive but has no `role="button"`, `tabIndex`, or `onKeyDown` handler. This makes it inaccessible to keyboard users.

### Critical Recommendations

1. **Add `aria-live="polite"` to the message list container.** This is the single most impactful accessibility fix for a chat app.
2. **Standardize focus ring pattern**: Replace `focus:ring-*` with `focus-visible:ring-*` on Dialog and Sheet close buttons.
3. **Make `GlassCard` accessible when interactive**: When `onClick` is provided, automatically add `role="button"`, `tabIndex={0}`, and keyboard event handling.
4. **Add skip navigation** to the main layout.
5. **Add `sr-only` announcements** for typing indicators, new messages, and reaction feedback.

---

## 6. RESPONSIVE DESIGN

### What's Good

- **Mobile-first message sizing**: `max-w-[82vw] sm:max-w-[66vw] lg:max-w-[34rem]` on message bubbles is a well-thought-out responsive breakpoint chain.
- **Dialog responsiveness**: `max-w-[calc(100%-2rem)] sm:max-w-lg` ensures dialogs work on small screens with appropriate margins.
- **Sheet mobile width**: `w-3/4 sm:max-w-sm` provides a good mobile-to-desktop transition.
- **Input text size**: `text-base md:text-sm` prevents iOS zoom-on-focus (which triggers at < 16px).
- **Safe area padding**: `pb-safe` and `pt-safe` utilities for notched devices.

### What's Missing

- **Touch target sizes are inconsistent**: The `button.tsx` `xs` size is `h-6` (24px) and `icon-xs` is `size-6` (24px). The WCAG minimum touch target is 44x44px (24x24px with sufficient spacing). The reaction buttons in `message-item.tsx` and the avatar badges need audit.
- **No explicit breakpoint for tablet**: The app jumps from mobile (`sm:`) to desktop (`lg:`) with limited `md:` usage. For a chat application that could be used on iPad, this is a gap.
- **Sheet does not handle landscape mobile**: The `w-3/4` could be problematic on landscape phones where 75% width is too wide.

### Recommendations

1. Audit all touch targets against WCAG 2.5.8 (minimum 24x24px with 24px spacing) or ideally 44x44px.
2. Add `md:` breakpoint styling for tablet-specific layouts, particularly the chat view.
3. Consider a landscape-specific sheet width or using viewport height queries.

---

## 7. DESIGN TOKENS

### Color System

| Aspect | Assessment |
|--------|------------|
| Color space | OKLCH -- excellent, perceptually uniform |
| Light/dark parity | Full dual-mode coverage, 30+ tokens each |
| Semantic naming | Good (`primary`, `muted`, `destructive`, `accent`) |
| Chart colors | 5 chart colors defined for both modes |
| Sidebar tokens | Complete sidebar-specific token set |
| Character colors | **Outside token system** -- raw hex values in constants |

### Spacing Scale

The project relies on Tailwind's default spacing scale (4px base). No custom spacing tokens are defined, which is fine for Tailwind v4. However, there are inconsistencies in component internal spacing:
- `Card` uses `gap-6` + `py-6` + `px-6`
- `DialogContent` uses `gap-4` + `p-6`
- `SheetHeader` uses `gap-1.5` + `p-4`
- `SheetFooter` uses `gap-2` + `p-4`
- `DialogHeader` uses `gap-2` (no padding -- inherits from parent `p-6`)

The padding inconsistency between Dialog (inherits from content's `p-6`) and Sheet (explicit `p-4` on header/footer) means mixing Sheet and Dialog patterns will produce different spacing.

### Typography Scale

No custom typography tokens. Relies on Tailwind defaults with the Geist Sans/Mono font family defined via CSS custom properties (`--font-geist-sans`, `--font-geist-mono`). Font weights used:
- `font-medium` (labels, buttons, badges)
- `font-semibold` (titles, card titles)
- `font-bold` (button xl size only)

No `font-light` or `font-normal` explicit usage in components, suggesting body text defaults are handled implicitly.

### Recommendations

1. **Bridge character colors into the token system**: Define character theme colors as CSS custom properties that map into OKLCH space, or at minimum as a typed token map.
2. **Standardize panel padding**: Choose between `p-4` and `p-6` for overlay component internal padding and apply consistently.
3. **Consider a typography scale file**: Even if it just documents the intended hierarchy (`display`, `heading`, `subheading`, `body`, `caption`, `label`), it would help maintain consistency.

---

## 8. CHARACTER SYSTEM

### What's Great

- **Rich character data model**: Each character has `id`, `name`, `vibe`, `color`, `roleLabel`, `archetype`, `voice`, `sample`, `typingSpeed`, `tags`, `gradient`, and `avatar`. This is a thorough personality specification.
- **Color-as-identity**: Each character has a unique hex color that is used to tint their message bubbles, name labels, and avatars. The `message-item.tsx` color engine ensures these are always readable via WCAG contrast calculations.
- **Gradient system**: Each character has a Tailwind gradient string (e.g., `from-amber-200 to-yellow-500`) for richer visual expression in cards and UI accents.
- **Greeting personality**: `character-greetings.ts` provides 3 unique greetings per character with `{name}` placeholder personalization. The greetings genuinely reflect each character's personality (Luna's are empathetic, Rico's are chaotic, Nyx's are terse).
- **Typing speed differentiation**: `typingSpeed` varies from 0.8 (Nyx, fast hacker) to 1.2 (Vee, thoughtful nerd). This is a subtle but effective personality expression.

### What's Inconsistent

- **Avatar rendering diverges between contexts**: In `message-item.tsx`, avatars are rendered as raw `<Image>` + colored fallback circles. The `ui/avatar.tsx` component provides a full `Avatar` + `AvatarImage` + `AvatarFallback` system, but it does not appear to be used in the chat message context. This means there are two separate avatar rendering implementations.
- **Gradient values use Tailwind classes but character colors are hex**: The `gradient` field contains Tailwind utility classes (`from-purple-500 to-indigo-600`), which cannot be used dynamically in `style` attributes. Meanwhile `color` is a hex string used in `style`. These two color expressions for the same character use incompatible formats.
- **Character type is spread across files**: The `Character` type is defined in `chat-store`, the catalog entries add `avatar` and `roleLabel` in `characters.ts`, and `message-item.tsx` accesses `character?.color` and `character?.avatar`. The relationship between these types is not immediately clear.

### Recommendations

1. **Use the `Avatar` component in message items** instead of the custom inline implementation. Add character-specific variant support if needed.
2. **Unify color representation**: Consider storing character colors as OKLCH values with hex as a computed derivative, or at minimum create a mapping utility.
3. **Create a single `CharacterTheme` type** that is the source of truth for all character visual properties.

---

## 9. ANIMATIONS

### What's Great

- **Reduced motion support in `BackgroundBlobs`**: Uses Framer Motion's `useReducedMotion()` hook and also detects low-end devices via `navigator.deviceMemory` and `hardwareConcurrency`. When either condition is true, all blob animations are disabled. This is exemplary -- it goes beyond the basic `prefers-reduced-motion` media query.
- **Landing page and onboarding reduced motion**: `landing-page.tsx`, `loading-step.tsx`, and `welcome-step.tsx` all check `useReducedMotion`.
- **CSS animation variety**: 6 custom CSS animations (`msg-appear`, `bounce-short`, `gradient-shift`, `marquee`, `floaty`, `spin-slow`) provide a rich motion vocabulary.
- **Dialog/Sheet open/close animations**: Using `tailwindcss-animate` data-state animations (`animate-in`, `animate-out`, `fade-in-0`, `zoom-in-95`, etc.) for smooth, consistent overlay transitions.

### What's Missing or Broken

- **CSS animations lack `prefers-reduced-motion` media query**: The 6 custom CSS animations in `globals.css` (`animate-msg-appear`, `animate-bounce-short`, `animate-gradient`, `animate-marquee`, `animate-floaty`, `animate-spin-slow`) have **no** `@media (prefers-reduced-motion: reduce)` override. A search for `prefers-reduced-motion` in the entire `src/` directory returns zero results. This means:
  - Message appear animations play regardless of user preference
  - Gradient shifts, marquee scrolling, and floating animations play for users who have requested reduced motion
  - Only Framer Motion animations (which use JS-level detection) respect the preference
- **Animation timing is inconsistent**: `msg-appear` is 0.2s, `bounce-short` is 0.5s (plays twice), `gradient-shift` is 12s, `marquee` is 24s, `floaty` is 6s, `spin-slow` is 30s. There is no shared timing scale. The blob animations use 15s, 20s, 25s. Dialog animations use 200ms. Sheet open is 500ms but close is 300ms.
- **No animation composition guidance**: With both CSS animations and Framer Motion in use, there is no documentation or convention about when to use which approach.

### Critical Recommendations

1. **Add `prefers-reduced-motion` media query to `globals.css`**: At minimum:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .animate-msg-appear,
     .animate-bounce-short,
     .animate-gradient,
     .animate-marquee,
     .animate-floaty,
     .animate-spin-slow {
       animation: none !important;
     }
   }
   ```
2. **Define a timing scale**: e.g., `--duration-fast: 150ms`, `--duration-normal: 250ms`, `--duration-slow: 500ms`, `--duration-ambient: 10s`. Reference these from both CSS and JS animations.
3. **Document animation approach**: CSS animations for simple state changes, Framer Motion for orchestrated/interactive/physics-based animations.

---

## 10. WALLPAPER SYSTEM

### What's Great

- **Pure CSS implementation**: 7 wallpapers defined entirely in CSS with no JavaScript runtime cost. This is optimal for performance.
- **Typed wallpaper system**: `wallpapers.ts` exports a `ChatWallpaper` type derived from the const array, ensuring type safety between the CSS class names and TypeScript references.
- **Rich descriptive metadata**: Each wallpaper has an `id`, `label`, and `description` for UI display.
- **Subtle texture overlay**: The `::after` pseudo-element adds a repeating diagonal line pattern that gives depth without being distracting.
- **Dark mode adaptation**: Dark mode reduces wallpaper opacity from 0.92 to 0.74 and the texture overlay from 0.22 to 0.12.

### What Could Improve

- **No wallpaper preview in the picker**: The wallpaper data has no `preview` or `colors` field that could be used to render a swatch without applying the full CSS class.
- **Wallpaper `midnight` has special-case handling**: It overrides the `::after` opacity and has a completely different dark mode treatment. This suggests the wallpaper system may need per-wallpaper dark mode configuration rather than a blanket rule.

---

## 11. DOCUMENTATION DRIFT

The `design_docs/04_UI_COMPONENTS.md` has significant drift from the actual implementation:

| Doc Says | Reality |
|----------|---------|
| Uses HSL tokens (`hsl(240 10% 3%)`) | Uses OKLCH tokens |
| References "Aceternity UI" for onboarding | No Aceternity UI found in codebase |
| Specifies 4-slot Squad Dock | Actual squad size is 4 characters from 8 |
| Token named `--bg-app` | Actual token is `--background` |
| Token named `--glass-panel` | No such token exists; glassmorphism is ad-hoc |
| Token named `--acc-primary` | Actual token is `--primary` |
| Mentions "3D Pixar/Arcane hybrid" avatars | Avatar images are at `/avatars/*.png` (format unverified) |

This documentation should either be updated to reflect reality or clearly marked as aspirational/v1 design intent.

---

## 12. SUMMARY OF FINDINGS

### What's GREAT (Praise-Worthy Patterns)

1. **OKLCH color system** -- Genuinely best-in-class color engineering. Most production apps still use HSL or hex.
2. **`data-slot` convention** -- Universal, consistent, enables powerful CSS selectors and testing.
3. **BackgroundBlobs accessibility** -- Device capability detection + reduced motion + mute toggle is a model implementation.
4. **Message bubble contrast engine** -- Full WCAG luminance/contrast implementation with AAA-level persona name readability targeting.
5. **CVA + Radix + Tailwind architecture** -- The component library foundation is production-grade.
6. **Chat wallpaper CSS system** -- Performant, tasteful, well-structured.
7. **Safe area CSS utilities** -- Shows real-world mobile deployment awareness.
8. **Content visibility optimization** -- `content-visibility: auto` for performance in long message lists.
9. **Character personality depth** -- Typing speed, voice descriptions, greetings, and color identity create genuinely differentiated AI characters.
10. **Responsive message bubbles** -- The three-breakpoint `max-w` chain is well-calibrated.

### What's INCONSISTENT or BROKEN

1. **No `aria-live` region on chat message list** -- Critical accessibility gap for a chat application.
2. **CSS animations ignore `prefers-reduced-motion`** -- Only Framer Motion animations respect the preference.
3. **Focus ring inconsistency** -- Dialog and Sheet close buttons use `focus:ring` while everything else uses `focus-visible:ring`.
4. **Dual avatar rendering systems** -- `ui/avatar.tsx` component exists but chat messages use inline implementation.
5. **Glassmorphism applied ad-hoc** across 16 files instead of through `GlassCard` component.
6. **Typography hierarchy undefined** -- Title components have inconsistent sizing.
7. **Character colors exist outside design token system** -- Raw hex values with a parallel RGB math engine.
8. **Documentation is stale** -- Design doc references HSL, Aceternity UI, and non-existent tokens.
9. **Panel padding inconsistency** -- Dialog uses inherited `p-6`, Sheet uses explicit `p-4`.
10. **`GlassCard` is not keyboard-accessible** when used as an interactive element.

### Priority Improvements (Ranked)

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| P0 | Add `aria-live` to message list | High (accessibility compliance) | Low |
| P0 | Add `prefers-reduced-motion` to CSS animations | High (accessibility compliance) | Low |
| P1 | Standardize focus ring pattern across Dialog/Sheet | Medium (consistency) | Low |
| P1 | Make interactive `GlassCard` keyboard-accessible | Medium (accessibility) | Low |
| P1 | Add `sr-only` announcements for typing/reactions | Medium (accessibility) | Medium |
| P2 | Unify avatar rendering to use `Avatar` component | Medium (consistency) | Medium |
| P2 | Extract glassmorphism into shared utility/component | Medium (consistency) | Medium |
| P2 | Define typography scale for title components | Medium (consistency) | Low |
| P2 | Add ref forwarding to key components | Medium (API quality) | Medium |
| P3 | Bridge character colors into OKLCH token system | Low (architecture) | High |
| P3 | Define shared animation timing scale | Low (consistency) | Medium |
| P3 | Update design documentation | Low (maintainability) | Medium |
| P3 | Add loading state to Button | Low (completeness) | Low |

---

*End of Design System Review*
