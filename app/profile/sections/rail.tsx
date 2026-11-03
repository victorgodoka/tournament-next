import { twMerge } from "tailwind-merge";

/**
 * Section strip, as the design system's RailHead: gold number, ink label, a rule to the edge, an
 * optional provenance stamp. Mono 11px/14px with 0.14em tracking; the stamp drops to 10px/0.16em.
 */
export const Rail = ({ num, label, stamp, className }: { num: string; label: string; stamp?: React.ReactNode; className?: string }) => (
  <div className={twMerge("flex items-center gap-3 border-b border-line py-3 text-ink-muted signal", className)}>
    <span className="shrink-0 font-bold text-gold">{num}</span>
    <h2 className="font-mono font-bold whitespace-nowrap text-ink">{label}</h2>
    <span aria-hidden className="h-px flex-1 bg-line" />
    {stamp ? <span className="whitespace-nowrap signal-sm max-sm:hidden">{stamp}</span> : null}
  </div>
)
