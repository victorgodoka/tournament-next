'use client'

/** 01 Overview: you versus an average pilot, the season in five numbers, the four highlights, turn order and the method. */

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Art, DECK_NAME, n, NARROW, pc, ReadChip, signed, Small, tone, WIDE, type Read } from '@app/statistics/kit'
import { OTHER_OPPONENT, type PlayerAnswer, type PlayerSlice } from '@utils/statistics'
import type { DeckArt } from './MySections'
import { GapLine, HeroLine } from './tracks'
import { deckRecords, gap, headlineOf, readOf } from './view'

type Props = { data: PlayerAnswer; name: (key: string) => string; art: DeckArt }

const PANEL = 'cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]'

/** The verdict chip, long on desktop, short on a phone. */
export const Verdict = ({ slice, short, className }: { slice: PlayerSlice; short?: boolean; className?: string }) => {
  const t = useTranslations('PlayerStatistics.my.verdict')
  const v = slice.verdict === 'above' || slice.verdict === 'below' ? slice.verdict : 'unclear'
  return <ReadChip read={readOf(slice)} className={className}>{t(short ? `${v}Short` : v)}</ReadChip>
}

const ARROW = { above: 'M6 15l6-6 6 6', below: 'M6 9l6 6 6-6', unclear: 'M6 12h12' }

/** The verdict as an icon; hover or focus tells what it means. The tip opens to the left so a scrolling table doesn't clip it. */
export const VerdictIcon = ({ slice }: { slice: PlayerSlice }) => {
  const t = useTranslations('PlayerStatistics.my.verdict')
  const v = slice.verdict === 'above' || slice.verdict === 'below' ? slice.verdict : 'unclear'
  return (
    <span tabIndex={0} aria-label={`${t(v)}. ${t(`${v}Hint`)}`} className="group relative inline-flex outline-none">
      <ReadChip read={readOf(slice)} className="size-7 justify-center px-0 group-focus-visible:outline-2 group-focus-visible:outline-cyan max-[719px]:size-6 max-[719px]:px-0">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="square"><path d={ARROW[v]} /></svg>
      </ReadChip>
      <span role="tooltip" className="pointer-events-none absolute top-1/2 right-full z-10 mr-2 hidden w-60 -translate-y-1/2 border border-line-mid bg-surface-300 px-3 py-2 text-left text-xs leading-4 text-ink-dim shadow-lg group-hover:block group-focus-visible:block">
        <strong className="block text-ink">{t(v)}</strong>
        {t(`${v}Hint`)}
      </span>
    </span>
  )
}

const Tile = ({ label, value, note, gold }: { label: string; value: string; note?: React.ReactNode; gold?: boolean }) => (
  <div className="flex flex-col gap-2 bg-surface-100 px-5 py-4.5 max-[719px]:gap-1.5 max-[719px]:px-4 max-[719px]:py-3.5">
    <span className={twMerge('signal max-[719px]:text-[10px] max-[719px]:leading-3 max-[719px]:tracking-[0.16em]', gold ? 'text-gold' : 'text-ink-muted')}>{label}</span>
    <span className={twMerge('font-display text-[40px] leading-none max-[719px]:text-[28px]', gold ? 'text-gold' : 'text-ink')}>{value}</span>
    {note ? <Small className={WIDE}>{note}</Small> : null}
  </div>
)

const Record = ({ w, l, d }: { w: number; l: number; d: number }) => (
  <Small><span className="text-win">{w} W</span> · <span className="text-loss">{l} L</span> · {d} D</Small>
)

export const Overview = ({ data, name, art }: Props) => {
  const t = useTranslations('PlayerStatistics.my.overview')
  const tv = useTranslations('PlayerStatistics.my.verdict')
  const tc = useTranslations('PlayerStatistics.my.cols')
  const perf = data.performance
  const g = perf ? gap(perf) : null
  const read: Read = perf ? readOf(perf) : 'flat'
  const headline = headlineOf(perf?.verdict ?? null)
  const color = (v: number) => (v > 0.05 ? 'text-win' : v < -0.05 ? 'text-loss' : 'text-draw')
  const rec = data.record
  const deckOf = (key: string | null | undefined) => (key ? data.decks.find((d) => d.key === key) : undefined)
  const oppOf = (key: string | null | undefined) => (key ? data.opponents?.find((o) => o.deck === null && o.opponent === key) : undefined)
  const best = deckOf(data.highlights?.bestDeck)
  const worst = deckOf(data.highlights?.worstDeck)
  const bestOpp = oppOf(data.highlights?.bestOpponent)
  const toughOpp = oppOf(data.highlights?.toughestOpponent)
  const oppName = (key: string) => (key === OTHER_OPPONENT ? t('other') : name(key))
  const deckRec = deckRecords(data.timeline)
  const oppRec = deckRecords(data.timeline, 'opponent')

  const cards = [
    best && { label: t('highlights.bestDeck'), key: best.key, name: name(best.key), slice: best.performance, games: best.games, record: deckRec[best.key], link: t('highlights.allDecks'), tab: 'decks' },
    worst && { label: t('highlights.worstDeck'), key: worst.key, name: name(worst.key), slice: worst.performance, games: worst.games, record: deckRec[worst.key], link: t('highlights.allDecks'), tab: 'decks' },
    bestOpp && { label: t('highlights.bestOpponent'), key: bestOpp.opponent, name: oppName(bestOpp.opponent), slice: bestOpp.performance, games: bestOpp.games, record: oppRec[bestOpp.opponent], link: t('highlights.allMatchups'), tab: 'matchups' },
    toughOpp && { label: t('highlights.toughestOpponent'), key: toughOpp.opponent, name: oppName(toughOpp.opponent), slice: toughOpp.performance, games: toughOpp.games, record: oppRec[toughOpp.opponent], link: t('highlights.allMatchups'), tab: 'matchups' },
  ].filter((c) => !!c)

  const turn = data.splits
    ? ([['first', data.splits.g1First], ['second', data.splits.g1Second]] as const).map(([id, slice]) => ({ id, slice, g: gap(slice) }))
    : []

  const wideCard = (c: (typeof cards)[number]) => {
    const cg = gap(c.slice)
    const wins = c.slice.winsAbove
    return (
      <div key={c.label} className={`${PANEL} gap-5 p-6 ${WIDE}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted signal">{c.label}</span>
          <Verdict slice={c.slice} />
        </div>
        <div className="flex min-w-0 items-center gap-4 py-2">
          <Art {...art(c.key)} name={c.name} size={72} />
          <span className="flex min-w-0 flex-col gap-2.5">
            <span className={`text-lg leading-6 font-bold text-ink ${DECK_NAME}`}>{c.name}</span>
            <span className={twMerge('font-display text-[32px] leading-none', cg ? tone(cg.gap) : 'text-draw')}>{cg ? t('highlights.pts', { gap: signed(cg.gap) }) : '–'}</span>
          </span>
        </div>
        {cg ? (
          <div className="flex flex-col gap-1.5 border border-line bg-space-000/35 px-3 pt-2 pb-2.5">
            <div className="flex justify-between signal-sm">
              <span className="text-ink-muted">−20</span>
              <span className="text-gold">{t('axisMid')}</span>
              <span className="text-ink-muted">+20 pts</span>
            </div>
            <GapLine gap={cg.gap} lo={cg.lo} hi={cg.hi} read={readOf(c.slice)} range={20} size="turn" />
          </div>
        ) : null}
        <dl className="m-0 grid grid-cols-4 gap-px border border-line bg-line">
          {[
            [tc('games'), n(c.games), 'text-ink'],
            [tc('you'), cg ? pc(cg.you) : '–', 'text-ink'],
            [tc('expected'), cg ? pc(cg.exp) : '–', 'text-gold'],
            [tc('wins'), wins !== null ? signed(wins) : '–', wins !== null ? tone(wins) : 'text-draw'],
          ].map(([label, value, color]) => (
            <div key={label} className="flex flex-col gap-1.5 bg-surface-200 px-3 py-2.5">
              <dt className={twMerge('signal-sm', color === 'text-gold' ? 'text-gold' : 'text-ink-muted')}>{label}</dt>
              <dd className={twMerge('m-0 text-lg leading-none font-bold tabular-nums', color)}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Small>
            {c.record ? <Record w={c.record.wins} l={c.record.losses} d={c.record.draws} /> : null}
            {c.record && cg ? ' · ' : null}
            {cg ? t('highlights.interval', { lo: signed(cg.lo), hi: signed(cg.hi) }) : null}
          </Small>
          <a href={`#${c.tab}`} className="inline-flex min-h-8 items-center gap-2 text-cyan signal-strong hover:text-ink">{c.link}</a>
        </div>
      </div>
    )
  }

  return (
    <>
      {perf && g ? (
        <div className="cut notch flex flex-wrap items-center gap-x-10 gap-y-7 p-7 [--cut:var(--cut-lg)] [--edge:var(--color-steel)] [--fill:var(--color-steel)] max-[719px]:flex-col max-[719px]:items-stretch max-[719px]:gap-3 max-[719px]:p-5">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 max-[719px]:flex-none">
            <div className="flex items-center gap-2">
              <span aria-hidden className={`inline-block size-2 bg-gold ${WIDE}`} />
              <span className="text-ink signal max-[719px]:text-[10px] max-[719px]:leading-3 max-[719px]:tracking-[0.16em]">{t('eyebrow')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3.5 max-[719px]:flex-col max-[719px]:items-start max-[719px]:gap-3">
              <h2 className="m-0 font-display text-[40px] leading-none text-ink uppercase max-[719px]:text-[30px]">{t(`headline.${headline}`)}</h2>
              <ReadChip read={read} className={read === 'flat' ? 'text-ink [--edge:var(--color-ink-dim)] [--fill:var(--color-steel)]' : undefined}>
                {tv(perf.verdict === 'above' || perf.verdict === 'below' ? perf.verdict : 'unclear')}
              </ReadChip>
            </div>
            <p className={`m-0 text-base leading-[26px] text-ink ${WIDE}`}>
              {t.rich('body', { you: pc(g.you), exp: pc(g.exp), n: n(perf.n), b: (c) => <strong>{c}</strong> })}{' '}
              {t.rich(`gap.${headline}`, { gap: signed(g.gap), g: (c) => <strong className={color(g.gap)}>{c}</strong> })}
            </p>
            <p className={`m-0 text-[15px] leading-6 text-ink ${NARROW}`}>
              {t.rich('bodyShort', { you: pc(g.you), exp: pc(g.exp), n: n(perf.n), b: (c) => <strong>{c}</strong> })}{' '}
              {t.rich(`gapShort.${headline}`, { gap: signed(g.gap), g: (c) => <strong className={color(g.gap)}>{c}</strong> })}
            </p>
            {best && (best.performance.pve ?? 0) > 0 || worst && (worst.performance.pve ?? 0) < 0 ? (
              <p className={`m-0 text-sm leading-[22px] text-ink-dim ${WIDE}`}>
                {best && (best.performance.pve ?? 0) > 0 ? t('carries', { best: name(best.key) }) : null}
                {best && (best.performance.pve ?? 0) > 0 && worst && (worst.performance.pve ?? 0) < 0 ? ' ' : null}
                {worst && (worst.performance.pve ?? 0) < 0 ? t('pulls', { worst: name(worst.key) }) : null}
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-2.5 max-[719px]:flex-none">
            <div className="flex justify-between max-[719px]:mt-1">
              <span className="text-ink-dim signal-sm"><span className={WIDE}>{t('axisLow')}</span><span className={NARROW}>{t('axisLowShort')}</span></span>
              <span className="text-ink signal-sm"><span className={WIDE}>{t('axisMid')}</span><span className={NARROW}>{t('axisMidShort')}</span></span>
              <span className="text-ink-dim signal-sm"><span className={WIDE}>{t('axisHigh')}</span><span className={NARROW}>{t('axisHighShort')}</span></span>
            </div>
            <span className={WIDE}><HeroLine gap={g.gap} lo={g.lo} hi={g.hi} read={read} /></span>
            <span className={NARROW}><HeroLine gap={g.gap} lo={g.lo} hi={g.hi} read={read} compact /></span>
            <div className={`flex justify-between gap-3 ${WIDE}`}>
              <span className="text-[13px] text-ink-dim">{t.rich('interval', { lo: signed(g.lo), hi: signed(g.hi), b: (c) => <strong className="text-ink">{c}</strong> })}</span>
              <span className="text-[13px] text-ink-dim">{t.rich('wins', { wins: signed(perf.winsAbove ?? 0), n: n(perf.n), g: (c) => <strong className={color(perf.winsAbove ?? 0)}>{c}</strong> })}</span>
            </div>
            <span className={`text-[13px] text-ink-dim ${NARROW}`}>
              {t.rich('intervalShort', { lo: signed(g.lo), hi: signed(g.hi), b: (c) => <strong className="text-ink">{c}</strong> })}
              {' · '}
              {t.rich('winsShort', { wins: signed(perf.winsAbove ?? 0), g: (c) => <strong className={color(perf.winsAbove ?? 0)}>{c}</strong> })}
            </span>
          </div>
        </div>
      ) : null}

      <section aria-label={t('summary.label')} className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px border border-line bg-line max-[719px]:grid-cols-2">
        <Tile label={t('summary.games')} value={n(rec.games)} note={<Record w={rec.wins} l={rec.losses} d={rec.draws} />} />
        <Tile label={t('summary.matches')} value={n(rec.matches ?? 0)} note={<Record w={rec.matchWins ?? 0} l={rec.matchLosses ?? 0} d={rec.matchDraws ?? 0} />} />
        <Tile label={t('summary.rate')} value={g ? pc(g.you) : '–'} note={t('summary.rateNote')} />
        <Tile label={t('summary.expected')} value={g ? pc(g.exp) : '–'} note={t('summary.expectedNote')} gold />
        <div className={`flex flex-col gap-2 bg-surface-100 px-5 py-4.5 ${WIDE}`}>
          <span className="text-ink-muted signal">{t('summary.benchmarked')}</span>
          <span className="font-display text-[40px] leading-none text-ink">{n(perf?.n ?? 0)}</span>
          <Small>{t('summary.recordOnly', { n: n(rec.games - (perf?.n ?? 0)) })}</Small>
        </div>
        <div className={`col-span-2 bg-surface-100 px-4 py-3 ${NARROW}`}>
          <Small>{t('summary.recordOnlyShort', { n: n(perf?.n ?? 0), rest: n(rec.games - (perf?.n ?? 0)) })}</Small>
        </div>
      </section>

      {cards.length ? (
        <>
          <div className={`flex flex-col gap-4 ${NARROW}`}>
            {cards.map((c) => {
              const cg = gap(c.slice)
              return (
                <a key={c.label} href={`#${c.tab}`} className={`${PANEL} grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3.5 text-left`}>
                  <span className="col-span-3 text-ink-muted signal-sm">{c.label}</span>
                  <Art {...art(c.key)} name={c.name} size={36} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-bold text-ink">{c.name}</span>
                    <Small>{cg ? t('highlights.meta', { games: n(c.games), you: pc(cg.you), exp: pc(cg.exp) }) : t('highlights.games', { games: n(c.games) })}</Small>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={twMerge('font-display text-xl leading-none', cg ? tone(cg.gap) : 'text-draw')}>{cg ? signed(cg.gap) : '–'}</span>
                    <Verdict slice={c.slice} short />
                  </span>
                </a>
              )
            })}
          </div>
        </>
      ) : null}

      {/* Desktop: one 2-column flow, your best deck next to turn order, the method last. */}
      <div className="grid grid-cols-2 gap-6 max-[1023px]:grid-cols-1 max-[719px]:gap-4">
        {cards[0] ? wideCard(cards[0]) : null}
        {turn.length ? (
          <div className={`${PANEL} gap-4 p-6 max-[719px]:gap-3 max-[719px]:px-4 max-[719px]:py-5`}>
            <h3 className="m-0 font-display text-[22px] leading-[1.1] tracking-[0.01em] text-ink uppercase">{t('turn.title')}</h3>
            {turn.map(({ id, slice, g: tg }) => (
              <div key={id} className="flex flex-col gap-2 border-t border-line pt-3">
                <div className={`flex items-baseline justify-between gap-3 ${WIDE}`}>
                  <span className="font-bold text-ink">{t(`turn.${id}`)}</span>
                  <span className="text-[13px] text-ink-dim">
                    {tg ? t.rich('turn.row', { you: pc(tg.you), exp: pc(tg.exp), n: n(slice.n), e: (c) => <span className="text-gold">{c}</span> }) : t('turn.none')}
                  </span>
                </div>
                <div className={`flex items-center gap-3 ${WIDE}`}>
                  {tg ? <GapLine gap={tg.gap} lo={tg.lo} hi={tg.hi} read={readOf(slice)} range={20} size="turn" gold={false} className="flex-auto" /> : <span className="flex-auto" />}
                  <span className={twMerge('w-16 text-right font-bold', tg ? tone(tg.gap) : 'text-draw')}>{tg ? signed(tg.gap) : '–'}</span>
                  <VerdictIcon slice={slice} />
                </div>
                <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 ${NARROW}`}>
                  <span className="flex flex-col">
                    <span className="font-bold text-ink">{t(`turn.${id}`)}</span>
                    <Small>{tg ? t.rich('turn.row', { you: pc(tg.you), exp: pc(tg.exp), n: n(slice.n), e: (c) => <span className="text-gold">{c}</span> }) : t('turn.none')}</Small>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={twMerge('font-bold', tg ? tone(tg.gap) : 'text-draw')}>{tg ? signed(tg.gap) : '–'}</span>
                    <VerdictIcon slice={slice} />
                  </span>
                  {tg ? <GapLine gap={tg.gap} lo={tg.lo} hi={tg.hi} read={readOf(slice)} range={20} size="list" className="col-span-2" /> : null}
                </div>
              </div>
            ))}
            <Small className={WIDE}>{t('turn.note')}</Small>
          </div>
        ) : null}
        {cards.slice(1).map(wideCard)}
        <div className={`${PANEL} gap-4 p-6 max-[719px]:gap-3 max-[719px]:px-4 max-[719px]:py-5`}>
          <h3 className="m-0 font-display text-[22px] leading-[1.1] tracking-[0.01em] text-ink uppercase">{t('method.title')}</h3>
          <div className="flex flex-col gap-4 text-sm leading-6 text-ink-dim">
            <p className="m-0">{t.rich('method.expected', { b: (c) => <strong className="text-ink">{c}</strong> })}</p>
            <p className="m-0">{t.rich('method.verdict', { b: (c) => <strong className="text-ink">{c}</strong> })}</p>
            <p className={`m-0 ${WIDE}`}>{t.rich('method.benchmarked', { b: (c) => <strong className="text-ink">{c}</strong> })}</p>
          </div>
        </div>
      </div>

      <AdBanner id="ad-profile-overview" placement="content" className="mx-auto w-full max-w-[970px]" />
    </>
  )
}
