'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { TabBar, tabPanelProps } from '@ui/tab-bar/tab-bar.component'

type Tab = 'standings' | 'rounds' | 'stats'

const TABS = ['standings', 'rounds', 'stats'] as const

/** The API's own advice for a running tournament: re-read it every 30 s until it finishes. */
const POLL_MS = 30_000

type TournamentTabsProps = {
  /** Server-rendered panels: only the tab state and the live poll run on the client. */
  standings: React.ReactNode
  rounds: React.ReactNode
  stats: React.ReactNode
  live: boolean
}

export const TournamentTabs = ({ standings, rounds, stats, live }: TournamentTabsProps) => {
  const t = useTranslations('Tournaments.detail.tabs')
  const [tab, setTab] = useState<Tab>('standings')
  const router = useRouter()

  useEffect(() => {
    if (!live) return
    // A hidden tab is nobody watching: polling it re-renders the route on the server for
    // no reader, and `router.refresh()` is not cacheable. Catch up on the way back instead.
    const refresh = () => document.visibilityState === 'visible' && router.refresh()
    const id = setInterval(refresh, POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [live, router])

  const panels = { standings, rounds, stats }

  return (
    <>
      <TabBar
        tabs={TABS.map((id) => ({ id, label: t(id) }))}
        active={tab}
        onSelect={setTab}
        label={t('label')}
        idPrefix="tournament"
        className="max-w-115"
      />
      <div {...tabPanelProps('tournament', tab)} className="pt-[clamp(18px,2.4vw,26px)]">
        {panels[tab]}
      </div>
    </>
  )
}
