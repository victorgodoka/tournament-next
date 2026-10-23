import { twMerge } from 'tailwind-merge'
import type { Size } from './infographic'

type Item = { label?: string; href: (size: Size) => string; file: string }

type InfographicLinksProps = {
  /** "Infographic" */
  label: string
  /** "Download this section as an image": the links' title. */
  hint: string
  sizes: Record<Size, string>
  items: Item[]
  className?: string
}

const LINK = 'inline-flex min-h-8 items-center border border-line px-2.5 text-ink-dim signal-sm transition-colors hover:border-cyan hover:text-cyan'

/** "Infographic: 16:9 · 9:16", once per item: plain links to the PNG routes, saved with `download`. */
export const InfographicLinks = ({ label, hint, sizes, items, className }: InfographicLinksProps) => (
  <div className={twMerge('flex flex-wrap items-center gap-2', className)}>
    <span className="text-ink-muted signal-sm">{label}</span>
    {items.map((item) => (
      <span key={item.file} className="flex items-center gap-1">
        {item.label ? <span className="mr-1 text-ink-dim signal-sm">{item.label}</span> : null}
        {(['wide', 'tall'] as const).map((size) => (
          <a key={size} href={item.href(size)} download={`${item.file}-${size === 'wide' ? '16x9' : '9x16'}.png`} title={hint} className={LINK}>
            {sizes[size]}
          </a>
        ))}
      </span>
    ))}
  </div>
)
