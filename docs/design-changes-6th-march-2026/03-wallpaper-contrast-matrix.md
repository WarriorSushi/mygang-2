# Wallpaper x Theme Contrast Matrix

**Date:** 6th March 2026
**Status:** Documented, light mode CSS variants needed

## Overview

7 wallpaper options exist. Only "midnight" has a dedicated light mode CSS variant. All others use dark-optimized gradients.

**Wallpaper CSS:** `src/app/globals.css:206-300`
**Wallpaper constants:** `src/constants/wallpapers.ts`
**Selection UI:** `src/components/chat/chat-settings.tsx`
**Applied at:** `src/app/chat/page.tsx:397`

---

## Contrast Matrix

| Wallpaper | Dark Mode | Light Mode | Issues in Light |
|-----------|-----------|------------|-----------------|
| **Default** | Safe | Safe | Low opacity, minimal interference |
| **Neon** | Excellent | Marginal | Bright cyan/purple wash over timestamps |
| **Soft** | Safe | Safe | Conservative pastels, no issues |
| **Aurora** | Excellent | Marginal | Cool teal/purple similar to Neon |
| **Sunset** | Good | Marginal | Warm orange/yellow reduce text contrast |
| **Graphite** | Safe | Safe | Monochrome, best for accessibility |
| **Midnight** | Excellent | Problematic | Has light variant but confusing UX |

---

## Readability Protection Layers

| Layer | Component | Opacity | Purpose |
|-------|-----------|---------|---------|
| Wallpaper base | `.chat-wallpaper-layer` | 0.92 (light) / 0.74 (dark) | Background ambiance |
| Texture overlay | `::after` pseudo | 0.22 (light) / 0.12 (dark) | Diagonal stripe pattern |
| Header backing | `bg-card/95 backdrop-blur-xl` | 95% | Shields header text from wallpaper |
| Input backing | `bg-card/95` | 95% | Shields input from wallpaper |
| Message bubbles | Computed inline styles | 100% (opaque) | Independent of wallpaper |
| Starter chips | `bg-card/80` | 80% | Slightly translucent |
| Reply preview | `bg-card/90` | 90% | Mostly opaque |

---

## Wallpaper CSS Details

### Default
```css
/* Dark mode */
radial-gradient(circle at 18% 18%, rgba(99, 102, 241, 0.34), transparent 45%)   /* Indigo */
radial-gradient(circle at 82% 24%, rgba(34, 197, 94, 0.26), transparent 45%)    /* Green */
radial-gradient(circle at 52% 88%, rgba(236, 72, 153, 0.2), transparent 48%)    /* Pink */
linear-gradient(180deg, rgba(148, 163, 184, 0.09), rgba(30, 41, 59, 0.08))     /* Overlay */
```

### Neon
```css
radial-gradient(circle at 15% 20%, rgba(14, 165, 233, 0.42), transparent 45%)   /* Cyan */
radial-gradient(circle at 73% 22%, rgba(217, 70, 239, 0.4), transparent 42%)    /* Purple */
radial-gradient(circle at 48% 85%, rgba(34, 197, 94, 0.32), transparent 50%)    /* Green */
```

### Soft
```css
radial-gradient(circle at 20% 24%, rgba(244, 114, 182, 0.24), transparent 45%)  /* Pink */
radial-gradient(circle at 76% 26%, rgba(148, 163, 184, 0.26), transparent 40%)  /* Blue-gray */
radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.18), transparent 45%)   /* Blue */
```

### Aurora
```css
radial-gradient(circle at 10% 20%, rgba(20, 184, 166, 0.42), transparent 45%)   /* Teal */
radial-gradient(circle at 82% 22%, rgba(147, 51, 234, 0.38), transparent 42%)   /* Purple */
radial-gradient(circle at 45% 88%, rgba(96, 165, 250, 0.3), transparent 50%)    /* Blue */
```

### Sunset
```css
radial-gradient(circle at 15% 20%, rgba(251, 146, 60, 0.42), transparent 45%)   /* Orange */
radial-gradient(circle at 80% 22%, rgba(244, 63, 94, 0.34), transparent 42%)    /* Red */
radial-gradient(circle at 48% 85%, rgba(250, 204, 21, 0.28), transparent 48%)   /* Yellow */
```

### Graphite
```css
radial-gradient(circle at 18% 18%, rgba(100, 116, 139, 0.28), transparent 45%)  /* Gray */
linear-gradient(160deg, rgba(15, 23, 42, 0.28), rgba(30, 41, 59, 0.2))         /* Dark overlay */
```

### Midnight
```css
/* Dark: */ linear-gradient(180deg, #050505, #030303)
/* Light: */ linear-gradient(180deg, rgba(241, 245, 249, 0.98), rgba(226, 232, 240, 0.98))
```

---

## Required Light Mode Variants

Each wallpaper (except Midnight which already has one) needs a light mode CSS variant using the `:root:not(.dark)` or `:not(.dark)` selector. Light mode wallpapers should:

1. Use the **same hues** as their dark counterparts
2. Reduce opacity to **~30-50%** of dark mode values
3. Shift saturation slightly for better appearance on light backgrounds
4. Keep gradients subtle so text contrast isn't harmed

### Recommended light mode opacities

| Wallpaper | Dark Alpha | Light Alpha (recommended) |
|-----------|-----------|--------------------------|
| Default | 0.20–0.34 | 0.10–0.18 |
| Neon | 0.32–0.42 | 0.12–0.18 |
| Soft | 0.18–0.26 | 0.08–0.14 |
| Aurora | 0.30–0.42 | 0.12–0.18 |
| Sunset | 0.28–0.42 | 0.12–0.20 |
| Graphite | 0.20–0.28 | 0.08–0.14 |

---

## Message Text Contrast Engine

The app has a built-in contrast engine in `src/components/chat/message-item.tsx:99-130`:

- `luminance(r, g, b)` — WCAG relative luminance
- `contrastRatio(l1, l2)` — WCAG contrast ratio formula
- `pickReadableTextColor(bgHex)` — returns dark or light text based on background
- `ensureReadablePersonaNameOnLight(hex)` — darkens persona name colors to 7.0+ contrast in light mode
- `mixRgb(a, b, t)` — linear interpolation between two RGB colors

Message bubble backgrounds are computed independently of wallpaper, so primary message text is always readable. The issues are with **secondary UI elements** (timestamps, icons, badges) that sit on top of card/transparent backgrounds where wallpaper shows through.
