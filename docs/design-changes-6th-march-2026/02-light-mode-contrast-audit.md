# Light Mode Contrast & Visibility Audit

**Date:** 6th March 2026
**Status:** Issues documented, fixes pending

## Summary

19 contrast/visibility issues found across 11 files. Several components are **completely invisible** in light mode.

---

## CRITICAL Issues (Component Broken)

### 1. InlineToast — Invisible in light mode
- **File:** `src/components/chat/inline-toast.tsx:24`
- **Problem:** `text-white` on `bg-black/70` — white text disappears on light backgrounds
- **Fix:** Use `text-foreground bg-card border-border` or add `dark:` variants

### 2. Scroll-to-Latest Button — Hardcoded dark
- **File:** `src/components/chat/message-list.tsx:371`
- **Problem:** `bg-black text-white border-white/25` — hardcoded dark colors
- **Fix:** Use `bg-foreground text-background border-border/25`

---

## HIGH Severity Issues (Poor Readability)

### 3. Offline Banner
- **File:** `src/app/chat/page.tsx:440`
- **Problem:** `text-amber-200` on light background = nearly invisible
- **Fix:** `text-amber-700 dark:text-amber-200`

### 4. Pro Badge (header)
- **File:** `src/components/chat/chat-header.tsx:141, 171`
- **Problem:** `text-amber-400` on `from-amber-500/20` = poor light mode contrast
- **Fix:** `text-amber-700 dark:text-amber-400`

### 5. Basic Badge (header)
- **File:** `src/components/chat/chat-header.tsx:147, 177`
- **Problem:** `text-blue-400` on `bg-blue-500/15` = poor light mode contrast
- **Fix:** `text-blue-700 dark:text-blue-400`

### 6. Capacity Mode Tooltip
- **File:** `src/components/chat/chat-header.tsx:208`
- **Problem:** `text-amber-100` = nearly white, invisible on light
- **Fix:** `text-amber-800 dark:text-amber-100`

### 7. Settings Upgrade Card
- **File:** `src/components/chat/chat-settings.tsx:95-124`
- **Problem:** All text hardcoded `text-white` — card exists on gradient background
- **Fix:** The gradient itself is dark so `text-white` should be fine IF the gradient renders. Verify gradient persists in light mode.

### 8. Admin Login Banner
- **File:** `src/app/admin/login/page.tsx:144`
- **Problem:** `text-amber-100` on `bg-amber-400/10` = invisible in light mode
- **Fix:** `text-amber-800 dark:text-amber-100`

---

## MEDIUM Severity Issues (Reduced Readability)

### 9. Message Action Icons (heart, reply)
- **File:** `src/components/chat/message-item.tsx:364, 371`
- **Problem:** `text-muted-foreground/40` = very faint at 40% opacity
- **Fix:** `text-muted-foreground/60 dark:text-muted-foreground/40`

### 10. Message Timestamps
- **File:** `src/components/chat/message-item.tsx:386, 390`
- **Problem:** `text-muted-foreground/40` at 10px = hard to read
- **Fix:** `text-muted-foreground/60 dark:text-muted-foreground/40`

### 11. "Seen by" metadata
- **File:** `src/components/chat/message-item.tsx:426`
- **Problem:** `text-muted-foreground/40` at 10px = hard to read
- **Fix:** `text-muted-foreground/60 dark:text-muted-foreground/40`

### 12. Typing Indicator Dots
- **File:** `src/components/chat/message-list.tsx:347-349`
- **Problem:** `bg-muted-foreground/60` = faint dots
- **Fix:** `bg-muted-foreground/80 dark:bg-muted-foreground/60`

### 13. Avatar Fallback Text
- **File:** `src/components/chat/message-item.tsx:34`
- **Problem:** `text-white` hardcoded — depends on avatar background color being dark
- **Fix:** Use `pickReadableTextColor()` or keep as-is if avatar bg is always dark

### 14. Memory Vault Textarea
- **File:** `src/components/chat/memory-vault.tsx:245`
- **Problem:** `bg-black/20` = nearly invisible on light backgrounds
- **Fix:** `bg-muted/40 dark:bg-black/20`

### 15. Paywall "skip the wait" text
- **File:** `src/components/billing/paywall-popup.tsx:78`
- **Problem:** `text-muted-foreground/50` at 10px = hard to read
- **Fix:** `text-muted-foreground/70 dark:text-muted-foreground/50`

### 16. Paywall strikethrough price
- **File:** `src/components/billing/paywall-popup.tsx:107-108`
- **Problem:** `text-muted-foreground/40` = nearly invisible
- **Fix:** `text-muted-foreground/60 dark:text-muted-foreground/40`

### 17. Pricing — Disabled Feature X icon
- **File:** `src/app/pricing/page.tsx:82-84`
- **Problem:** `text-muted-foreground/30` + `bg-white/5` = invisible
- **Fix:** `text-muted-foreground/50 dark:text-muted-foreground/30`, `bg-muted/30 dark:bg-white/5`

### 18. Pricing — "Current plan" button
- **File:** `src/app/pricing/page.tsx:287-294`
- **Problem:** `text-muted-foreground/50` on `bg-muted/30` = low contrast
- **Fix:** `text-muted-foreground/70 dark:text-muted-foreground/50`

### 19. Starter Chips border
- **File:** `src/components/chat/chat-input.tsx:125`
- **Problem:** `border-border/40` = faint but passable
- **Fix:** Minor — `border-border/50` would help

---

## Fix Pattern

For most issues, the pattern is:
```
Before: text-amber-200           (dark-only color)
After:  text-amber-700 dark:text-amber-200  (light + dark)

Before: text-muted-foreground/40  (too faint in light)
After:  text-muted-foreground/60 dark:text-muted-foreground/40

Before: bg-black/20              (hardcoded dark)
After:  bg-muted/40 dark:bg-black/20
```
