import { twMerge } from "tailwind-merge";

type SectionRailProps = {
  /** Ordinal shown in the accent colour, e.g. `01`. */
  index: string
  label: string
  /** Right-aligned note. Renders a divider rule when present. */
  trailing?: string
  className?: string
}

/** Numbered section header rule used to open each block of a page. */
export const SectionRail = ({ index, label, trailing, className }: SectionRailProps) => (
  <div className={twMerge("flex items-baseline gap-4 border-b border-omega-faded px-6 py-4 font-mono text-[11px] uppercase tracking-[.2em] lg:px-11", className)}>
    <span className="font-bold text-omega-magenta">{index}</span>
    <span className="text-omega-gray-light">{label}</span>
    {trailing ? (
      <>
        <span className="h-px flex-1 bg-omega-faded" />
        <span className="text-omega-gray-light">{trailing}</span>
      </>
    ) : null}
  </div>
)
