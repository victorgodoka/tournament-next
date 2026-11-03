'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { deckHref, effectPoints, plainDecks, underFloors, type DeckStat, type Meta, type Scope, type TierRules } from '@utils/statistics'
import { Art, at, Box, ci, DECK_NAME, facesOf, subFace, HEAD_ROW, LINK_BTN, LocalTime, mark, n, NARROW, NUMERIC, pc, ROW, ROWS, SectionHead, signed, Small, TH, TierChip, Track, WIDE } from '../kit'
import { nameOf } from '../shared'

const SHOWN = 30
const COLS = '56px minmax(240px, 1.4fr) 80px 96px minmax(300px, 2.4fr) 88px 88px 96px'
const M_COLS = '20px 44px minmax(0, 1fr) 64px'
const LO = 0.4
const HI = 0.7
const TICKS = [45, 50, 55, 60, 65]

/** What a deck under the floors is short of: share, duelists or both. */
const shortOf = (d: DeckStat, tiers: TierRules, t: ReturnType<typeof useTranslations>) =>
  [d.share < tiers.minShare ? t('rareShare', { share: pc(d.share) }) : null, d.players < tiers.minPlayers ? t('rarePlayers', { players: n(d.players) }) : null].filter(Boolean).join(' · ')

const Caret = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden fill="currentColor" className={twMerge('flex-none text-ink-muted transition-transform duration-[120ms]', open && 'rotate-90')}><path d="M9 6l6 6-6 6z" /></svg>
)

/** Every deck over the floors has a tier now (Tier 4 has no bottom): no tier only on an older build. */
const TierCell = ({ deck }: { deck: DeckStat }) => {
  const t = useTranslations('Statistics.play')
  return deck.tier !== null ? <TierChip tier={deck.tier} /> : <span className="text-ink-muted signal-sm">{t('noTier')}</span>
}

/** `signal` on wide screens, `signal-sm` on a phone (component classes take no variants). */
const STAT_LABEL = 'text-ink-muted signal max-[719px]:text-[10px] max-[719px]:leading-3 max-[719px]:tracking-[0.16em]'

/** Every deck by the win rate the model expects against the field; decks under the tier floors after them, apart. */
export const WhatToPlay = ({ meta, scope, best }: { meta: Meta; scope: Scope; best?: React.ReactNode }) => {
  const t = useTranslations('Statistics.play')
  const locale = useLocale()
  const [all, setAll] = useState(false)
  const [openRare, setOpenRare] = useState(false)
  const tiers = meta.fit.tiers
  // a build before the leader-relative tiers sends absolute marks (t1…t4): no gaps to explain, no card
  const gaps = typeof tiers?.t1Gap === 'number' ? tiers : null
  const faces = facesOf(meta.decks)
  const decks = plainDecks(meta.decks).sort((a, b) => b.wrExpected - a.wrExpected)
  const ranked = decks.filter((d) => !underFloors(d, tiers))
  const rare = decks.filter((d) => underFloors(d, tiers))
  const shown = all ? ranked : ranked.slice(0, SHOWN)
  const first = effectPoints(meta.fit.firstEffect)
  const stamp = t.rich('stamp', { games: n(meta.fit.games), time: () => <LocalTime iso={meta.fit.builtAt} locale={locale} /> })
  const link = (d: DeckStat, className: string) => <Link href={deckHref(d.key, scope)} className={twMerge(DECK_NAME, 'font-bold hover:text-cyan', className)}>{nameOf(d)}</Link>

  if (!decks.length) {
    return (
      <>
        <SectionHead title={t('title')} lede={t('lede')} />
        <p className="text-[13px] leading-5 text-ink-muted">{t('empty')}</p>
      </>
    )
  }

  const showAll = ranked.length > SHOWN ? (
    <div className="border-t border-line px-6 py-1.5 max-[719px]:px-4">
      <button type="button" onClick={() => setAll(!all)} className={LINK_BTN}>{all ? t('showTop', { count: SHOWN }) : t('showAll', { count: n(ranked.length) })}</button>
    </div>
  ) : null

  return (
    <>
      <SectionHead
        title={t('title')}
        lede={<><span className={WIDE}>{t('lede')}</span><span className={NARROW}>{t('ledeShort')}</span></>}
        stamp={stamp}
      />

      <Box className="pt-1 max-[719px]:pt-0.5">
        {/* Wide: the table */}
        <div className={twMerge('overflow-x-auto', WIDE)}>
          <div role="table" aria-label={t('aria')} className={twMerge(ROWS, 'min-w-[900px]')}>
            <div role="row" className={HEAD_ROW} style={{ gridTemplateColumns: COLS }}>
              <span role="columnheader" className={twMerge(TH, 'pl-6')}>#</span>
              <span role="columnheader" className={TH}>{t('cols.deck')}</span>
              <span role="columnheader" className={TH}>{t('cols.tier')}</span>
              <span role="columnheader" className={TH}>{t('cols.expected')}</span>
              <span role="columnheader" aria-label={t('axis', { lo: 40, hi: 70 })} className="relative block h-11">
                {TICKS.map((v) => <span key={v} className="absolute top-4 -translate-x-1/2 text-ink-muted signal-sm" style={{ left: at(v / 100, LO, HI) }}>{v}%</span>)}
              </span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.meta')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.games')}</span>
              <span role="columnheader" className={twMerge(TH, 'pr-6 text-right')}>{t('cols.players')}</span>
            </div>
            {shown.map((d, i) => (
              <div key={d.key} role="row" className={twMerge(ROW, 'min-h-13')} style={{ gridTemplateColumns: COLS }}>
                <span role="cell" className="pl-6 font-display text-lg text-ink-muted">{i + 1}</span>
                <span role="cell" className="flex min-w-0 items-center gap-3">
                  <Art id={d.face} sub={subFace(d.key, faces)} name={nameOf(d)} size={44} />
                  {link(d, 'text-ink')}
                </span>
                <span role="cell"><TierCell deck={d} /></span>
                <span role="cell" className="flex flex-col">
                  <span className="font-display text-xl leading-none text-ink">{pc(d.wrExpected)}</span>
                  <span className="mt-1 tracking-[0.06em] text-ink-muted signal-sm">{ci(d.wrLo, d.wrHi)}</span>
                </span>
                <span role="cell"><Track value={d.wrExpected} low={d.wrLo} high={d.wrHi} lo={LO} hi={HI} h={52} /></span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(d.share)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{n(d.games)}</span>
                <span role="cell" className={twMerge(NUMERIC, 'pr-6 text-ink-dim')}>{n(d.players)}</span>
              </div>
            ))}
            {rare.length && tiers ? (
              <>
                <div role="row" className="bg-surface-200">
                  <button type="button" aria-expanded={openRare} onClick={() => setOpenRare(!openRare)} className="flex w-full cursor-pointer flex-wrap items-center gap-3 px-6 py-3 text-left hover:bg-surface-300 focus-visible:shadow-focus-ring focus-visible:outline-none">
                    <Caret open={openRare} />
                    <span className="text-ink-dim signal-strong">{t('untiered')} · {rare.length}</span>
                    <span className="text-[13px] leading-5 text-ink-muted">{t('untieredNote', { share: mark(tiers.minShare), players: tiers.minPlayers })}</span>
                  </button>
                </div>
                {(openRare ? rare : []).map((d) => (
                  <div key={d.key} role="row" className={twMerge(ROW, 'min-h-13')} style={{ gridTemplateColumns: COLS }}>
                    <span role="cell" className="pl-6 text-ink-muted signal-sm">–</span>
                    <span role="cell" className="flex min-w-0 items-center gap-3">
                      <Art id={d.face} sub={subFace(d.key, faces)} name={nameOf(d)} size={44} dim />
                      <span className="flex min-w-0 flex-col">
                        {link(d, 'text-ink-dim')}
                        <span className="text-xs leading-4 font-medium text-ink-muted">{shortOf(d, tiers, t)}</span>
                      </span>
                    </span>
                    <span role="cell" className="text-ink-muted signal-sm">{t('noTier')}</span>
                    <span role="cell" className="flex flex-col">
                      <span className="font-display text-xl leading-none text-ink-dim">{pc(d.wrExpected)}</span>
                      <span className="mt-1 tracking-[0.06em] text-ink-muted signal-sm">{ci(d.wrLo, d.wrHi)}</span>
                    </span>
                    <span role="cell"><Track value={d.wrExpected} low={d.wrLo} high={d.wrHi} lo={LO} hi={HI} h={52} dim /></span>
                    <span role="cell" className="text-right text-ink-muted">{pc(d.share)}</span>
                    <span role="cell" className="text-right text-ink-muted">{n(d.games)}</span>
                    <span role="cell" className="pr-6 text-right text-ink-muted">{n(d.players)}</span>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </div>

        {/* Narrow: the list */}
        <div role="list" aria-label={t('aria')} className={twMerge(ROWS, NARROW)}>
          <div aria-hidden className="grid gap-x-2.5 bg-surface-200 px-4 pt-2.5 pb-1.5" style={{ gridTemplateColumns: M_COLS }}>
            <span className="text-ink-muted signal-sm">#</span>
            <span />
            <span className="relative col-[3/5] h-3">
              {TICKS.map((v) => <span key={v} className="absolute top-0 -translate-x-1/2 tracking-[0.04em] text-ink-muted signal-sm" style={{ left: at(v / 100, LO, HI) }}>{v}%</span>)}
            </span>
          </div>
          {shown.map((d, i) => (
            <div key={d.key} role="listitem" className="grid items-center gap-x-2.5 gap-y-1.5 bg-surface-100 px-4 py-3" style={{ gridTemplateColumns: M_COLS }}>
              <span className="font-display text-[15px] text-ink-muted">{i + 1}</span>
              <Art id={d.face} sub={subFace(d.key, faces)} name={nameOf(d)} size={44} />
              <span className="flex min-w-0 flex-col">
                {link(d, 'text-ink')}
                <Small className="truncate">{t('rowMeta', { share: pc(d.share), games: n(d.games), players: n(d.players) })}</Small>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="font-display text-xl leading-none text-ink">{pc(d.wrExpected)}</span>
                <TierCell deck={d} />
              </span>
              <span className="col-[3/5]"><Track value={d.wrExpected} low={d.wrLo} high={d.wrHi} lo={LO} hi={HI} h={16} /></span>
            </div>
          ))}
          {rare.length && tiers ? (
            <>
              <button type="button" aria-expanded={openRare} onClick={() => setOpenRare(!openRare)} className="grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 bg-surface-200 px-4 py-3 text-left focus-visible:shadow-focus-ring focus-visible:outline-none">
                <Caret open={openRare} />
                <span className="text-ink-dim signal-strong">{t('untiered')} · {rare.length}</span>
                <Small className="col-start-2">{t('untieredNoteShort', { share: mark(tiers.minShare), players: tiers.minPlayers })}</Small>
              </button>
              {(openRare ? rare : []).map((d) => (
                <div key={d.key} role="listitem" className="grid items-center gap-x-2.5 gap-y-1.5 bg-surface-100 px-4 py-3" style={{ gridTemplateColumns: M_COLS }}>
                  <span className="text-ink-muted signal-sm">–</span>
                  <Art id={d.face} sub={subFace(d.key, faces)} name={nameOf(d)} size={44} dim />
                  <span className="flex min-w-0 flex-col">
                    {link(d, 'text-ink-dim')}
                    <Small className="truncate">{shortOf(d, tiers, t)}</Small>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-display text-xl leading-none text-ink-dim">{pc(d.wrExpected)}</span>
                    <span className="text-ink-muted signal-sm">{t('noTier')}</span>
                  </span>
                  <span className="col-[3/5]"><Track value={d.wrExpected} low={d.wrLo} high={d.wrHi} lo={LO} hi={HI} h={16} dim /></span>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {showAll}

        <div className="grid gap-px border-t border-line bg-line grid-cols-[repeat(auto-fit,minmax(200px,1fr))] max-[719px]:grid-cols-2">
          <div className="flex flex-col gap-2 bg-surface-100 px-6 py-5 max-[719px]:gap-1.5 max-[719px]:px-4 max-[719px]:py-3.5">
            <span className={STAT_LABEL}>{t('modelGames')}</span>
            <span className="font-display text-[40px] leading-none text-ink max-[719px]:text-[28px]">{n(meta.fit.games)}</span>
            <span className={twMerge('text-[13px] leading-5 text-ink-muted', WIDE)}>{t('modelScope', { ladder: scope.ladder === 'genesys' ? 'Genesys' : 'TCG', window: t(`windowNames.${meta.window}`) })}</span>
          </div>
          <div className="flex flex-col gap-2 bg-surface-100 px-6 py-5 max-[719px]:gap-1.5 max-[719px]:px-4 max-[719px]:py-3.5">
            <span className={STAT_LABEL}><span className={WIDE}>{t('first')}</span><span className={NARROW}>{t('firstShort')}</span></span>
            <span className={twMerge('font-display text-[40px] leading-none max-[719px]:text-[28px]', first > 0.05 ? 'text-win' : first < -0.05 ? 'text-loss' : 'text-ink')}>{t('pts', { value: signed(first) })}</span>
            <span className={twMerge('text-[13px] leading-5 text-ink-muted', WIDE)}>{t('firstNote')}</span>
          </div>
          <div className={twMerge('flex flex-col gap-2 bg-surface-100 px-6 py-5', WIDE)}>
            <span className="text-ink-muted signal">{t('ranked')}</span>
            <span className="font-display text-[40px] leading-none text-ink">{rare.length ? t('rankedValue', { ranked: ranked.length, rare: rare.length }) : ranked.length}</span>
            <span className="text-[13px] leading-5 text-ink-muted">{rare.length ? t('rankedNote', { rare: rare.length }) : t('rankedAll')}</span>
          </div>
        </div>
      </Box>

      <div className="grid items-stretch gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] max-[719px]:gap-4">
        {best}
        <TiersCard tiers={gaps} />
      </div>
    </>
  )
}

const TIER_ROWS = [1, 1.5, 2, 3, 4] as const

/** A gap to the leader in points, up to two decimals: 0.0075 → `0.75`. */
const points = (rate: number) => String(Number((rate * 100).toFixed(2)))

/** The server's defaults, for a build that sent no gaps yet (`analytics.tiers`, `analytics.filters`). */
const DEFAULT_RULES: TierRules = { t1Gap: 0.0075, t2Gap: 0.0125, t3Gap: 0.025, minShare: 0.005, minPlayers: 10 }

const Swatch = ({ children }: { children: React.ReactNode }) => <span aria-hidden className="relative flex h-4.25 w-14 flex-none items-center">{children}</span>

/** How to read the page: the tiers relative to the leader, the floors, then the bars. The build's numbers, else the defaults. */
const TiersCard = ({ tiers: built }: { tiers: TierRules | null }) => {
  const t = useTranslations('Statistics.play.tiers')
  const tBars = useTranslations('Statistics.play.bars')
  const tiers = built ?? DEFAULT_RULES
  const rows = { 1: t('rows.1', { gap: points(tiers.t1Gap) }), 1.5: t('rows.15', { gap: points(tiers.t1Gap) }), 2: t('rows.2', { gap: points(tiers.t2Gap) }), 3: t('rows.3', { gap: points(tiers.t3Gap) }), 4: t('rows.4', { gap: points(tiers.t3Gap) }) }
  const line = 'm-0 text-[13px] leading-5 text-ink-dim'
  return (
    <Box className="gap-3.5 p-6 max-[719px]:gap-3 max-[719px]:p-5">
      <h3 className="m-0 display-3 text-ink max-[719px]:text-xl">{t('title')}</h3>
      <p className="m-0 text-[13px] leading-5 text-ink-dim">{t('lede')}</p>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3.5 gap-y-2">
        {TIER_ROWS.map((tier) => (
          <span key={tier} className="contents">
            <TierChip tier={tier} />
            <span className="text-[13px] leading-5 text-ink-dim">{rows[tier]}</span>
          </span>
        ))}
      </div>
      <p className={line}>{t('floors', { share: mark(tiers.minShare), players: tiers.minPlayers })}</p>
      <p className={line}>{t('moves')}</p>
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <span className="text-ink signal-strong">{tBars('title')}</span>
        <div className="flex items-center gap-3.5">
          <Swatch>
            <span className="h-1.75 w-full rounded-xs bg-series-3/75" />
            <span className="absolute top-0 left-6.5 h-4.25 w-0.75 bg-ink" />
          </Swatch>
          <span className={line}>{tBars('tick')}</span>
        </div>
        <div className="flex items-center gap-3.5">
          <Swatch><span className="h-1.75 w-full rounded-xs bg-line-mid" /></Swatch>
          <span className={line}>{tBars('wide')}</span>
        </div>
        <div className="flex items-center gap-3.5">
          <Swatch><span className="absolute top-0 bottom-0 left-6.75 w-px bg-line-mid" /></Swatch>
          <span className={line}>{tBars('line')}</span>
        </div>
        <p className="m-0 text-[13px] leading-5 text-ink-muted">{t('interval')}</p>
      </div>
    </Box>
  )
}
