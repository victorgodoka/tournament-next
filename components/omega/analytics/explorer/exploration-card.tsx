import Image from 'next/image'
import Link from 'next/link'
import { LocalTime } from '@omega/profile/local-time'
import type { Exploration, Variables, Visibility } from '@utils/explorer'

const TECHNIQUE_LABEL: Record<string, string> = { table: 'Table', heatmap: 'Heatmap', bars: 'Bars', line: 'Line' }
const VISIBILITY_LABEL: Record<Visibility, string> = { private: 'Private', link: 'Link only', public: 'Public' }

type ExplorationCardProps = {
  /** A duelist's exploration, or a global one (no visibility, has a description). */
  exploration: Pick<Exploration, 'name' | 'config' | 'updatedAt'> & { visibility?: Visibility; description?: string }
  variables: Variables
  href: string
  /** Shown on the public feed, where explorations come from many duelists. */
  owner?: { name: string; avatar: string | null }
  /** The owner's own list: say who can open each one. */
  showVisibility?: boolean
}

/** One exploration as a list entry: name, technique, what it measures, and when it last changed. */
export const ExplorationCard = ({ exploration: e, variables, href, owner, showVisibility }: ExplorationCardProps) => {
  const dim = (d: string) => variables.dimensions.find((x) => x.id === d)?.label ?? d
  const metric = (m: string) => variables.metrics.find((x) => x.id === m)?.label ?? m
  const { config } = e
  return (
    <li className="bg-surface-000">
      <Link href={href} className="group flex h-full flex-col gap-2 px-5 py-4.5 hover:bg-surface-100">
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-ink display-5 group-hover:text-gold">{e.name}</span>
          {showVisibility && e.visibility && e.visibility !== 'public' ? (
            <span className="shrink-0 border border-ink-muted px-2 py-1 text-ink-muted signal-chip">{VISIBILITY_LABEL[e.visibility]}</span>
          ) : null}
          <span className="shrink-0 border border-line px-2 py-1 text-ink-dim signal-chip">{TECHNIQUE_LABEL[config.technique] ?? config.technique}</span>
        </span>
        <span className="text-ink-dim body-sm">
          {config.values.map(metric).join(', ')}
          {config.rows.length ? ` by ${config.rows.map((d) => dim(d).toLowerCase()).join(', ')}` : ''}
          {config.columns ? ` × ${dim(config.columns).toLowerCase()}` : ''}
        </span>
        {e.description ? (
          <span className="line-clamp-3 text-ink-muted body-sm">{e.description}</span>
        ) : config.filters.length ? (
          <span className="text-ink-muted mono-note">{config.filters.map((f) => `${dim(f.dimension)} = ${f.value ?? 'Unknown'}`).join(' · ')}</span>
        ) : null}
        <span className="mt-auto flex items-center gap-2 pt-1 text-ink-muted signal-sm">
          {owner ? (
            <>
              {owner.avatar ? <Image src={owner.avatar} alt="" width={20} height={20} className="size-5 border border-line object-cover" /> : null}
              <span className="normal-case text-ink-dim">{owner.name}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          Updated <LocalTime iso={e.updatedAt} options={{ dateStyle: 'medium' }} />
        </span>
      </Link>
    </li>
  )
}
