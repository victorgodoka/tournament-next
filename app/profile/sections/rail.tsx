import { twMerge } from "tailwind-merge";

/** Section strip: gold number, ink label, a rule to the edge, an optional provenance stamp. */
export const Rail = ({ num, label, stamp, className }: { num: string; label: string; stamp?: React.ReactNode; className?: string }) => (
  <div className={twMerge("flex items-center gap-3 border-b border-line py-3 font-mono text-base leading-5 tracking-[0.14em] text-ink-muted uppercase", className)}>
    <span className="font-bold text-gold">{num}</span>
    <h2 className="font-bold whitespace-nowrap text-ink">{label}</h2>
    <span aria-hidden className="h-px flex-1 bg-line-mid" />
    {stamp ? <span className="text-[11px] tracking-[0.16em] whitespace-nowrap max-sm:hidden">{stamp}</span> : null}
  </div>
)
