import { Suspense } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Button } from '@ui/button'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'
import { scopeQuery, statisticsHref, type Meta, type Result, type Scope, type Season } from '@utils/statistics'
import { Pickers } from './Pickers'
import { SectionTabs } from './SectionTabs'
import { BestAgainst } from './dashboard/BestAgainst'
import { HowToBeat } from './dashboard/HowToBeat'
import { MetaArticles } from './dashboard/MetaArticles'
import { MeSection } from './dashboard/MeOrTheDeck'
import { WhatToPlay } from './dashboard/WhatToPlay'
import { WhatYouFace } from './dashboard/WhatYouFace'
import { LINK_BTN, NARROW, WIDE } from './format'
import { Box, GoldDot } from './kit'

type MetaDashboardProps = {
  scope: Scope
  seasons: Season[]
  result: Result<Meta>
  /** The aggregate band had no games, so `all` is shown instead. */
  fellBack?: boolean
}

/** /statistics: the header and filters, then one tab per question a ranked player asks. */
export const MetaDashboard = async ({ scope, seasons, result, fellBack }: MetaDashboardProps) => {
  const t = await getTranslations('Statistics')
  const locale = await getLocale()
  const meta = result.ok ? result.data : null
  const season = meta?.season
  const shown = season ? { ...scope, ladder: season.ladder } : scope
  const status = result.ok ? null : result.status
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
  const faces = Object.fromEntries((meta?.decks ?? []).map((d) => [d.key, d.face ?? null]))

  return (
    <div className="flex flex-col gap-8 pt-6 max-[719px]:gap-5 max-[719px]:pt-2">
      <section className="flex flex-col gap-6 max-[719px]:gap-3">
        {season ? (
          <div className="flex items-center gap-2.5 max-[719px]:gap-2">
            <GoldDot />
            <span className={`text-ink-muted signal ${WIDE}`}>{season.sweptThrough ? t('header.eyebrow', { season: season.label, date: day(season.sweptThrough) }) : season.label}</span>
            <span className={`text-ink-muted signal-sm ${NARROW}`}>{season.sweptThrough ? t('header.eyebrowShort', { season: season.label, date: day(season.sweptThrough) }) : season.label}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 max-[719px]:gap-3">
          <div className="flex max-w-180 flex-[1_1_520px] flex-col gap-3.5 max-[719px]:gap-3">
            <h1 className="m-0 font-display text-5xl leading-none text-ink uppercase max-[719px]:text-4xl">{t('header.title')}</h1>
            <p className={`m-0 text-lg leading-7 text-ink-dim ${WIDE}`}>{t('header.lede')}</p>
            <p className={`m-0 text-ink-dim ${NARROW}`}>{t('header.ledeShort')}</p>
          </div>
          <Link href={`/statistics/activity?ladder=${shown.ladder}`} className={`${LINK_BTN} ${WIDE}`}>
            {t('header.activity')}
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor"><path d="M13 5l7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2l-4.6-4.6z" /></svg>
          </Link>
        </div>
        {/* The weekly tier list and reports first: most visitors come for them; the filters below are for digging in. */}
        <Suspense fallback={null}><MetaArticles /></Suspense>
        <Pickers scope={shown} seasons={seasons} current={season?.code ?? scope.season} bands={meta?.bands ?? []} aggregateFloor={meta?.fit.aggregateFloor ?? ''} />
        {fellBack ? <p className="m-0 text-[13px] leading-5 text-ink-dim">{t('pickers.aggregateEmpty')}</p> : null}
      </section>

      {!meta ? (
        <Box className="gap-4 p-6">
          <h2 className="m-0 display-3 text-ink">{status === 404 ? t('error.notFound') : t('error.title')}</h2>
          <p className="m-0 text-ink-dim">{status === 404 ? t('error.notFoundBody') : t('error.body')}</p>
          <Button size="signal" variant="secondary" href={statisticsHref({ ladder: scope.ladder })} className="self-start px-5">{t('error.reset')}</Button>
        </Box>
      ) : (
        <>
          {season?.endsAt ? (
            <div className="cut notch flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
              <GoldDot />
              <span className="text-ink-dim">{t('closed', { label: season.label })}</span>
            </div>
          ) : null}

          <AdVideo id="ad-video" />

          {/* Keyed by the scope: a picked deck and an open group start over with the new numbers. */}
          <div key={scopeQuery(shown)} className="flex flex-col gap-8 max-[719px]:gap-5">
            <SectionTabs
              label={t('nav.aria')}
              tabs={[
                {
                  id: 'play',
                  label: t('nav.play'),
                  panel: <WhatToPlay meta={meta} scope={shown} best={<Suspense fallback={null}><BestAgainst meta={meta} scope={shown} /></Suspense>} />,
                },
                { id: 'face', label: t('nav.face'), panel: <WhatYouFace meta={meta} scope={shown} /> },
                { id: 'beat', label: t('nav.beat'), panel: <HowToBeat meta={meta} scope={shown} /> },
                { id: 'me', label: t('nav.me'), panel: <Suspense fallback={<p role="status" className="text-[13px] leading-5 text-ink-muted">{t('me.loading')}</p>}><MeSection scope={shown} faces={faces} /></Suspense> },
              ]}
            />
            <AdBanner id="ad-bottom" placement="content" />
          </div>
        </>
      )}
    </div>
  )
}
