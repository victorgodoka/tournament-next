/**
 * Shared skin for the SiteNav. Kept here because the bar is split across `Navbar` (mark + links) and
 * `Header` (account + CTA). Links are mono on the bar; the current page keeps ink over a 2px cyan
 * underline. Hover lifts text to ink, never a fill slab.
 */
export const CELL = "flex min-h-15 shrink-0 items-center gap-1.5 px-3 whitespace-nowrap signal-strong"
export const CELL_IDLE = "text-ink-muted hover:text-ink"
export const CELL_ON = "text-ink shadow-current"

/** Floating layer: surface-100 on line-mid with the lift shadow. Pair with `left-0` or `right-0`. */
export const PANEL = "absolute top-full z-(--z-dropdown) min-w-58 border border-line-mid bg-surface-100 shadow-lift"
export const PANEL_ITEM = "flex items-center gap-2.5 border-b border-line px-4 py-3 whitespace-nowrap text-ink-dim signal-strong last:border-b-0 hover:bg-surface-300 hover:text-ink"
/** Section heading inside a panel or the mobile sheet. */
export const PANEL_RULE = "border-b border-line bg-surface-200 px-4 pt-2.25 pb-1.75 text-ink-muted signal-sm"

export const MOBILE_ITEM = "flex min-h-13 items-center justify-between gap-2.5 border-b border-line text-ink-dim signal-strong hover:text-ink"
