/**
 * Shared skin for the masthead. Every control in the header (nav links, the burger, the account
 * button) is the same 64px-tall, hairline-separated slab, so the whole strip reads as one ruled
 * band. Kept here because the bar is split across `Navbar` (logo + links) and `Header` (account + CTA).
 * Hover fills rather than tints; the current page keeps ink with a 2px gold underline.
 */
export const CELL = "flex min-h-16 shrink-0 items-center gap-1.75 px-4.5 whitespace-nowrap signal-nav"
export const CELL_IDLE = "text-ink-muted hover:bg-gold hover:text-gold-on"
export const CELL_ON = "text-ink shadow-current hover:bg-gold hover:text-gold-on"

/** Dropdown pane. Pair with `left-0` or `right-0` to pick the edge it hangs from. */
export const PANEL = "absolute top-full z-(--z-dropdown) min-w-58 border border-line-strong bg-surface-000 shadow-offset-void-sm"
export const PANEL_ITEM = "flex items-center gap-2.5 border-b border-line px-4 py-3 whitespace-nowrap text-ink signal-nav last:border-b-0 hover:bg-gold hover:text-gold-on"
/** Section heading inside a panel or the mobile sheet. */
export const PANEL_RULE = "border-b border-line bg-ground-soft px-4 pt-2.25 pb-1.75 text-ink-muted signal-sm"

export const MOBILE_ITEM = "flex min-h-12.5 items-center gap-2.5 border-b border-line px-5 text-ink signal-nav hover:bg-gold hover:text-gold-on"
