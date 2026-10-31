import { twMerge } from 'tailwind-merge'
import { buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip'
import { SectionHead } from '@ui/section-head'
import type { Tone } from '@utils/wiki'

/** Horizontal rhythm of every wiki block, lined up with the rails on the rest of the site. */
export const WIKI_PAD = 'px-5.5 lg:px-11'

/** The right-hand column. It scrolls with the page: never sticky. */
export const WIKI_ASIDE = 'min-w-0'

/** The contents rail on the left: pins itself beside the article, one viewport tall, below the fixed header from xl. */
export const WIKI_RAIL =
  'min-w-0 lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:overflow-y-auto lg:[scrollbar-width:none] xl:top-16 xl:h-[calc(100dvh-4rem)] lg:[&::-webkit-scrollbar]:hidden'

type WikiSectionProps = {
  id?: string
  /** Ordinal shown in gold, e.g. `01`. */
  index: string
  title: string
  children?: React.ReactNode
  className?: string
}

/** A numbered wiki block with a hairline below. */
export const WikiSection = ({ id, index, title, children, className }: WikiSectionProps) => (
  <section id={id} className={twMerge('border-b border-line py-7.5', WIKI_PAD, className)}>
    <SectionHead num={index}>{title}</SectionHead>
    {children}
  </section>
)

/** Body copy, held to a readable measure. */
export const Prose = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={twMerge('mt-3.5 max-w-[62ch] text-ink-dim body', className)}>{children}</p>
)

/** Gold caution callout, for the rules that are easy to read the wrong way round. */
export const Callout = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4.5 flex gap-3 border border-cyan bg-ground-cyan px-4.5 py-4">
    <span aria-hidden className="mt-1.25 size-2.25 shrink-0 bg-cyan" />
    <p className="text-ink-dim body-sm">{children}</p>
  </div>
)

/** Hairline-separated tiles: the stat row under a title, or a pair of release dates. */
export const TileGrid = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={twMerge('mt-5 grid gap-px bg-line', className)}>{children}</div>
)

export const Tile = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="bg-space-000 px-4.5 py-3.5">
    <p className="text-ink-muted signal-sm">{label}</p>
    {children}
  </div>
)

type WikiTableProps = {
  /** CSS `grid-template-columns`, e.g. `1.4fr 1fr 1fr`. */
  template: string
  columns: string[]
  rows: { key: string; cells: React.ReactNode[] }[]
}

/** Bordered grid table. The columns are free-form so both wiki pages can share one shape. */
export const WikiTable = ({ template, columns, rows }: WikiTableProps) => (
  <div className="mt-4 border border-line">
    <div className="grid gap-3.5 border-b border-line bg-ground-soft px-4 py-2.5" style={{ gridTemplateColumns: template }}>
      {columns.map((column) => (
        <span key={column} className="text-ink-muted signal-sm">{column}</span>
      ))}
    </div>
    {rows.map(({ key, cells }) => (
      <div key={key} className="grid items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-300" style={{ gridTemplateColumns: template }}>
        {cells}
      </div>
    ))}
  </div>
)

/** Status chip for table cells. */
export const TonePill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <Chip tone={tone} className={twMerge(tone === 'neutral' && 'border-surface-400')}>{children}</Chip>
)

/** A block in the right-hand infobox. */
export const AsideBlock = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={twMerge('border-b border-line px-5 py-4 last:border-b-0', className)}>
    <p className="text-ink-muted signal-sm">{label}</p>
    {children}
  </div>
)

/** Label/value rows inside an infobox. */
export const FactRows = ({ facts }: { facts: { label: string; value: string }[] }) => (
  <div className="mt-2.5">
    {facts.map(({ label, value }) => (
      <div key={label} className="flex items-baseline justify-between gap-3.5 border-b border-line py-2 last:border-b-0">
        <span className="whitespace-nowrap text-ink-muted signal">{label}</span>
        {/* A fact with several values stores one per line; each gets its own row on the right. */}
        <span className="min-w-0 text-right text-ink body-strong">
          {value.split('\n').map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </span>
      </div>
    ))}
  </div>
)

/** The endpoints a page was rendered from, shown verbatim so a reader can check the data. */
export const SourceBlock = ({ endpoints, synced }: { endpoints: string[]; synced: string }) => (
  <AsideBlock label="Source" className="bg-ground-subtle">
    <div className="mt-2.5 flex flex-col gap-1.75">
      {endpoints.map((endpoint) => (
        <code key={endpoint} className="block border border-line bg-surface-200 px-2.25 py-1.75 text-cyan mono-note">
          {endpoint}
        </code>
      ))}
    </div>
    <p className="mt-2.5 text-ink-muted micro">{synced}</p>
  </AsideBlock>
)

export const LINK = 'text-cyan hover:text-cyan'

/** A 36px mono chip: filters, sort, tags, share links. Add `WIKI_CHIP_ON` to the pressed one. */
export const WIKI_CHIP =
  'cut inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 px-3.5 whitespace-nowrap text-ink-dim signal-strong [--cut:var(--cut-xs)] hover:text-ink hover:[--fill:var(--color-surface-300)]'
export const WIKI_CHIP_ON = 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)] hover:[--fill:var(--color-ground-cyan)]'

/** A row of chips: bleeds to the screen edges and swipes on a phone, wraps from 640px. */
export const WIKI_SCROLL_ROW =
  '-mx-gutter overflow-x-auto px-gutter [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden'

/** The wiki's card: top-right notch on a line-mid edge. */
export const WIKI_CARD = 'cut notch [--cut:var(--cut-lg)]'
/** A tile that lifts under the pointer. Links only. */
export const WIKI_TILE =
  'cut notch [--cut:var(--cut-md)] transition-[translate] duration-120 ease-out hover:-translate-y-0.5 hover:[--fill:var(--color-surface-200)] motion-reduce:transition-none'

type WikiHeadProps = {
  /** Two digits, in gold. */
  num: string
  id: string
  /** Right side: a mono stamp. */
  end?: React.ReactNode
  children: React.ReactNode
}

/** A numbered section of the wiki index, under a hairline. */
export const WikiHead = ({ num, id, end, children }: WikiHeadProps) => (
  <div className="flex flex-wrap items-baseline gap-2.5 border-t border-line pt-3.5 sm:gap-3.5 sm:pt-4">
    <span className="font-display text-xl text-gold sm:text-[22px]">{num}</span>
    <h2 id={id} className="text-[28px] text-ink display-2 sm:text-[32px]">
      {children}
    </h2>
    {end ? <span className="text-ink-muted signal-sm max-sm:basis-full sm:ml-auto">{end}</span> : null}
  </div>
)

export const GHOST_ACTION = twMerge(buttonClasses({ variant: 'secondary', size: 'mono' }), 'min-h-10.5 w-full')
