import { Suspense } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'
import { Skeleton } from '@omega/analytics/primitives'
import { InfographicLinks } from '@omega/infographic/infographic-links'
import { infographicHrefs, MIN_MATCHUP_GAMES, scopeQuery, statisticsHref, type Meta, type Result, type Scope, type Season } from '@utils/statistics'
import { Pickers } from './Pickers'
import { HowToBeat } from './dashboard/HowToBeat'
import { MeSection } from './dashboard/MeOrTheDeck'
import { SECTIONS, type Section } from './dashboard/sections'
import { WhatToPlay } from './dashboard/WhatToPlay'
import { WhatYouFace } from './dashboard/WhatYouFace'

const Block = ({ id, children }: { id: Section; children: React.ReactNode }) => (
  <section id={id} className="flex scroll-mt-24 flex-col gap-4">{children}</section>
)

type MetaDashboardProps = {
  scope: Scope
  seasons: Season[]
  result: Result<Meta>
  /** The deck that does best against the most played, read on the server. */
  best: { key: string; wr: number } | null
}

/** /statistics: the pickers, then one section per question a ranked player asks, then how it's counted. */
export const MetaDashboard = async ({ scope, seasons, result, best }: MetaDashboardProps) => {
  const t = await getTranslations('Statistics')
  const locale = await getLocale()
  const meta = result.ok ? result.data : null
  const season = meta?.season
  const shown = season ? { ...scope, ladder: season.ladder } : scope
  const status = result.ok ? null : result.status
  const query = Object.fromEntries(new URLSearchParams(scopeQuery(shown)))
  const date = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' })

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 border-b border-line pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <h1 className="display-2 text-ink">{t('header.title')}</h1>
            <p className="max-w-2xl text-sm text-ink-dim">{t('header.lede')}</p>
          </div>
          {season ? (
            <InfographicLinks
              label={t('infographic.label')}
              hint={t('infographic.hint')}
              busy={t('infographic.busy')}
              failed={t('infographic.failed')}
              sizes={{ wide: t('infographic.wide'), tall: t('infographic.tall') }}
              items={(['tier-list', 'meta-report'] as const).map((section) => ({ file: `${section}-${season.code}`, hrefs: infographicHrefs(`/statistics/infographic/${section}`, { ...query, locale }) }))}
              className="md:justify-end"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Pickers scope={shown} seasons={seasons} current={season?.code ?? scope.season} bands={meta?.bands ?? []} />
          <span className="flex flex-wrap gap-4 font-mono text-xs text-ink-muted">
            {season?.sweptThrough ? <span>{t('header.synced', { date: date(season.sweptThrough) })}</span> : null}
            <Link href={`/statistics/activity?ladder=${shown.ladder}`} className="text-cyan hover:underline">{t('header.activity')}</Link>
          </span>
        </div>
      </header>

      {!meta ? (
        <Panel title={status === 404 ? t('error.notFound') : t('error.title')} meta={status ? String(status) : t('error.offline')}>
          <p className="text-ink-dim body">{status === 404 ? t('error.notFoundBody') : t('error.body')}</p>
          <Button size="sm" variant="secondary" href={statisticsHref({ ladder: scope.ladder })} className="mt-4">{t('error.reset')}</Button>
        </Panel>
      ) : (
        <>
          {season?.endsAt ? (
            <div className="cut notch flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
              <span className="size-2 flex-none bg-gold" />
              <span className="text-ink-dim body">{t('closed', { label: season.label })}</span>
            </div>
          ) : null}

          <nav aria-label={t('nav.aria')} className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map((id) => <a key={id} href={`#${id}`} className="text-ink-dim signal hover:text-cyan">{t(`nav.${id}`)}</a>)}
          </nav>

          <AdVideo id="ad-video" />

          {/* Keyed by the scope: a picked deck starts over with the new numbers. */}
          <div key={scopeQuery(shown)} className="flex flex-col gap-10">
            <Block id="play"><WhatToPlay meta={meta} scope={shown} best={best} /></Block>
            <Block id="face"><WhatYouFace meta={meta} scope={shown} /></Block>
            <Block id="beat"><HowToBeat meta={meta} scope={shown} /></Block>
            <Block id="me">
              <Suspense fallback={<Skeleton rows={4} label={t('me.title')} />}><MeSection scope={shown} /></Suspense>
            </Block>
            <Panel title={t('method.title')}>
              <div className="flex max-w-3xl flex-col gap-3 text-sm text-ink-dim">
                <p>{t('method.model')}</p>
                <p>{t('method.matchups', { min: MIN_MATCHUP_GAMES })}</p>
                <p>{t('method.caveats')}</p>
              </div>
            </Panel>
            <AdBanner id="ad-bottom" placement="content" />
          </div>
        </>
      )}
    </div>
  )
}
