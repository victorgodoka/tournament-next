'use client'

/**
 * MetaDashboard — the /statistics overview: nine numbered sections as tabs, one on screen at a time (`?section=`).
 * A deck and a card each have their own page (`/statistics/archetypes/[key]`, `/statistics/cards/[id]`).
 */

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { Button } from '@ui/button'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'
import { InfographicLinks } from '@omega/infographic/infographic-links'
import { archKey, getStatistics, infographicHrefs, type OmegaActivity as OmegaActivityData, type Statistics, type StatisticsResult, type StatisticsScope } from '@utils/statistics'
import type { PastSeason, RankedLadderId } from '@utils/types'
import { OmegaActivity } from './OmegaActivity'
import { CardsSection } from './dashboard/CardsSection'
import { DashboardHeader, LISTED, type Listed } from './dashboard/DashboardHeader'
import { SECTIONS, sectionNum, type Section } from './dashboard/sections'
import { DeckComparator } from './dashboard/DeckComparator'
import { DeckRanking } from './dashboard/DeckRanking'
import { MatchupMatrix, WhatBeatsIt } from './dashboard/MatchupMatrix'
import { BusiestHours, PilotConcentration, RatingMeta, TierHistory, VsPrevious, type PreviousSeason } from './dashboard/MetaExtras'
import { MetaShape, SeasonGlance } from './dashboard/MetaOverview'
import { MetaTrendsCard } from './dashboard/MetaTrendsCard'
import { SampleDecks } from './dashboard/SampleDecks'

type MetaDashboardProps = {
  ladder: RankedLadderId
  season?: string
  /** The tab open on arrival (`?section=`); the first without one. */
  section?: Section
  /** Archetype keys the comparator opens with (`?decks=`); the top 3 without them. */
  decks?: string[]
  past: PastSeason[]
  result: StatisticsResult
  omega: OmegaActivityData | null
  /** The open season's name, for the season select. */
  openLabel: string | null
  previous: PreviousSeason | null
}

const TABS = 'stat'

/** The open tab's panel: the tab names it, so only the section's share links sit above the content. */
const Block = ({ id, end, children }: { id: Section; end?: React.ReactNode; children: React.ReactNode }) => (
  <section {...tabPanelProps(TABS, id)} className="flex flex-col gap-4">
    {end ? <div className="flex justify-end">{end}</div> : null}
    {children}
  </section>
)

export const MetaDashboard = ({ ladder, season, section, decks, past, result, omega, openLabel, previous }: MetaDashboardProps) => {
  const t = useTranslations('Statistics')
  const locale = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()
  // A longer list comes from the browser: at 50 decks the answer is past the server's data cache.
  const [longer, setLonger] = useState<Statistics | null>(null)
  const [listed, setListed] = useState<Listed>(LISTED[0])
  const [listFailed, setListFailed] = useState(false)
  const [active, setActive] = useState<Section>(section && (section !== 'activity' || omega) ? section : SECTIONS[0])

  const base = result.ok ? result.data : null
  const data = base && longer?.season.code === base.season.code ? longer : base

  const query = (l: RankedLadderId, s: string | undefined, tab: Section) =>
    `/statistics?${new URLSearchParams({ ...(s ? { ladder: l, season: s } : { ladder: l }), ...(tab === SECTIONS[0] ? {} : { section: tab }) })}`
  const go = (l: RankedLadderId, s?: string) => {
    setListed(LISTED[0])
    start(() => router.push(query(l, s, active), { scroll: false }))
  }
  // A tab is a URL (`?section=`) without a server round trip: the data on screen stays.
  const pickTab = (tab: Section) => {
    setActive(tab)
    window.history.replaceState(null, '', query(ladder, season, tab))
  }

  const pickListed = (next: Listed) => {
    setListed(next)
    setListFailed(false)
    if (next === LISTED[0]) return setLonger(null)
    getStatistics({ ladder, season, archetypes: next }).then((r) => (r.ok ? setLonger(r.data) : (setListFailed(true), setListed(LISTED[0]))))
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

  const { season: seasonData, archetypes, matchups, trends, syncedDays } = data
  const scope: StatisticsScope = { ladder, season }
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' })
  // The section as a PNG (/statistics/infographic/*), same season as on screen.
  const infographic = (section: string, extra: Record<string, string> = {}, className = 'ml-auto') => (
    <InfographicLinks
      label={t('infographic.label')}
      hint={t('infographic.hint')}
      busy={t('infographic.busy')}
      failed={t('infographic.failed')}
      sizes={{ wide: t('infographic.wide'), tall: t('infographic.tall') }}
      items={[{ file: `${section}-${seasonData.code}`, hrefs: infographicHrefs(`/statistics/infographic/${section}`, { ladder, ...(season ? { season } : {}), ...extra, locale }) }]}
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
        syncedLabel={syncedDays.first && syncedDays.last ? t('header.synced', { from: day(syncedDays.first), to: day(syncedDays.last), days: syncedDays.count, min: data.minSamples }) : t('header.noDays')}
        listed={listed}
        actions={infographic('overview', {}, 'md:justify-end')}
        onSelectLadder={(l) => go(l)}
        onSelectSeason={(s) => go(ladder, s)}
        onSelectListed={pickListed}
      />
      {listFailed ? <p role="status" className="mt-3 text-[13px] leading-5 text-ink-muted">{t('header.listFailed')}</p> : null}

      {seasonData.endsAt ? (
        <div className="cut notch mt-6 flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
          <span className="size-2 flex-none bg-gold" />
          <span className="text-ink-dim body">{t('closed', { label: seasonData.label })}</span>
        </div>
      ) : null}

      <AdVideo id="ad-video" className="mt-8" />

      {/* Keyed by season: pickers and sorts start over with the new data. */}
      <div key={seasonData.code} className="mt-10 flex flex-col gap-8">
        <TabBar
          fit
          idPrefix={TABS}
          label={t('nav.aria')}
          active={active}
          onSelect={pickTab}
          tabs={SECTIONS.filter((id) => id !== 'activity' || omega).map((id) => ({
            id,
            label: <><span className="mr-1.5 font-mono text-gold">{sectionNum(id)}</span>{t(`nav.${id}`)}</>,
          }))}
        />
        {active === 'season' ? <Block id="season"><SeasonGlance data={data} /></Block> : null}
        {active === 'meta-shape' ? (
          <Block id="meta-shape">
            <MetaShape data={data} scope={scope} />
            <RatingMeta data={data} />
            <PilotConcentration archetypes={archetypes} scope={scope} />
          </Block>
        ) : null}
        {active === 'deck-ranking' ? <Block id="deck-ranking" end={infographic('deck-ranking')}><DeckRanking data={data} scope={scope} /></Block> : null}
        {active === 'matchups' ? (
          <Block id="matchups" end={infographic('matchup-matrix')}>
            <MatchupMatrix archetypes={archetypes} matchups={matchups} scope={scope} />
            <WhatBeatsIt archetypes={archetypes} matchups={matchups} scope={scope} />
          </Block>
        ) : null}
        {active === 'compare' ? (
          <Block id="compare">
            <DeckComparator archetypes={archetypes} matchups={matchups} scope={scope} preselected={decks ? archetypes.filter((a) => decks.includes(archKey(a.archetype))) : archetypes.slice(0, 3)} infographic={(keys) => (keys.length > 1 ? infographic('comparator', { key: keys.join(',') }) : null)} />
          </Block>
        ) : null}
        {active === 'trends' ? (
          <Block id="trends" end={infographic('trends')}>
            <MetaTrendsCard archetypes={archetypes} trends={trends} seasonStartsAt={seasonData.startsAt} />
            <TierHistory trends={trends} seasonStartsAt={seasonData.startsAt} />
            {previous ? <VsPrevious archetypes={archetypes} previous={previous} /> : null}
          </Block>
        ) : null}
        {active === 'sample-decks' ? <Block id="sample-decks"><SampleDecks decks={data.sampleDecks ?? []} closed={!!seasonData.endsAt} /></Block> : null}
        {active === 'cards' ? <Block id="cards" end={infographic('cards')}><CardsSection data={data} scope={scope} /></Block> : null}
        {active === 'activity' && omega ? (
          <Block id="activity">
            <OmegaActivity data={omega} ladder={ladder} />
            <BusiestHours hours={omega.hours} />
          </Block>
        ) : null}

        <AdBanner id="ad-bottom" placement="content" />
      </div>
    </div>
  )
}
