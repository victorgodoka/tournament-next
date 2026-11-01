import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

const TABS = ['live', 'standings', 'rounds', 'stats'] as const

export type Tab = (typeof TABS)[number]

/** `?tab=` as the URL has it. A live tournament opens on its live tab, a finished one on the standings; `live` only exists while it runs. */
export const tabOf = (value: unknown, live: boolean): Tab => {
  const tab = (TABS as readonly unknown[]).includes(value) ? (value as Tab) : null
  if (!tab || (tab === 'live' && !live)) return live ? 'live' : 'standings'
  return tab
}

type TournamentTabsProps = {
  id: number
  tab: Tab
  live: boolean
  /** Muted number after a label: entrants, rounds. */
  counts: Partial<Record<Tab, number>>
  /** Server-rendered panels; only the one for `tab` is sent. */
  panels: Record<Tab, React.ReactNode>
}

/** Tabs as links (`?tab=`), so the page renders on the server and each section has a URL. */
export const TournamentTabs = ({ id, tab, live, counts, panels }: TournamentTabsProps) => {
  const t = useTranslations('Tournaments.detail.tabs')
  const ts = useTranslations('Tournaments.status')
  const tabs = live ? TABS : TABS.filter((key) => key !== 'live')
  const home = live ? 'live' : 'standings'

  return (
    <>
      <nav aria-label={t('label')} className="flex w-full shrink-0 gap-7 overflow-x-auto border-b border-line">
        {tabs.map((key) => {
          const on = key === tab
          return (
            <Link
              key={key}
              href={key === home ? `/tournament/${id}` : `/tournament/${id}?tab=${key}`}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className={twMerge(
                'flex h-12 shrink-0 items-center gap-2 px-1 whitespace-nowrap signal-strong',
                on ? 'text-ink shadow-tab-active' : 'text-ink-muted hover:text-ink',
              )}
            >
              {key === 'live' ? <span aria-hidden className="size-1.5 rounded-round bg-cyan shadow-glow-live motion-safe:animate-blink" /> : null}
              {key === 'live' ? ts('live') : t(key)}
              {counts[key] !== undefined ? <span className="font-normal text-ink-muted">{counts[key]}</span> : null}
            </Link>
          )
        })}
      </nav>
      <div className="flex flex-col gap-7">{panels[tab]}</div>
    </>
  )
}
