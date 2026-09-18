import { twMerge } from "tailwind-merge";

/**
 * Landing-page building blocks. Every band is full-bleed, closed by a strong rule, and alternates
 * between the page ground and the raised surface. Numbered kickers alternate gold and cyan.
 */

type BandProps = {
  id?: string
  raised?: boolean
  /** Drops the default padding, for bands whose children run edge to edge. */
  flush?: boolean
  className?: string
  children: React.ReactNode
}

/** 80px vertical, 44px gutter; 54px and 22px below md. */
export const BAND_PAD = "px-5.5 py-13.5 md:px-11 md:py-20"

export const Band = ({ id, raised, flush, className, children }: BandProps) => (
  <section id={id} className={twMerge("scroll-mt-16 border-b border-line-strong", raised && "bg-surface-100", !flush && BAND_PAD, className)}>
    {children}
  </section>
)

/** `01 / A free Master Duel alternative`: the numbered mono label above a band headline. */
export const Kicker = ({ num, tone = "gold", children }: { num: string; tone?: "gold" | "cyan"; children: React.ReactNode }) => (
  <p className={twMerge("signal-lg", tone === "gold" ? "text-gold" : "text-cyan")}>
    {num} / {children}
  </p>
)

export const BandTitle = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <h2 className={twMerge("mt-5.5 text-ink display-band", className)}>{children}</h2>
)

export const BandLead = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <p className={twMerge("mt-5 max-w-170 text-ink-dim lead", className)}>{children}</p>
)

/** Uppercase mono note used in rails and under calls to action. */
export const NOTE = "font-mono text-[11px] leading-[1.7] tracking-[.06em] text-ink-muted uppercase"

/** Row index: `01`, `02`… */
export const ROW_NUM = "font-mono text-xs tracking-[.1em]"

type RailProps = {
  /** Sidebar width in px. The landing uses 240 for argument bands and 340 for the FAQ. */
  side: React.ReactNode
  wide?: boolean
  children: React.ReactNode
}

/** Sticky label column beside the band's content; stacks below xl. */
export const Rail = ({ side, wide, children }: RailProps) => (
  <div className={twMerge("grid grid-cols-1 items-start gap-8 xl:gap-12", wide ? "xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-14" : "xl:grid-cols-[240px_minmax(0,1fr)]")}>
    <div className="xl:sticky xl:top-30">{side}</div>
    <div className="min-w-0">{children}</div>
  </div>
)
