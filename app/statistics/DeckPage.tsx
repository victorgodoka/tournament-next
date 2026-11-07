'use client'

/** One deck's page, from `GET /statistics/decks/{key}` and the season's meta: strength, matchups and how it is built. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Button } from '@ui/button'
import { BANDS, CORE_RATE, deckHref, effectPoints, leadOf, matchupCall, MIN_MATCHUP_GAMES, statisticsHref, underFloors, type CardStat, type DeckAnswer, type DeckStat, type Matchup, type Scope, type Season, type TierRules } from '@utils/statistics'
import { cardsByIds } from '@utils/cards'
import { toOmega } from '@utils/deck/codecs/omega'
import type { WikiCard } from '@utils/wiki'
import { Pickers } from './Pickers'
import { SectionTabs } from './SectionTabs'
import { Art, at, Box, ci, CopyButton, DECK_NAME, frameColor, subFace, type Faces, GoldDot, HEAD_ROW, LINK_BTN, LocalTime, mark, n, NARROW, NUMERIC, pc, PanelTitle, ReadChip, ROW, ROWS, SectionHead, Seg, signed, Small, span, TH, TierChip, tone, Track, WIDE, type Read } from './kit'
import { nameOf } from './shared'

export type CardInfo = Pick<WikiCard, 'name' | 'kind' | 'monsterTypes'>
export type Family = { key: string; name: string; share: number; members: DeckStat[] }

type DeckPageProps = {
  answer: DeckAnswer
  season: Season
  scope: Scope
  cards: Record<number, CardInfo>
  family: Family | null
  builtAt: string | null
  tiers: TierRules | null
  aggregateFloor: string
  /** Every deck's card in the season's meta, by key: opponents and the second archetype of a mixed deck. */
  faces: Faces
}

const READ_OF = { favorable: 'good', unfavorable: 'bad', neutral: 'flat' } as const
const ladderName = (s: Season) => (s.ladder === 'genesys' ? 'Genesys' : 'TCG')
const bandOrder = (a: { band: string }, b: { band: string }) => BANDS.indexOf(a.band as (typeof BANDS)[number]) - BANDS.indexOf(b.band as (typeof BANDS)[number])

export const DeckPage = ({ answer, season, scope, cards: serverCards, family, builtAt, tiers, aggregateFloor, faces }: DeckPageProps) => {
  const t = useTranslations('Statistics.deck')
  const tRoot = useTranslations('Statistics')
  const locale = useLocale()
  const { deck, sampleDeck } = answer
  const name = nameOf(deck)
  const back = statisticsHref(scope)
  // The server's lookup can come back empty (the API refuses it without an Origin): the browser asks for what is missing.
  const [fetched, setFetched] = useState<Record<number, CardInfo>>({})
  const missing = answer.cards.map((c) => c.card).filter((id) => !serverCards[id]).join(',')
  useEffect(() => {
    if (!missing) return
    let live = true
    cardsByIds(missing.split(',').map(Number)).then(
      (found) => live && setFetched(Object.fromEntries([...found].map(([id, c]) => [id, { name: c.name, kind: c.kind, monsterTypes: c.monsterTypes }]))),
      () => {},
    )
    return () => {
      live = false
    }
  }, [missing])
  const cards = { ...fetched, ...serverCards }
  const cardName = (id: number) => cards[id]?.name ?? `#${id}`
  const cover = deck.face ?? answer.cards[0]?.card ?? null
  const versions = family && family.members.length > 1 ? family : null
  const bands = answer.byBand.filter((b) => b.band !== 'aggregate' && b.band !== 'all').sort(bandOrder)
  const sibling = versions?.members.filter((m) => m.key !== deck.key && m.tier !== null && m.wrExpected > deck.wrExpected).sort((a, b) => b.wrExpected - a.wrExpected)[0]
  // only bands whose interval clears 50%: a band of 80 games says nothing either way
  const best = bands.filter((b) => b.wrLo > 0.5).sort((a, b) => b.wrExpected - a.wrExpected)[0]
  const under = bands.filter((b) => b.wrHi < 0.5)
  const index = versions ? versions.members.findIndex((m) => m.key === deck.key) + 1 : 0

  const summary = (short: boolean) => (
    <>
      {t.rich(short ? 'summaryShort' : 'summary', { rate: pc(deck.wrExpected), b: (c) => <strong className="text-ink">{c}</strong> })}
      {best ? ` ${t('strongest', { band: best.band })}` : null}
      {under.length ? ` ${t('under50', { bands: under.map((b) => b.band).join(', ') })}` : null}
      {sibling ? ` ${t('betterVersion', { name: nameOf(sibling) })}` : null}
    </>
  )

  return (
    <div className="flex flex-col gap-8 pt-2 max-[719px]:gap-5 max-[719px]:pt-0">
      <nav aria-label={t('breadcrumb')} className={twMerge('flex flex-wrap items-center gap-2.5', WIDE)}>
        <Link href={back} className="text-cyan signal-strong hover:text-ink">{tRoot('header.title')}</Link>
        <span aria-hidden className="text-ink-muted signal">/</span>
        {versions ? (
          <>
            <Link href={`${back}#face`} className="text-cyan signal-strong hover:text-ink">{t('family', { name: versions.name, count: versions.members.length })}</Link>
            <span aria-hidden className="text-ink-muted signal">/</span>
          </>
        ) : null}
        <span aria-current="page" className="text-ink signal-strong">{name}</span>
      </nav>
      <Link href={back} className={twMerge(LINK_BTN, 'min-h-9', NARROW)}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor"><path d="M11 5l-7 7 7 7 1.4-1.4L7.8 13H20v-2H7.8l4.6-4.6z" /></svg>
        {tRoot('header.title')}
      </Link>

      {/* Header */}
      <Box className={twMerge('flex-row flex-wrap items-center gap-7 p-7', WIDE)}>
        <Art id={cover} sub={subFace(deck.key, faces)} name={name} size={116} className="border-0" />
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <GoldDot />
            <span className="text-ink-muted signal">
              {ladderName(season)} · {season.label}
              {season.endsAt ? ` · ${t('frozen')}` : builtAt ? <> · {t('updated')} <LocalTime iso={builtAt} locale={locale} day /></> : null}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="m-0 font-display text-5xl leading-none text-ink uppercase">{name}</h1>
            {deck.tier !== null ? <TierChip tier={deck.tier} /> : null}
          </div>
          <p className="m-0 max-w-170 text-lg leading-7 text-ink-dim">{summary(false)}</p>
        </div>
        <div className="flex flex-col items-start gap-3">
          {sampleDeck?.deckId ? <Button size="signal" href={`/deck-builder/${sampleDeck.deckId}`} className="px-5">{t('openBuilder')}</Button> : null}
          <Link href={`/decks?archetype=${encodeURIComponent(name)}`} className={LINK_BTN}>{t('publicDecks', { name })}</Link>
        </div>
      </Box>
      <section className={twMerge('flex flex-col gap-3.5', NARROW)}>
        <Art id={cover} sub={subFace(deck.key, faces)} name={name} size={96} className="border-0" />
        <div className="flex items-center gap-2">
          <GoldDot />
          <span className="text-ink-muted signal-sm">{ladderName(season)} · {season.label}{versions ? ` · ${t('versionOf', { index, count: versions.members.length })}` : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="m-0 font-display text-[38px] leading-none text-ink uppercase">{name}</h1>
          {deck.tier !== null ? <TierChip tier={deck.tier} /> : null}
        </div>
        <p className="m-0 text-ink-dim">{summary(true)}</p>
        {sampleDeck?.deckId ? <Button size="signal" href={`/deck-builder/${sampleDeck.deckId}`} className="w-full">{t('openBuilder')}</Button> : null}
      </section>

      <Summary deck={deck} family={versions} />

      <Pickers scope={scope} seasons={[]} bands={answer.byBand.map((b) => ({ band: b.band, games: b.games })).sort(bandOrder)} aggregateFloor={aggregateFloor} deckKey={deck.key} />

      <AdBanner id="ad-mid" placement="content" />

      <SectionTabs
        label={t('tabsAria')}
        tabs={[
          { id: 'strength', label: t('tabs.strength'), panel: <Strength answer={answer} season={season} scope={scope} bands={bands} versions={versions} tiers={tiers} /> },
          { id: 'matchups', label: t('tabs.matchups'), panel: <Matchups name={name} matchups={answer.matchups} scope={scope} faces={faces} /> },
          // only the lead's own page (`A`, not `A>B`) lists every version
          ...(versions && !deck.key.includes('>') ? [{ id: 'versions', label: t('tabs.versions'), panel: <VersionsTable deck={deck} versions={versions} scope={scope} tiers={tiers} faces={faces} /> }] : []),
          { id: 'build', label: t('tabs.build'), panel: <Build name={name} cards={answer.cards} info={cards} cardName={cardName} /> },
        ]}
      />

      <AdBanner id="ad-bottom" placement="content" />
    </div>
  )
}

/* ---------------------------------------------------------------- summary grid */

const Summary = ({ deck, family }: { deck: DeckStat; family: Family | null }) => {
  const t = useTranslations('Statistics.deck.stats')
  const cell = 'flex flex-col gap-2 bg-surface-100 px-5 py-4.5 max-[719px]:gap-1.5 max-[719px]:px-4 max-[719px]:py-3.5'
  const label = 'text-ink-muted signal max-[719px]:text-[10px] max-[719px]:leading-3 max-[719px]:tracking-[0.16em]'
  const value = 'font-display text-[40px] leading-none text-ink max-[719px]:text-[28px]'
  return (
    <section aria-label={t('aria')} className="grid gap-px border border-line bg-line grid-cols-[repeat(auto-fit,minmax(170px,1fr))] max-[719px]:grid-cols-2">
      <div className={twMerge(cell, 'col-span-2')}>
        <span className={label}>{t('expected')}</span>
        <div className="flex flex-wrap items-baseline gap-3 max-[719px]:gap-2.5">
          <span className={twMerge(value, 'max-[719px]:text-[34px]')}>{pc(deck.wrExpected)}</span>
          <span className="tracking-[0.06em] text-ink-muted signal-sm">{ci(deck.wrLo, deck.wrHi)}</span>
        </div>
        <span className="mt-1 max-[719px]:mt-0"><Track value={deck.wrExpected} low={deck.wrLo} high={deck.wrHi} lo={0.4} hi={0.7} h={14} /></span>
      </div>
      <div className={cell}>
        <span className={label}>{t('share')}</span>
        <span className={value}>{pc(deck.share)}</span>
        {family ? <Small><span className={WIDE}>{t('family', { name: family.name, share: pc(family.share) })}</span><span className={NARROW}>{t('familyShort', { share: pc(family.share) })}</span></Small> : null}
      </div>
      <div className={cell}>
        <span className={label}>{t('games')}</span>
        <span className={value}>{n(deck.games)}</span>
        <Small><span className="text-win">{t('wins', { count: n(deck.wins) })}</span> · <span className="text-loss">{t('losses', { count: n(deck.losses) })}</span><span className={WIDE}> · {t('draws', { count: n(deck.draws) })}</span></Small>
      </div>
      <div className={cell}>
        <span className={label}>{t('players')}</span>
        <span className={value}>{n(deck.players)}</span>
        <Small className={WIDE}>{t('mirrors', { share: pc(deck.mirrorShare) })}</Small>
      </div>
      <div className={twMerge(cell, NARROW)}>
        <span className={label}>{t('mirrorsShort')}</span>
        <span className={value}>{pc(deck.mirrorShare)}</span>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- 01 strength */

type Band = DeckStat & { band: string }

const Strength = ({ answer, season, scope, bands, versions, tiers }: { answer: DeckAnswer; season: Season; scope: Scope; bands: Band[]; versions: Family | null; tiers: TierRules | null }) => {
  const t = useTranslations('Statistics.deck.strength')
  const { deck } = answer
  const all = answer.byBand.find((b) => b.band === 'all')
  const siding = deck.g1Wr != null && deck.postWr != null ? (deck.postWr - deck.g1Wr) * 100 : null
  const turn = deck.firstG1Wr != null && deck.secondG1Wr != null ? (deck.firstG1Wr - deck.secondG1Wr) * 100 : null
  const pair = (a: number | null, b: number | null, sep: string) => `${a == null ? '–' : (a * 100).toFixed(1)}${sep}${b == null ? '–' : (b * 100).toFixed(1)}`
  const pts = (v: number) => t('pts', { value: signed(v) })

  return (
    <>
      <SectionHead title={t('title')} lede={<span className={WIDE}>{t('lede')}</span>} />
      <div className="grid items-stretch gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] max-[719px]:gap-4">
        <ByWeek answer={answer} season={season} />
        <ByBand rows={all ? [all, ...bands] : bands} tiers={tiers} />
      </div>

      <div className={twMerge('grid items-stretch gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]', WIDE)}>
        <Box className="gap-3.5 p-6">
          <PanelTitle>{t('siding.title')}</PanelTitle>
          <div className="grid grid-cols-2 gap-px border border-line bg-line">
            {([['g1', deck.g1Wr], ['post', deck.postWr]] as const).map(([id, rate]) => (
              <div key={id} className="flex flex-col gap-1.5 bg-surface-200 p-3.5">
                <span className="text-ink-muted signal">{t(`siding.${id}`)}</span>
                <span className="font-display text-[32px] leading-none text-ink">{pc(rate)}</span>
              </div>
            ))}
          </div>
          {siding !== null ? <p className="m-0 text-[13px] leading-5 text-ink-dim">{t.rich('siding.text', { delta: pts(siding), s: (c) => <strong className={tone(siding)}>{c}</strong> })}</p> : null}
        </Box>
        <Box className="gap-3.5 p-6">
          <PanelTitle>{t('turn.title')}</PanelTitle>
          <div className="grid grid-cols-2 gap-px border border-line bg-line">
            {([['first', deck.firstG1Wr], ['second', deck.secondG1Wr]] as const).map(([id, rate]) => (
              <div key={id} className="flex flex-col gap-1.5 bg-surface-200 p-3.5">
                <span className="text-ink-muted signal">{t(`turn.${id}`)}</span>
                <span className="font-display text-[32px] leading-none text-ink">{pc(rate)}</span>
              </div>
            ))}
          </div>
          {turn !== null ? <p className="m-0 text-[13px] leading-5 text-ink-dim">{t.rich('turn.text', { delta: pts(turn), s: (c) => <strong className={tone(turn)}>{c}</strong> })}</p> : null}
        </Box>
        {versions ? <Versions deck={deck} versions={versions} scope={scope} tiers={tiers} /> : null}
      </div>

      <div className={twMerge('grid grid-cols-2 gap-3', NARROW)}>
        <div className="cut notch flex flex-col gap-2 p-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
          <PanelTitle className="text-base">{t('siding.title')}</PanelTitle>
          <Small>{t('siding.short')}</Small>
          <span className="font-display text-[22px] leading-none text-ink">{pair(deck.g1Wr, deck.postWr, ' → ')}</span>
          {siding !== null ? <strong className={twMerge('text-sm', tone(siding))}>{pts(siding)}</strong> : null}
        </div>
        <div className="cut notch flex flex-col gap-2 p-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
          <PanelTitle className="text-base">{t('turn.title')}</PanelTitle>
          <Small>{t('turn.short')}</Small>
          <span className="font-display text-[22px] leading-none text-ink">{pair(deck.firstG1Wr, deck.secondG1Wr, ' · ')}</span>
          {turn !== null ? <strong className={twMerge('text-sm', tone(turn))}>{t('turn.shortDelta', { delta: pts(turn) })}</strong> : null}
        </div>
      </div>
      {versions ? <div className={NARROW}><Versions deck={deck} versions={versions} scope={scope} tiers={tiers} narrow /></div> : null}
    </>
  )
}

/** The deck's weeks as points on a line: the current week, still filling in, is hollow. */
const ByWeek = ({ answer, season }: { answer: DeckAnswer; season: Season }) => {
  const t = useTranslations('Statistics.deck.strength')
  const locale = useLocale()
  const weeks = [...answer.weeks].sort((a, b) => a.week - b.week)
  if (!weeks.length) return null
  const values = weeks.map((w) => w.wrExpected * 100)
  const y0 = Math.floor(Math.min(...values) / 2) * 2 - 3
  const y1 = Math.ceil(Math.max(...values) / 2) * 2 + 1
  const yp = (v: number) => ((y1 - v) / (y1 - y0)) * 100
  const grid = Array.from({ length: Math.floor((y1 - y0) / 2) }, (_, i) => y0 + 1 + i * 2).filter((v) => v % 2 === 0 && v > y0 && v < y1)
  const xs = weeks.map((_, i) => (weeks.length === 1 ? 50 : 12 + (i * 76) / (weeks.length - 1)))
  const open = (firstDay: string, i: number) =>
    i === weeks.length - 1 && season.endsAt === null && !!season.sweptThrough && Date.parse(`${firstDay}T00:00:00Z`) + 6 * 86_400_000 > Date.parse(`${season.sweptThrough}T00:00:00Z`)
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' })
  const points = weeks.map((w, i) => ({ w, x: xs[i]!, y: yp(w.wrExpected * 100), open: open(w.firstDay, i) }))
  const aria = t('weekAria', { list: points.map(({ w, open: o }) => `${t('weekShort', { week: w.week })} ${pc(w.wrExpected)}${o ? ` ${t('soFar')}` : ''}`).join(', ') })

  const chart = (narrow: boolean) => (
    <div role="img" aria-label={aria} className={twMerge('flex flex-col', narrow ? 'gap-2 pl-8.5' : 'gap-2.5 pl-10')}>
      <div className="relative" style={{ height: narrow ? 150 : 170 }}>
        {grid.map((v) => (
          <span key={v} className="contents">
            <span aria-hidden className={twMerge('absolute right-0 left-0 h-0 border-t', v === 50 ? 'border-dashed border-line-mid' : 'border-line')} style={{ top: `${yp(v)}%` }} />
            <span aria-hidden className={twMerge('absolute -mt-1.5 text-right text-ink-muted signal-sm', narrow ? '-left-8.5 w-7 tracking-[0.04em]' : '-left-10 w-8 tracking-[0.06em]')} style={{ top: `${yp(v)}%` }}>{v}%</span>
          </span>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
          <polyline points={points.map((p) => `${p.x},${p.y.toFixed(2)}`).join(' ')} fill="none" stroke="var(--color-series-1)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p) => (
          <span key={p.w.week} className="contents">
            <span aria-hidden className={twMerge('absolute box-border -translate-1/2 rounded-full border-3 border-series-1', narrow ? 'size-3' : 'size-3.5', p.open ? 'bg-surface-100' : 'bg-series-1')} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
            <span aria-hidden className={twMerge('absolute -translate-x-1/2 -translate-y-full font-display leading-none whitespace-nowrap text-ink', narrow ? '-mt-2.5 text-[17px]' : '-mt-3 text-xl')} style={{ left: `${p.x}%`, top: `${p.y}%` }}>{pc(p.w.wrExpected)}</span>
          </span>
        ))}
      </div>
      <div className="relative" style={{ height: narrow ? 32 : 34 }}>
        {points.map((p) => (
          <span key={p.w.week} aria-hidden className="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap" style={{ left: `${p.x}%` }}>
            <span className="text-ink-dim signal-sm">{narrow ? t('weekShort', { week: p.w.week }) : t('weekLabel', { week: p.w.week, date: day(p.w.firstDay) })}</span>
            <span className="text-[11px] leading-4 text-ink-muted">{p.open ? (narrow ? t('soFarShort', { games: n(p.w.games) }) : t('gamesSoFar', { games: n(p.w.games) })) : t('games', { games: n(p.w.games) })}</span>
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <Box className="gap-4 p-6 max-[719px]:gap-3.5 max-[719px]:px-4 max-[719px]:py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <PanelTitle>{t('byWeek')}</PanelTitle>
        <span className="text-ink-muted signal-sm"><span className={WIDE}>{t('byWeekAxis')}</span><span className={NARROW}>{t('byWeekAxisShort')}</span></span>
      </div>
      <div className={WIDE}>{chart(false)}</div>
      <div className={NARROW}>{chart(true)}</div>
      <p className="m-0 text-[13px] leading-5 text-ink-muted max-[719px]:text-xs max-[719px]:leading-4 max-[719px]:font-medium"><span className={WIDE}>{t('byWeekNote')}</span><span className={NARROW}>{t('byWeekNoteShort')}</span></p>
    </Box>
  )
}

const BAND_COLS = '112px 64px 72px minmax(120px, 1fr) 64px'

const Gem = ({ band }: { band: string }) =>
  band === 'all' ? (
    <span aria-hidden className="box-border size-2.5 flex-none rotate-45 border border-line-strong" />
  ) : (
    <span aria-hidden className="size-2.5 flex-none rotate-45" style={{ background: `var(--color-tier-${band.toLowerCase()})` }} />
  )

const ByBand = ({ rows, tiers }: { rows: Band[]; tiers: TierRules | null }) => {
  const t = useTranslations('Statistics.deck.strength')
  const tRoot = useTranslations('Statistics.pickers')
  if (!rows.length) return null
  const label = (band: string) => (band === 'all' ? tRoot('allName') : band)
  // a faixa tem o proprio lider: sem tier so abaixo dos pisos (Tier 4 nao tem fundo)
  const noTier = (short: boolean) => (short ? t('noTierShort') : tiers ? t('underFloors') : t('noTier'))
  return (
    <Box className="pt-6 max-[719px]:pt-4">
      <div className="flex flex-col gap-1 px-6 pb-4 max-[719px]:px-4 max-[719px]:pb-3">
        <PanelTitle>{t('byBand')}</PanelTitle>
        <p className="m-0 text-[13px] leading-5 text-ink-dim max-[719px]:text-xs max-[719px]:leading-4 max-[719px]:font-medium max-[719px]:text-ink-muted">{t('byBandLede')}</p>
      </div>
      <div role="table" aria-label={t('byBandAria')} className={twMerge(ROWS, 'border-t border-line', WIDE)}>
        <div role="row" className="grid min-h-10 items-center bg-surface-200" style={{ gridTemplateColumns: BAND_COLS }}>
          <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.band')}</span>
          <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.games')}</span>
          <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.expected')}</span>
          <span role="columnheader" aria-label={t('axis', { lo: 40, hi: 60 })} className="relative mx-4 block h-10">
            <span className="absolute top-3.5 left-0 text-ink-muted signal-sm">40</span>
            <span className="absolute top-3.5 left-1/2 -translate-x-1/2 text-ink-muted signal-sm">50</span>
            <span className="absolute top-3.5 right-0 text-ink-muted signal-sm">60%</span>
          </span>
          <span role="columnheader" className={twMerge(TH, 'pr-6')}>{t('cols.tier')}</span>
        </div>
        {rows.map((b) => (
          <div key={b.band} role="row" className={twMerge(ROW, 'min-h-11.5')} style={{ gridTemplateColumns: BAND_COLS }}>
            <span role="cell" className="flex items-center gap-2 pl-6 font-bold text-ink"><Gem band={b.band} />{label(b.band)}</span>
            <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{n(b.games)}</span>
            <span role="cell" className={twMerge(NUMERIC, 'font-bold text-ink')}>{pc(b.wrExpected)}</span>
            <span role="cell" className="mx-4"><Track value={b.wrExpected} low={b.wrLo} high={b.wrHi} lo={0.4} hi={0.6} h={46} /></span>
            <span role="cell" className="pr-6">{b.tier !== null ? <TierChip tier={b.tier} /> : <span className="text-ink-muted signal-sm">{noTier(false)}</span>}</span>
          </div>
        ))}
      </div>
      <div role="list" aria-label={t('byBandAria')} className={twMerge(ROWS, 'border-t border-line', NARROW)}>
        {rows.map((b) => (
          <div key={b.band} role="listitem" className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 bg-surface-100 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2">
              <Gem band={b.band} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-bold text-ink">{label(b.band)}</span>
                <Small>{t('games', { games: n(b.games) })}</Small>
              </span>
            </span>
            <span className="font-bold text-ink tabular-nums">{pc(b.wrExpected)}</span>
            <span>{b.tier !== null ? <TierChip tier={b.tier} /> : <span className="text-ink-muted signal-sm">{noTier(true)}</span>}</span>
            <span className="col-[1/4]"><Track value={b.wrExpected} low={b.wrLo} high={b.wrHi} lo={0.4} hi={0.6} h={14} /></span>
          </div>
        ))}
      </div>
      <div className={twMerge('flex justify-between border-t border-line px-4 py-2', NARROW)}>
        <span className="text-ink-muted signal-sm">40%</span><span className="text-ink-muted signal-sm">50%</span><span className="text-ink-muted signal-sm">60%</span>
      </div>
    </Box>
  )
}

const VER_COLS = 'minmax(240px, 1.6fr) 80px minmax(180px, 1fr) 72px 80px 80px minmax(110px, max-content)'

/** Other builds of the same lead: the two most played, then this one. */
const Versions = ({ deck, versions, scope, tiers, narrow }: { deck: DeckStat; versions: Family; scope: Scope; tiers: TierRules | null; narrow?: boolean }) => {
  const t = useTranslations('Statistics.deck.versions')
  const others = versions.members.filter((m) => m.key !== deck.key).slice(0, 2)
  const self = versions.members.find((m) => m.key === deck.key) ?? deck
  const note = (m: DeckStat) => (underFloors(m, tiers) ? t('tooRare') : t('noTier'))
  const lead = leadOf(deck.key)
  const leadPage = versions.members.some((m) => m.key === lead)
  const all = t('all', { count: versions.members.length })
  return (
    <Box className={narrow ? 'gap-2.5 px-4 py-5' : 'gap-3 p-6'}>
      <PanelTitle>{t('title')}</PanelTitle>
      {[...others, self].map((m) => (
        <Link
          key={m.key}
          href={deckHref(m.key, scope)}
          aria-current={m.key === deck.key ? 'page' : undefined}
          className={twMerge('grid grid-cols-[minmax(0,1fr)_auto] items-center border-t border-line pt-2.5 text-inherit no-underline', narrow ? 'min-h-11 gap-x-3 gap-y-0.5' : 'gap-x-3 gap-y-1')}
        >
          <span className={twMerge(DECK_NAME, 'font-bold', m.key === deck.key ? 'text-ink-muted' : 'text-ink')}>{m.key === deck.key ? t('thisPage', { name: nameOf(m) }) : nameOf(m)}</span>
          <span className="font-bold text-ink tabular-nums">{pc(m.wrExpected)}</span>
          <Small className="truncate">{t('meta', { share: pc(m.share), players: n(m.players) })}</Small>
          <span>{m.tier !== null ? <TierChip tier={m.tier} size="sm" /> : <span className="text-ink-muted signal-sm">{note(m)}</span>}</span>
        </Link>
      ))}
      {lead === deck.key ? (
        // same page: a plain anchor fires hashchange, which the section tabs listen to
        <a href="#versions" className={twMerge(LINK_BTN, !narrow && 'min-h-9')}>{all}</a>
      ) : (
        <Link href={leadPage ? `${deckHref(lead, scope)}#versions` : `${statisticsHref(scope)}#face`} className={twMerge(LINK_BTN, !narrow && 'min-h-9')}>{all}</Link>
      )}
    </Box>
  )
}

/** Every version of the lead side by side, most played first; only on the lead's own page. */
const VersionsTable = ({ deck, versions, scope, tiers, faces }: { deck: DeckStat; versions: Family; scope: Scope; tiers: TierRules | null; faces: Faces }) => {
  const t = useTranslations('Statistics.deck.versions')
  const rows = versions.members
  const lo = Math.floor(Math.min(0.5, ...rows.map((m) => m.wrLo)) * 10) / 10
  const hi = Math.ceil(Math.max(0.5, ...rows.map((m) => m.wrHi)) * 10) / 10
  const note = (m: DeckStat) => <span className="text-ink-muted signal-sm">{underFloors(m, tiers) ? t('tooRare') : t('noTier')}</span>
  const label = (m: DeckStat) => (m.key === deck.key ? t('thisPage', { name: nameOf(m) }) : nameOf(m))
  const link = (m: DeckStat) => (
    <Link href={deckHref(m.key, scope)} aria-current={m.key === deck.key ? 'page' : undefined} className={twMerge(DECK_NAME, 'font-bold hover:text-cyan', m.key === deck.key ? 'text-ink-muted' : 'text-ink')}>{label(m)}</Link>
  )
  return (
    <>
      <SectionHead title={t('tableTitle')} lede={<span className={WIDE}>{t('tableLede', { name: versions.name })}</span>} stamp={t('all', { count: rows.length })} />
      <Box className="pt-1 max-[719px]:pt-0.5">
        <div className={twMerge('overflow-x-auto', WIDE)}>
          <div role="table" aria-label={t('tableTitle')} className={twMerge(ROWS, 'min-w-[900px]')}>
            <div role="row" className={HEAD_ROW} style={{ gridTemplateColumns: VER_COLS }}>
              <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.deck')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.expected')}</span>
              <span role="columnheader" aria-label={t('axis', { lo: Math.round(lo * 100), hi: Math.round(hi * 100) })} className="relative mx-5 block h-11">
                <span className="absolute top-4 left-0 text-ink-muted signal-sm">{Math.round(lo * 100)}</span>
                <span className="absolute top-4 -translate-x-1/2 text-ink-muted signal-sm" style={{ left: at(0.5, lo, hi) }}>50</span>
                <span className="absolute top-4 right-0 text-ink-muted signal-sm">{Math.round(hi * 100)}%</span>
              </span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.share')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.games')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.players')}</span>
              <span role="columnheader" className={twMerge(TH, 'pr-6 pl-4')}>{t('cols.tier')}</span>
            </div>
            {rows.map((m) => (
              <div key={m.key} role="row" className={twMerge(ROW, 'min-h-16')} style={{ gridTemplateColumns: VER_COLS }}>
                <span role="cell" className="flex min-w-0 items-center gap-3 pl-6"><Art id={m.face ?? faces[m.key]} sub={subFace(m.key, faces)} name={nameOf(m)} size={52} />{link(m)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'font-bold text-ink')}>{pc(m.wrExpected)}</span>
                <span role="cell" className="mx-5"><Track value={m.wrExpected} low={m.wrLo} high={m.wrHi} lo={lo} hi={hi} h={46} /></span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(m.share)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{n(m.games)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{n(m.players)}</span>
                <span role="cell" className="pr-6 pl-4">{m.tier !== null ? <TierChip tier={m.tier} /> : note(m)}</span>
              </div>
            ))}
          </div>
        </div>
        <div role="list" aria-label={t('tableTitle')} className={twMerge(ROWS, NARROW)}>
          {rows.map((m) => (
            <div key={m.key} role="listitem" className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-surface-100 px-4 py-3.5">
              <Art id={m.face ?? faces[m.key]} sub={subFace(m.key, faces)} name={nameOf(m)} size={52} />
              <span className="flex min-w-0 flex-col">
                {link(m)}
                <Small>{t('row', { share: pc(m.share), games: n(m.games), players: n(m.players) })}</Small>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="font-bold text-ink tabular-nums">{pc(m.wrExpected)}</span>
                {m.tier !== null ? <TierChip tier={m.tier} size="sm" /> : note(m)}
              </span>
              <span className="col-[2/4]"><Track value={m.wrExpected} low={m.wrLo} high={m.wrHi} lo={lo} hi={hi} h={14} /></span>
            </div>
          ))}
        </div>
      </Box>
    </>
  )
}

/* ---------------------------------------------------------------- 02 matchups */

// Share intrinsic column widths across rows so translated verdicts cannot overlap the G1 rates.
const MU_COLS = 'minmax(240px, 1.3fr) 72px 88px minmax(260px, 2fr) 88px 80px 80px minmax(200px, max-content)'

const Matchups = ({ name, matchups, scope, faces }: { name: string; matchups: Matchup[]; scope: Scope; faces: Faces }) => {
  const t = useTranslations('Statistics.deck.matchups')
  const [low, setLow] = useState(false)
  const byGames = [...matchups].sort((a, b) => b.games - a.games)
  const main = byGames.filter((m) => m.games >= MIN_MATCHUP_GAMES)
  const small = byGames.filter((m) => m.games < MIN_MATCHUP_GAMES)
  const all = low ? byGames : main
  const lo = Math.floor(Math.min(0.5, ...all.map((m) => Math.min(m.wrLo, m.wrExpected))) * 10) / 10
  const hi = Math.ceil(Math.max(0.5, ...all.map((m) => Math.max(m.wrHi, m.wrExpected))) * 10) / 10
  const ticks = Array.from({ length: Math.round((hi - lo) * 10) + 1 }, (_, i) => Math.round((lo + i / 10) * 100))
  const reads = main.map((m) => READ_OF[matchupCall(m)])
  const favored = reads.filter((r) => r === 'good').length
  const unfavored = reads.filter((r) => r === 'bad').length
  const label = (m: Matchup) => nameOf({ key: m.opponent, name: m.opponentName })
  const link = (m: Matchup, className: string) =>
    m.opponent ? <Link href={deckHref(m.opponent, scope)} className={twMerge(DECK_NAME, 'font-bold hover:text-cyan', className)}>{label(m)}</Link> : <span className={twMerge(DECK_NAME, 'font-bold', className)}>{label(m)}</span>
  const gap = (m: Matchup) => (m.wrAdjusted - m.wrExpected) * 100
  const readText = (r: Read) => t(r === 'good' ? 'favored' : r === 'bad' ? 'unfavored' : 'unclear')

  return (
    <>
      <SectionHead title={t('title')} lede={<span className={WIDE}>{t('lede', { name })}</span>} />

      <div className="cut notch flex flex-wrap items-center gap-3.5 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)] max-[719px]:flex-col max-[719px]:items-start max-[719px]:gap-2 max-[719px]:px-4 max-[719px]:py-3.5">
        {favored || unfavored ? (
          <>
            <ReadChip read={favored >= unfavored ? 'good' : 'bad'}>{t('clear', { favored, unfavored })}</ReadChip>
            <span className="text-sm leading-[22px] text-ink-dim">{t('clearBody', { count: main.length, min: MIN_MATCHUP_GAMES })}</span>
          </>
        ) : (
          <>
            <ReadChip read="flat">{t('noClear')}</ReadChip>
            <span className="text-sm leading-[22px] text-ink-dim">{main.length ? t('noClearBody', { count: main.length, min: MIN_MATCHUP_GAMES }) : t('noneBody', { min: MIN_MATCHUP_GAMES })}</span>
          </>
        )}
      </div>

      <Box className="pt-1 max-[719px]:pt-0.5">
        <div className={twMerge('overflow-x-auto', WIDE)}>
          <div role="table" aria-label={t('aria', { name })} className={twMerge(ROWS, 'min-w-[1108px] gap-x-0')} style={{ gridTemplateColumns: MU_COLS }}>
            <div role="row" className={twMerge(HEAD_ROW, 'col-span-full grid-cols-subgrid')}>
              <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.opponent')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.games')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.result')}</span>
              <span role="columnheader" aria-label={t('axis', { lo: Math.round(lo * 100), hi: Math.round(hi * 100) })} className="relative mx-5 block h-11">
                {ticks.map((v) => <span key={v} className="absolute top-4 -translate-x-1/2 text-ink-muted signal-sm" style={{ left: at(v / 100, lo, hi) }}>{v}%</span>)}
              </span>
              <span role="columnheader" className="text-right text-gold signal">{t('cols.expected')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.first')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.second')}</span>
              <span role="columnheader" className={twMerge(TH, 'pr-6 text-right')}>{t('cols.read')}</span>
            </div>
            {main.map((m, i) => (
              <div key={m.opponent} role="row" className={twMerge(ROW, 'col-span-full min-h-16 grid-cols-subgrid')}>
                <span role="cell" className="flex min-w-0 items-center gap-3 pl-6"><Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={52} />{link(m, 'text-ink')}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{n(m.games)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'font-bold text-ink')}>{pc(m.wrAdjusted)}</span>
                <span role="cell" className="mx-5"><Track value={m.wrAdjusted} low={m.wrLo} high={m.wrHi} lo={lo} hi={hi} h={56} read={reads[i]} expected={m.wrExpected} /></span>
                <span role="cell" className={twMerge(NUMERIC, 'text-gold')}>{pc(m.wrExpected)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(m.firstWr)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(m.secondWr)}</span>
                <span role="cell" className="flex items-center justify-end gap-2 pr-6 pl-4 whitespace-nowrap">
                  <span className={twMerge('shrink-0 text-[13px] font-bold tabular-nums', tone(gap(m)))}>{signed(gap(m))}</span>
                  <ReadChip read={reads[i]!} className="px-2">{readText(reads[i]!)}</ReadChip>
                </span>
              </div>
            ))}
            {low
              ? small.map((m) => (
                  <div key={m.opponent} role="row" className="col-span-full grid min-h-16 grid-cols-subgrid items-center bg-surface-100">
                    <span role="cell" className="flex min-w-0 items-center gap-3 pl-6">
                      <Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={52} dim />
                      <span className="flex min-w-0 flex-col leading-[18px]">
                        {link(m, 'text-ink-dim')}
                        <span className="text-ink-muted signal-sm">{t('under', { min: MIN_MATCHUP_GAMES })}</span>
                      </span>
                    </span>
                    <span role="cell" className={twMerge(NUMERIC, 'text-ink-muted')}>{n(m.games)}</span>
                    <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(m.wrAdjusted)}</span>
                    <span role="cell" className="mx-5">
                      <span aria-hidden className="relative block h-13">
                        <span className="absolute top-6.5 right-0 left-0 h-px bg-line" />
                        <span className="absolute top-3.5 bottom-3.5 w-px bg-line-mid" style={{ left: at(0.5, lo, hi) }} />
                        <span className="absolute top-5.5 h-2.25 rounded-xs bg-surface-400" style={{ left: at(m.wrLo, lo, hi), width: span(m.wrLo, m.wrHi, lo, hi) }} />
                        <span className="absolute top-4.5 -ml-px h-4.25 w-0.75 bg-ink-muted" style={{ left: at(m.wrAdjusted, lo, hi) }} />
                        <span className="absolute top-3 -ml-px h-7.25 w-0.5 bg-gold opacity-60" style={{ left: at(m.wrExpected, lo, hi) }} />
                      </span>
                    </span>
                    <span role="cell" className={twMerge(NUMERIC, 'text-gold opacity-75')}>{pc(m.wrExpected)}</span>
                    <span role="cell" className={twMerge(NUMERIC, 'text-ink-muted')}>{pc(m.firstWr)}</span>
                    <span role="cell" className={twMerge(NUMERIC, 'text-ink-muted')}>{pc(m.secondWr)}</span>
                    <span role="cell" className={twMerge(NUMERIC, 'pr-6 text-[13px] opacity-75', tone(gap(m)))}>{signed(gap(m))}</span>
                  </div>
                ))
              : null}
          </div>
        </div>

        <div role="list" aria-label={t('aria', { name })} className={twMerge(ROWS, NARROW)}>
          {main.map((m, i) => (
            <div key={m.opponent} role="listitem" className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-surface-100 px-4 py-3.5">
              <Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={52} />
              <span className="flex min-w-0 flex-col">
                {link(m, 'text-ink')}
                <Small>{t.rich('rowMeta', { rate: pc(m.wrAdjusted), exp: pc(m.wrExpected), games: n(m.games), g: (c) => <span className="text-gold">{c}</span> })}</Small>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className={twMerge('text-sm font-bold tabular-nums', tone(gap(m)))}>{signed(gap(m))}</span>
                <ReadChip read={reads[i]!}>{readText(reads[i]!)}</ReadChip>
              </span>
              <span className="col-[2/4]"><Track value={m.wrAdjusted} low={m.wrLo} high={m.wrHi} lo={lo} hi={hi} h={22} read={reads[i]} expected={m.wrExpected} /></span>
              <Small className="col-[2/4]">{t('turns', { first: pc(m.firstWr), second: pc(m.secondWr) })}</Small>
            </div>
          ))}
          {low
            ? small.map((m) => (
                <div key={m.opponent} role="listitem" className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-surface-100 px-4 py-3">
                  <Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={52} dim />
                  <span className="flex min-w-0 flex-col">
                    {link(m, 'text-ink-dim')}
                    <Small>{t('underRow', { min: MIN_MATCHUP_GAMES, games: n(m.games) })}</Small>
                  </span>
                  <span className={twMerge('text-[13px] opacity-75 tabular-nums', tone(gap(m)))}>{signed(gap(m))}</span>
                </div>
              ))
            : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-6 py-1.5 max-[719px]:flex-col max-[719px]:items-stretch max-[719px]:px-4 max-[719px]:py-0">
          {small.length ? (
            <button type="button" aria-expanded={low} onClick={() => setLow(!low)} className={LINK_BTN}>
              {low ? t('hideLow', { min: MIN_MATCHUP_GAMES }) : t('showLow', { count: small.length, min: MIN_MATCHUP_GAMES })}
            </button>
          ) : <span />}
          <span className="flex flex-wrap items-center gap-x-4.5 gap-y-2 max-[719px]:-mx-4 max-[719px]:border-t max-[719px]:border-line max-[719px]:px-4 max-[719px]:py-3">
            <span className="flex items-center gap-2 text-ink-muted signal-sm max-[719px]:gap-1.5"><span aria-hidden className="h-3.5 w-0.75 bg-ink max-[719px]:h-3" />{t('legend.result')}</span>
            <span className="flex items-center gap-2 text-ink-muted signal-sm max-[719px]:gap-1.5"><span aria-hidden className="h-3.5 w-0.5 bg-gold max-[719px]:h-3" />{t('legend.expected')}</span>
            <span className="flex items-center gap-2 text-ink-muted signal-sm max-[719px]:gap-1.5"><span aria-hidden className="h-1.75 w-4.5 rounded-xs bg-[#4a5578] max-[719px]:h-1.5 max-[719px]:w-4" /><span className={WIDE}>{t('legend.interval')}</span><span className={NARROW}>{t('legend.intervalShort')}</span></span>
          </span>
        </div>
      </Box>
    </>
  )
}

/* ---------------------------------------------------------------- 03 build */

const FLEX_COLS = 'minmax(220px, 1.4fr) 72px 64px 72px minmax(200px, 1.4fr)'
const ER = 25
const FLEX_TABS = ['main', 'extra', 'spell', 'trap'] as const
type FlexTab = (typeof FLEX_TABS)[number]

/** A 40px art with the card's frame color along its bottom edge. */
const CardThumb = ({ c, info, name }: { c: CardStat; info?: CardInfo; name: string }) => (
  <span className="relative block size-10 flex-none">
    <Art id={c.card} name={name} size={40} />
    <span aria-hidden className="absolute bottom-0 left-0 h-0.75 w-10" style={{ background: frameColor(info) }} />
  </span>
)

const Tile = ({ c, info, name }: { c: CardStat; info?: CardInfo; name: string }) => {
  const t = useTranslations('Statistics.deck.build')
  const meta = { inc: pc(c.inclusion), played: pc(c.playRate) }
  const stripe = <span aria-hidden className="absolute bottom-0 left-0 h-0.75 w-12" style={{ background: frameColor(info) }} />
  const bar = (
    <span aria-hidden className="relative mt-1 block h-0.75 bg-surface-200 max-[719px]:mt-0.5">
      {c.playRate != null ? <span className="absolute top-0 bottom-0 left-0 bg-series-1" style={{ width: `${c.playRate * 100}%` }} /> : null}
    </span>
  )
  return (
    <>
      <div className={twMerge('grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 bg-surface-100 py-2.5 pr-3 pl-2.5 transition-colors duration-[120ms] hover:bg-surface-300', WIDE)}>
        <span className="relative block size-12"><Art id={c.card} name={name} size={48} />{stripe}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/wiki/card/${c.card}`} className="truncate text-sm leading-5 font-bold text-ink hover:text-cyan">{name}</Link>
          <span className="text-xs leading-4 font-medium whitespace-nowrap text-ink-muted">{t.rich('tileMeta', { copies: c.copies == null ? '–' : c.copies.toFixed(1), ...meta, b: (x) => <strong className="text-ink">{x}</strong> })}</span>
          {bar}
        </span>
      </div>
      <div role="listitem" className={twMerge('grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 bg-surface-100 px-4 py-2.5', NARROW)}>
        <span className="relative block size-12"><Art id={c.card} name={name} size={48} />{stripe}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/wiki/card/${c.card}`} className="truncate text-sm leading-5 font-bold text-ink hover:text-cyan">{name}</Link>
          <Small>{t('tileMetaShort', meta)}</Small>
          {bar}
        </span>
        <span className="font-display text-lg text-ink">×{c.copies == null ? '–' : c.copies.toFixed(1)}</span>
      </div>
    </>
  )
}

const Build = ({ name, cards, info, cardName }: { name: string; cards: CardStat[]; info: Record<number, CardInfo>; cardName: (id: number) => string }) => {
  const t = useTranslations('Statistics.deck.build')
  const [flexTab, setFlexTab] = useState<FlexTab>('main')
  if (!cards.length) {
    return (
      <>
        <SectionHead title={t('title')} lede={t('lede')} />
        <p className="text-[13px] leading-5 text-ink-muted">{t('noCards')}</p>
      </>
    )
  }
  const core = cards.filter((c) => c.inclusion >= CORE_RATE)
  const coreMain = core.filter((c) => !c.extra)
  const coreExtra = core.filter((c) => c.extra)
  const allFlex = cards.filter((c) => c.inclusion < CORE_RATE).sort((a, b) => b.inclusion - a.inclusion)
  // cards whose kind hasn't landed yet sit under Main until it does
  const tabOf = (c: CardStat): FlexTab => (c.extra ? 'extra' : info[c.card]?.kind === 'spell' ? 'spell' : info[c.card]?.kind === 'trap' ? 'trap' : 'main')
  const flexTabs = FLEX_TABS.map((id) => ({ id, list: allFlex.filter((c) => tabOf(c) === id) })).filter((g) => g.list.length)
  const openTab = flexTabs.find((g) => g.id === flexTab) ?? flexTabs[0]
  const flex = openTab?.list ?? []
  const side = cards.filter((c) => c.sideRate > 0).sort((a, b) => b.sideRate - a.sideRate).slice(0, 7)
  const sideMax = Math.max(...side.map((c) => c.sideRate), 0.01)
  const top = cards.reduce((a, b) => (b.inclusion > a.inclusion ? b : a))
  const lists = Math.round(top.lists / top.inclusion)
  /** Each core card at its usual copies (rounded, at least one), as passcodes. */
  const ids = (list: CardStat[]) => list.flatMap((c) => Array<number>(Math.max(1, Math.round(c.copies ?? 1))).fill(c.card))
  const coreCode = () => toOmega({ main: ids(coreMain), extra: ids(coreExtra), side: [] })
  const effectOf = (c: CardStat) => {
    if (c.effect == null || c.effectSe == null) return null
    const e = effectPoints(c.effect)
    const low = effectPoints(c.effect - 1.96 * c.effectSe)
    const high = effectPoints(c.effect + 1.96 * c.effectSe)
    const read: Read = low > 0 ? 'good' : high < 0 ? 'bad' : 'flat'
    return { e, low, high, read }
  }
  const effectColor = (x: ReturnType<typeof effectOf>) => (x === null ? 'text-ink-muted' : x.read === 'good' ? 'text-win' : x.read === 'bad' ? 'text-loss' : tone(x.e))
  const effectTrack = (x: NonNullable<ReturnType<typeof effectOf>>, h: number) => {
    const c = h / 2
    const a = Math.min(0, x.e)
    const b = Math.max(0, x.e)
    const color = x.read === 'good' ? 'bg-win' : x.read === 'bad' ? 'bg-loss' : 'bg-[#4a5578]'
    return (
      <span aria-hidden className="relative block flex-auto" style={{ height: h }}>
        <span className="absolute left-1/2 w-px bg-line-mid" style={{ top: Math.max(0, c - 10), bottom: Math.max(0, c - 10) }} />
        <span className={twMerge('absolute h-px', x.read === 'flat' ? 'bg-ink-muted' : color)} style={{ top: c, left: at(x.low, -ER, ER), width: span(x.low, x.high, -ER, ER) }} />
        <span className={twMerge('absolute h-2.5 rounded-xs', color)} style={{ top: c - 5, left: at(a, -ER, ER), width: span(a, b, -ER, ER) }} />
      </span>
    )
  }
  const zone = (title: string, list: CardStat[]) =>
    list.length ? (
      <div className="flex flex-col gap-2.5 max-[719px]:gap-0">
        <span className="text-ink-muted signal max-[719px]:block max-[719px]:border-t max-[719px]:border-line max-[719px]:bg-surface-200 max-[719px]:px-4 max-[719px]:py-2">{title}</span>
        <div role="list" className="grid gap-px border border-line bg-line grid-cols-[repeat(auto-fill,minmax(232px,1fr))] max-[719px]:grid-cols-1 max-[719px]:border-0">
          {list.map((c) => <Tile key={c.card} c={c} info={info[c.card]} name={cardName(c.card)} />)}
        </div>
      </div>
    ) : null

  return (
    <>
      <SectionHead title={t('title')} lede={<span className={WIDE}>{t('lede')}</span>} stamp={t('stamp', { lists: n(lists), cards: n(cards.length) })} />

      <Box className="gap-4.5 p-6 max-[719px]:gap-0 max-[719px]:px-0 max-[719px]:pt-4 max-[719px]:pb-0">
        <div className="flex flex-wrap items-end justify-between gap-3 max-[719px]:px-4 max-[719px]:pb-3">
          <div className="flex flex-col gap-1">
            <PanelTitle>{t('core', { count: core.length })}</PanelTitle>
            <p className="m-0 text-[13px] leading-5 text-ink-dim max-[719px]:text-xs max-[719px]:leading-4 max-[719px]:font-medium max-[719px]:text-ink-muted"><span className={WIDE}>{t('coreLede', { rate: mark(CORE_RATE) })}</span><span className={NARROW}>{t('coreLedeShort', { rate: mark(CORE_RATE) })}</span></p>
          </div>
          <CopyButton text={coreCode} label={t('copyCore')} done={t('copied')} className={twMerge('cut inline-flex min-h-10 cursor-pointer items-center px-3.5 text-ink signal-strong [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)]', WIDE)} />
        </div>
        {zone(t('main', { count: coreMain.length }), coreMain)}
        {zone(t('extra', { count: coreExtra.length }), coreExtra)}
        <div className={twMerge('border-t border-line px-4', NARROW)}>
          <CopyButton text={coreCode} label={t('copyCore')} done={t('copied')} className={LINK_BTN} />
        </div>
      </Box>

      <div className="flex flex-wrap items-stretch gap-6 max-[719px]:flex-col max-[719px]:gap-4">
        {flex.length ? (
          <Box className="pt-6 min-[720px]:min-w-0 min-[720px]:flex-[2_1_640px] max-[719px]:pt-4">
            <div className="flex flex-col gap-1 px-6 pb-4 max-[719px]:px-4 max-[719px]:pb-3">
              <PanelTitle>{t('flex')}</PanelTitle>
              <p className="m-0 text-[13px] leading-5 text-ink-dim max-[719px]:text-xs max-[719px]:leading-4 max-[719px]:font-medium max-[719px]:text-ink-muted"><span className={WIDE}>{t('flexLede', { name })}</span><span className={NARROW}>{t('flexLedeShort')}</span></p>
              <div role="group" aria-label={t('flexAria')} className="mt-2.5 flex flex-wrap gap-2">
                {flexTabs.map((g) => (
                  <Seg key={g.id} pressed={g.id === openTab?.id} onClick={() => setFlexTab(g.id)}>{t(`flexTabs.${g.id}`, { count: g.list.length })}</Seg>
                ))}
              </div>
            </div>
            <div className={twMerge('overflow-x-auto', WIDE)}>
              <div role="table" aria-label={t('flexAria')} className={twMerge(ROWS, 'min-w-[680px] border-t border-line')}>
                <div role="row" className={HEAD_ROW} style={{ gridTemplateColumns: FLEX_COLS }}>
                  <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.card')}</span>
                  <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.inLists')}</span>
                  <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.copies')}</span>
                  <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.played')}</span>
                  <span role="columnheader" aria-label={t('effectAxis', { r: ER })} className="relative mr-6 ml-5 block h-11">
                    <span className="absolute top-4 left-0 text-ink-muted signal-sm">−{ER}</span>
                    <span className="absolute top-4 left-1/2 -translate-x-1/2 text-ink-muted signal-sm">0</span>
                    <span className="absolute top-4 right-0 text-ink-muted signal-sm">{t('effectEnd', { r: ER })}</span>
                  </span>
                </div>
                {flex.map((c) => {
                  const x = effectOf(c)
                  return (
                    <div key={c.card} role="row" className={twMerge(ROW, 'min-h-14')} style={{ gridTemplateColumns: FLEX_COLS }}>
                      <span role="cell" className="flex min-w-0 items-center gap-3 pl-6">
                        <CardThumb c={c} info={info[c.card]} name={cardName(c.card)} />
                        <Link href={`/wiki/card/${c.card}`} className="truncate font-bold text-ink hover:text-cyan">{cardName(c.card)}</Link>
                      </span>
                      <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(c.inclusion)}</span>
                      <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{c.copies == null ? '–' : c.copies.toFixed(1)}</span>
                      <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(c.playRate)}</span>
                      <span role="cell" className="flex items-center gap-3 pr-6 pl-5">
                        {x ? effectTrack(x, 48) : <span className="h-12 flex-auto" />}
                        <span className={twMerge('w-14 flex-none text-right text-[13px] font-bold tabular-nums', effectColor(x))}>{x ? signed(x.e) : '–'}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div role="list" aria-label={t('flexAria')} className={twMerge(ROWS, 'border-t border-line', NARROW)}>
              {flex.map((c) => {
                const x = effectOf(c)
                return (
                  <div key={c.card} role="listitem" className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 bg-surface-100 px-4 py-3">
                    <span className="row-span-2 self-start"><CardThumb c={c} info={info[c.card]} name={cardName(c.card)} /></span>
                    <span className="flex min-w-0 flex-col">
                      <Link href={`/wiki/card/${c.card}`} className="truncate font-bold text-ink hover:text-cyan">{cardName(c.card)}</Link>
                      <Small>{t('flexRow', { inc: pc(c.inclusion), copies: c.copies == null ? '–' : c.copies.toFixed(1), played: pc(c.playRate) })}</Small>
                    </span>
                    <span className={twMerge('text-sm font-bold tabular-nums', effectColor(x))}>{x ? signed(x.e) : '–'}</span>
                    {x ? <span className="col-[2/4] flex">{effectTrack(x, 14)}</span> : null}
                  </div>
                )
              })}
            </div>
          </Box>
        ) : null}

        {side.length ? (
          <Box className="gap-3.5 p-6 min-[720px]:min-w-0 min-[720px]:flex-[1_1_300px] max-[719px]:gap-3 max-[719px]:px-4 max-[719px]:py-5">
            <div className="flex flex-col gap-1">
              <PanelTitle>{t('side')}</PanelTitle>
              <p className="m-0 text-[13px] leading-5 text-ink-dim max-[719px]:text-xs max-[719px]:leading-4 max-[719px]:font-medium max-[719px]:text-ink-muted"><span className={WIDE}>{t('sideLede')}</span><span className={NARROW}>{t('sideLedeShort')}</span></p>
            </div>
            {side.map((c) => (
              <div key={c.card} className="flex items-center gap-3 border-t border-line pt-2.5">
                <CardThumb c={c} info={info[c.card]} name={cardName(c.card)} />
                <div className="flex min-w-0 flex-auto flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/wiki/card/${c.card}`} className="truncate font-bold text-ink hover:text-cyan">{cardName(c.card)}</Link>
                    <span className="font-bold text-ink tabular-nums">{pc(c.sideRate)}</span>
                  </div>
                  <span aria-hidden className="relative block h-1 bg-surface-200">
                    <span className="absolute top-0 bottom-0 left-0 rounded-r-xs bg-series-3" style={{ width: `${(c.sideRate / sideMax) * 100}%` }} />
                  </span>
                </div>
              </div>
            ))}
          </Box>
        ) : null}
      </div>
    </>
  )
}
