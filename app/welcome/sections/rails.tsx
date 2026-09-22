import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { buttonClasses } from "@ui/button";

export const RailFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={twMerge("flex flex-wrap items-center justify-end gap-6 border-t border-line py-4.5", ROW_PAD, className)}>
    {children}
  </div>
)

export const ArrowLink = ({ href, muted, children }: { href: string; muted?: boolean; children: React.ReactNode }) => (
  <Link
    href={href}
    className={twMerge("inline-flex items-center gap-2.5 font-bold signal-nav", muted ? "text-ink-muted hover:text-ink" : "text-gold hover:text-cyan")}
  >
    <span>{children}</span>
    <span aria-hidden className="caption">→</span>
  </Link>
)

/** Row gutter shared by every list row that lines up with the rails: 22px, 44px from lg. */
export const ROW_PAD = "px-5.5 lg:px-11"

export const OUTLINE_BUTTON = buttonClasses({ variant: 'secondary', size: 'sm' })

export const GHOST_TAG = "border border-surface-400 px-2.5 py-1.25 text-ink-dim signal"
