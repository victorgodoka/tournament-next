'use client'

/**
 * MetaDashboard — the competitive-analysis dashboard for /statistics: a sticky section nav
 * beside the content, from the meta overview down to one archetype's deep dive.
 */

import { useEffect, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { Button } from '@ui/button'
import { Segmented } from '@ui/choice'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'
import { DeepDive, nameOf } from './DeepDive'
import { DeepDiveSearch, PICKS, type RemotePick } from './DeepDiveSearch'
import { OmegaActivity } from './OmegaActivity'
import type { PastSeason, RankedLadderId } from '@utils/types'
import { archKey, type StatisticsResult, type OmegaActivity as OmegaActivityData, type DeepDiveMode } from '@utils/statistics'

import { DashboardSidebar, NAV, type NavSection } from './dashboard/DashboardSidebar'
import { DashboardHeader } from './dashboard/DashboardHeader'
import { MetaOverview } from './dashboard/MetaOverview'
import { MatchupMatrix } from './dashboard/MatchupMatrix'
import { DeckRanking } from './dashboard/DeckRanking'
import { CardsSection } from './dashboard/CardsSection'
import { DeckComparator } from './dashboard/DeckComparator'
import { ArchetypeDetailCard } from './dashboard/ArchetypeDetailCard'
import { MetaTrendsCard } from './dashboard/MetaTrendsCard'
import { SampleDecks } from './dashboard/SampleDecks'
import { InfographicLinks } from '@omega/infographic/infographic-links'

const sectionId = (s: NavSection) => `stat-section-${s}`

type MetaDashboardProps = {
  ladder: RankedLadderId
  season?: string
  past: PastSeason[]
  result: StatisticsResult
  omega: OmegaActivityData | null
  /** The open season's name, for the season select. */
  openLabel: string | null
}

export const MetaDashboard = ({ ladder, season, past, result, omega, openLabel }: MetaDashboardProps) => {
  const t = useTranslations('Statistics')
  const locale = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()

  const data = result.ok ? result.data : null

  const [activeSection, setActiveSection] = useState<NavSection>('overview')

  // Deep-dive state
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [searchRound, setSearchRound] = useState(0)
  const [searchBusy, setSearchBusy] = useState(false)
  const [ddMode, setDdMode] = useState<DeepDiveMode>(data?.views ? 'general' : 'pure')
  const [ddSeason, setDdSeason] = useState(data?.season.code ?? '')

  const [selectedArchKey, setSelectedArchKey] = useState<string | null>(null)
  // The deep dive the search shows from outside the page's data; null while the page's own pick is up.
  const [remotePick, setRemotePick] = useState<RemotePick | null>(null)

  // Scroll-spy: the nav follows the section crossing the upper third of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setActiveSection(hit.target.id.replace('stat-section-', '') as NavSection)
      },
      { rootMargin: '-25% 0px -70% 0px' },
    )
    for (const { id } of NAV) {
      const el = document.getElementById(sectionId(id))
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [data])

  const go = (l: RankedLadderId, s?: string) =>
    start(() => router.push(`/statistics?${new URLSearchParams(s ? { ladder: l, season: s } : { ladder: l })}`, { scroll: false }))

  // A new season starts the deep dive over
  if (data && ddSeason !== data.season.code) {
    setDdSeason(data.season.code)
    setDdMode(data.views ? 'general' : 'pure')
  }

  const scrollToSection = (section: NavSection) => {
    setActiveSection(section)
    document.getElementById(sectionId(section))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const openArchetype = (key: string) => {
    setSelectedArchKey(key)
    scrollToSection('archetype-analysis')
  }

  if (!data) {
    const status = result.ok ? null : result.status
    return (
      <Panel title={status === 404 ? t('error.notFound') : t('error.title')} meta={status ? String(status) : t('error.offline')} className="mt-6">
        <p className="text-ink-dim body">{status === 404 ? t('error.notFoundBody') : t('error.body')}</p>
        <Button size="sm" variant="secondary" onClick={() => start(() => router.refresh())} className="mt-4">
          {t('error.retry')}
        </Button>
      </Panel>
    )
  }

  const { season: seasonData, archetypes, matchups, mostUsed, trends, syncedDays } = data
  const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' })

  const byKey = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const pure = archetypes.filter((a) => a.archetype.length === 1)
  const focus = (focusKey && byKey.get(focusKey)) || pure[0] || archetypes[0]
  const fKey = focus ? archKey(focus.archetype) : ''
  const picks = !focus || pure.slice(0, PICKS).some((a) => archKey(a.archetype) === fKey) ? pure.slice(0, PICKS) : [...pure.slice(0, PICKS), focus]
  const rank = focus ? archetypes.indexOf(focus) + 1 : 0
  const selectedArch = (selectedArchKey && byKey.get(selectedArchKey)) || archetypes[0] || null
  // The section as a PNG (/statistics/infographic/*), same season and deck as on screen. `extra`: `key` (and `mode`) of the deck shown.
  const infographic = (section: NavSection | 'comparator', extra: Record<string, string> = {}, className = 'mb-3 justify-end') => (
    <InfographicLinks
      label={t('infographic.label')}
      hint={t('infographic.hint')}
      busy={t('infographic.busy')}
      failed={t('infographic.failed')}
      sizes={{ wide: t('infographic.wide'), tall: t('infographic.tall') }}
      items={[{ file: `${section}-${seasonData.code}`, href: (size) => `/statistics/infographic/${section}?${new URLSearchParams({ ladder, ...(season ? { season } : {}), ...extra, size, locale })}` }]}
      className={className}
    />
  )

  return (
    <div aria-busy={pending} className={twMerge('transition-opacity', pending && 'opacity-60')}>
      <DashboardHeader
        ladder={ladder}
        season={season}
        pastSeasons={past}
        openLabel={openLabel}
        syncedDaysCount={syncedDays.count}
        lastSyncedDate={syncedDays.last ? day(syncedDays.last) : undefined}
        activeSection={activeSection}
        onSelectLadder={(l) => go(l)}
        onSelectSeason={(s) => go(ladder, s)}
        onSelectSection={scrollToSection}
      />

      {seasonData.endsAt ? (
        <div className="cut notch mt-6 flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
          <span className="size-2 flex-none bg-gold" />
          <span className="text-ink-dim body">{t('closed', { label: seasonData.label })}</span>
        </div>
      ) : null}

      <AdVideo id="ad-video" className="mt-8" />

      <div className="mt-8 flex items-start gap-8">
        <DashboardSidebar activeSection={activeSection} onSelectSection={scrollToSection} />

        {/* Keyed by season: pickers, searches and sorts start over with the new data. */}
        <div key={seasonData.code} className="flex min-w-0 flex-1 flex-col gap-16">
          <section id={sectionId('overview')} aria-label={t('nav.overview')} className="scroll-mt-24">
            {infographic('overview')}
            <MetaOverview data={data} />
            {/* Server activity: secondary to the meta, a dozen small charts. Closed until asked for. */}
            {omega ? (
              <details className="group mt-4 border border-line bg-surface-100">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="uppercase text-ink">{t('activity.title')}</span>
                  <span className="text-ink-muted signal-sm">
                    <span className="group-open:hidden">{t('activity.open')}</span>
                    <span className="hidden group-open:inline">{t('activity.close')}</span>
                  </span>
                </summary>
                <div className="border-t border-line px-5 pb-6">
                  <OmegaActivity data={omega} ladder={ladder} />
                </div>
              </details>
            ) : null}
          </section>

          <section id={sectionId('trends')} aria-label={t('nav.trends')} className="scroll-mt-24">
            {infographic('trends')}
            <MetaTrendsCard archetypes={archetypes} trends={trends} events={data.metaEvents} seasonStartsAt={seasonData.startsAt} />
          </section>

          <section id={sectionId('deck-ranking')} aria-label={t('nav.deck-ranking')} className="scroll-mt-24">
            {infographic('deck-ranking')}
            <DeckRanking archetypes={archetypes} rankings={data.rankings} onPickArchetype={openArchetype} />
          </section>

          <section id={sectionId('matchup-matrix')} aria-label={t('nav.matchup-matrix')} className="scroll-mt-24">
            {infographic('matchup-matrix')}
            <MatchupMatrix archetypes={archetypes} matchups={matchups} onPickArchetype={openArchetype} />
          </section>

          <AdBanner id="ad-mid" placement="content" />

          <section id={sectionId('archetype-analysis')} aria-label={t('nav.archetype-analysis')} className="flex scroll-mt-24 flex-col gap-6">
            {infographic('archetype-analysis', selectedArch ? { key: archKey(selectedArch.archetype) } : {})}
            <ArchetypeDetailCard
              archetype={selectedArch}
              archetypes={archetypes}
              matchups={matchups}
              onOpenDeepDive={(key) => {
                setFocusKey(key)
                setDdMode('pure')
                setSearchRound((n) => n + 1)
                scrollToSection('deep-dive')
              }}
            />
            <DeckComparator archetypes={archetypes} preselected={archetypes.slice(0, 2)} infographic={(keys) => (keys.length > 1 ? infographic('comparator', { key: keys.join(',') }, 'mb-0') : null)} />
          </section>

          <section id={sectionId('cards')} aria-label={t('nav.cards')} className="scroll-mt-24">
            {infographic('cards')}
            <CardsSection season={seasonData} main={mostUsed?.main ?? []} extra={mostUsed?.extra ?? []} archetypes={archetypes} totalGames={data.totals.games} />
          </section>

          <AdBanner id="ad-mid-2" placement="content" />

          <section id={sectionId('deep-dive')} aria-label={t('nav.deep-dive')} className="flex scroll-mt-24 flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="display-3">{t('nav.deep-dive')}</h2>
              {infographic('deep-dive', remotePick ? { key: archKey(remotePick.archetype), mode: remotePick.mode } : fKey ? { key: fKey, mode: 'pure' } : {})}
            </div>
            <DeepDiveSearch
              key={`${seasonData.code}:${searchRound}`}
              season={seasonData}
              mode={ddMode}
              onMode={setDdMode}
              request={null}
              onLocal={(key) => byKey.has(key) && (setFocusKey(key), true)}
              onRemote={setRemotePick}
              onBusy={setSearchBusy}
            >
              {ddMode === 'pure' && focus ? (
                <>
                  {!searchBusy ? (
                    <Segmented
                      label={t('deepDiveSearch.archetype')}
                      options={picks.map((a) => ({ value: archKey(a.archetype), label: nameOf(a) }))}
                      value={fKey}
                      onChange={(key) => {
                        setFocusKey(key)
                        setSearchRound((n) => n + 1)
                      }}
                    />
                  ) : null}
                  <DeepDive archetype={focus} rank={rank} />
                </>
              ) : null}
            </DeepDiveSearch>
          </section>

          <section id={sectionId('sample-decks')} aria-label={t('nav.sample-decks')} className="scroll-mt-24">
            <SampleDecks decks={data.sampleDecks ?? []} />
          </section>

          <AdBanner id="ad-bottom" placement="content" />
        </div>
      </div>
    </div>
  )
}
