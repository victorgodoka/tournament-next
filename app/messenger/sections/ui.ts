import { twMerge } from "tailwind-merge";

export const MICRO_LABEL = "block text-ink-muted signal-sm"
export const HINT = "font-mono text-[10px] tracking-[.1em] text-ink-muted"
export const FIELD = "w-full border border-surface-400 bg-surface-200 px-2.75 py-2.25 text-ink placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
export const SMALL_BUTTON = "cursor-pointer border px-2.5 py-1.25 signal-chip disabled:cursor-not-allowed disabled:border-surface-400 disabled:bg-surface-400 disabled:text-ink-muted"

/** TabBar tab: the active one takes a ground, an ink shift and a 2px gold underline at once. */
export const tabClass = (isActive: boolean) => twMerge(
  "min-h-11 flex-1 cursor-pointer px-2.5 signal-tab",
  isActive ? "bg-ground-soft text-ink shadow-tab-active" : "text-ink-muted hover:text-ink-dim",
)
