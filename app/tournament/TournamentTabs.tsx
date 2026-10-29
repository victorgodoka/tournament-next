import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { LivePoll } from './live-poll'

const TABS = ['standings', 'rounds', 'stats'] as const

export type Tab = (typeof TABS)[number]

/** `?tab=` as the URL has it; anything else is the standings. */
export const tabOf = (value: unknown): Tab => (TABS as readonly unknown[]).includes(value) ? (value as Tab) : 'standings'

type TournamentTabsProps = {
  id: string | number
  tab: Tab
  /** Figures shown above the tab bar, on the standings tab only. */
  summary: React.ReactNode
  /** Server-rendered panels; only the one for `tab` is sent. */
  standings: React.ReactNode
  rounds: React.ReactNode
  stats: React.ReactNode
  live: boolean
}

/** Tabs as links (`?tab=`), so the page renders on the server and each section has a URL. */
export const TournamentTabs = ({ id, tab, summary, standings, rounds, stats, live }: TournamentTabsProps) => {
  const t = useTranslations('Tournaments.detail.tabs')
  const panels = { standings, rounds, stats }

  return (
    <>
      {live ? <LivePoll /> : null}
      {tab === 'standings' ? summary : null}
      <nav aria-label={t('label')} className="flex w-full shrink-0 gap-6 overflow-x-auto border-b border-line">
        {TABS.map((key) => {
          const isActive = key === tab
          return (
            <Link
              key={key}
              href={key === 'standings' ? `/tournament/${id}` : `/tournament/${id}?tab=${key}`}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={twMerge(
                'flex min-h-11 items-center whitespace-nowrap signal-strong',
                isActive ? 'text-ink shadow-tab-active' : 'text-ink-muted hover:text-ink',
              )}
            >
              {t(key)}
            </Link>
          )
        })}
      </nav>
      <div className="flex flex-col gap-8">{panels[tab]}</div>
    </>
  )
}
