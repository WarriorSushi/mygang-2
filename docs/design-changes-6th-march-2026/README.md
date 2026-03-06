# Design Changes — 6th March 2026

Investigation and documentation of visual/contrast issues discovered during a design audit.

## Documents

1. **[01-avatar-bug-analysis.md](./01-avatar-bug-analysis.md)** — Root cause analysis of avatar images not showing after custom naming. Traced to localStorage hydration serving stale `activeGang` data without avatar URLs.

2. **[02-light-mode-contrast-audit.md](./02-light-mode-contrast-audit.md)** — 19 contrast/visibility issues found across 11 files. Includes severity ratings (Critical/High/Medium) and specific fix suggestions for each.

3. **[03-wallpaper-contrast-matrix.md](./03-wallpaper-contrast-matrix.md)** — Complete matrix of all 7 wallpapers x 2 themes (light/dark). Documents CSS gradient values, readability protection layers, and recommended light mode alpha values.

## Priority Order for Fixes

1. Avatar bug (stale localStorage hydration)
2. Critical light mode issues (InlineToast invisible, scroll button broken)
3. High severity amber/badge colors
4. Light mode wallpaper CSS variants
5. Medium severity opacity tweaks
