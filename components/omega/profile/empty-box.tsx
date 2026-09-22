import { twMerge } from "tailwind-merge";

/** Boxed placeholder for anything withheld or not yet played. */
export const EmptyBox = ({ title, note, children, className }: { title: string; note?: string; children?: React.ReactNode; className?: string }) => (
  <div className={twMerge("max-w-155 border border-line-strong bg-surface-100 px-4.5 py-[clamp(24px,3vw,40px)] text-center", className)}>
    <p className="text-ink display-6">{title}</p>
    {children ? <p className="mt-2 text-ink-dim body-sm text-pretty">{children}</p> : null}
    {note ? <p className="mt-3.5 text-ink-muted signal-sm">{note}</p> : null}
  </div>
)
