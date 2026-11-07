'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { cardsByIds } from '@utils/cards'
import { deckHref, effectPoints, getDeck, matchupCall, MIN_MATCHUP_GAMES, plainDecks, scopeFrom, scopeQuery, type AgainstCard, type DeckAnswer, type DeckStat, type Matchup, type Meta, type SampleCard, type SampleDeck, type Scope } from '@utils/statistics'
import type { WikiCard } from '@utils/wiki'
import { Art, at, Box, CopyButton, CountLine, DeckSearch, facesOf, frameColor, subFace, type Faces, GapTrack, HEAD_ROW, DECK_NAME, Label, LINK_BTN, n, NARROW, NUMERIC, pc, PanelTitle, ReadChip, ROW, ROWS, SectionHead, signed, Small, TH, TierChip, tone, WIDE, ydk, type Read } from '../kit'
import { cardName, nameOf } from '../shared'

const R = 16
const MU_COLS = 'minmax(240px, 1.2fr) 88px 180px minmax(320px, 2.2fr) 160px'
const CARD_COLS = 'minmax(0, 1fr) 96px 160px'
const DROP_SCALE = 8
const READ_OF = { favorable: 'good', unfavorable: 'bad', neutral: 'flat' } as const

type Loaded = { key: string; answer: DeckAnswer | null }

/** Pick a deck, read its answer from the browser: only the viewer's picks spend the viewer's rate limit. Opens on the most played. */
export const HowToBeat = ({ meta, scope }: { meta: Meta; scope: Scope }) => {
  const t = useTranslations('Statistics.beat')
  const decks = useMemo(() => plainDecks(meta.decks).sort((a, b) => b.share - a.share), [meta.decks])
  const faces = facesOf(meta.decks)
  const [key, setKey] = useState(decks[0]?.key ?? '')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [cards, setCards] = useState<ReadonlyMap<number, WikiCard>>(new Map())
  const query = scopeQuery(scope)

  // keyed by the query, not the object: a new scope with the same query is the same answer
  useEffect(() => {
    if (!key) return
    let live = true
    getDeck(key, scopeFrom(Object.fromEntries(new URLSearchParams(query)))).then((r) => {
      if (!live) return
      setLoaded({ key, answer: r.ok ? r.data : null })
      if (!r.ok) return
      const { against, sampleDeck } = r.data
      const ids = [...against.map((c) => c.id), ...(sampleDeck ? [...sampleDeck.main, ...sampleDeck.extra].map((c) => c.id) : [])]
      cardsByIds(ids).then((found) => live && setCards((had) => new Map([...had, ...found])), () => {})
    })
    return () => {
      live = false
    }
  }, [key, query])

  const deck = decks.find((d) => d.key === key)
  const answer = loaded?.key === key ? loaded.answer : undefined

  if (!deck) {
    return (
      <>
        <SectionHead title={t('title')} lede={t('lede')} />
        <p className="text-[13px] leading-5 text-ink-muted">{t('empty')}</p>
      </>
    )
  }

  const name = nameOf(deck)
  const face = answer?.deck.face ?? deck.face
  const options = decks.map((d) => ({ value: d.key, label: nameOf(d), face: d.face, sub: subFace(d.key, faces), hint: pc(d.share) }))
  const stats = [
    { id: 'expected', value: <span className="font-display text-2xl leading-none text-ink">{pc(deck.wrExpected)}</span>, mobile: pc(deck.wrExpected) },
    { id: 'tier', value: deck.tier !== null ? <TierChip tier={deck.tier} /> : <span className="text-ink-muted signal-sm">–</span>, mobile: deck.tier !== null ? `T${deck.tier}` : '–' },
    { id: 'meta', value: <span className="font-display text-2xl leading-none text-ink">{pc(deck.share)}</span>, mobile: pc(deck.share) },
    { id: 'games', value: <span className="font-display text-2xl leading-none text-ink">{n(deck.games)}</span>, mobile: n(deck.games) },
  ]

  return (
    <>
      <SectionHead title={t('title')} lede={<><span className={WIDE}>{t('lede')}</span><span className={NARROW}>{t('ledeShort')}</span></>} />

      <Box className={twMerge('flex-row flex-wrap items-end gap-x-8 gap-y-5 px-6 py-5 focus-within:z-10', WIDE)}>
        <Art id={face} sub={subFace(key, faces)} name={name} size={80} className="self-end" />
        <div className="flex max-w-105 flex-[1_1_300px] flex-col gap-2">
          <Label htmlFor="f-deck">{t('deck')}</Label>
          <DeckSearch id="f-deck" value={key} onChange={setKey} options={options} placeholder={t('search')} empty={t('noMatch')} />
        </div>
        <div className="flex flex-wrap gap-8">
          {stats.map((s) => (
            <div key={s.id} className="flex flex-col gap-1.5">
              <span className="text-ink-muted signal">{t(`stats.${s.id}`)}</span>
              {s.value}
            </div>
          ))}
        </div>
        <Button variant="secondary" size="signal" href={deckHref(key, scope)} className="ml-auto px-5">{t('open')}</Button>
      </Box>
      <Box className={twMerge('gap-3.5 p-4 focus-within:z-10', NARROW)}>
        <div className="flex items-end gap-3">
          <Art id={face} sub={subFace(key, faces)} name={name} size={64} />
          <div className="flex min-w-0 flex-auto flex-col gap-2">
            <Label htmlFor="m-deck">{t('deck')}</Label>
            <DeckSearch id="m-deck" value={key} onChange={setKey} options={options} placeholder={t('search')} empty={t('noMatch')} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-px border border-line bg-line">
          {stats.map((s) => (
            <div key={s.id} className="flex flex-col gap-1 bg-surface-200 p-2.5">
              <span className="text-ink-muted signal-sm">{t(`stats.${s.id}Short`)}</span>
              <span className={twMerge('font-display text-lg leading-none', s.id === 'tier' && deck.tier !== null ? 'text-gold' : 'text-ink')}>{s.mobile}</span>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="signal" href={deckHref(key, scope)} className="w-full">{t('open')}</Button>
      </Box>

      {answer === undefined ? (
        <p role="status" className="text-[13px] leading-5 text-ink-muted">{t('loading')}</p>
      ) : answer === null ? (
        <p role="status" className="text-[13px] leading-5 text-ink-muted">{t('failed')}</p>
      ) : (
        <>
          <Matchups name={name} matchups={answer.matchups} scope={scope} faces={faces} />
          <div className={twMerge('flex flex-wrap items-stretch gap-6', WIDE)}>
            <UsedAgainst name={name} against={answer.against} cards={cards} />
            <FirstOrSecond deck={answer.deck} name={name} average={effectPoints(meta.fit.firstEffect)} />
          </div>
          <div className={twMerge('flex flex-col gap-4', NARROW)}>
            <FirstOrSecond deck={answer.deck} name={name} average={effectPoints(meta.fit.firstEffect)} />
            <UsedAgainst name={name} against={answer.against} cards={cards} />
          </div>
          {answer.sampleDeck ? <Sample deck={answer.sampleDeck} name={name} cards={cards} ladder={scope.ladder} /> : null}
        </>
      )}
    </>
  )
}

/**
 * A matchup from the opponent's seat: the page asks how to beat the picked deck. `edge` is who wins the pairing
 * (the interval clear of 50%); `read` and the gap, whether it goes better or worse than the prediction.
 */
const sideOf = (m: Matchup) => {
  const opp = { wrExpected: 1 - m.wrExpected, wrAdjusted: 1 - m.wrAdjusted, wrLo: 1 - m.wrHi, wrHi: 1 - m.wrLo }
  const read: Read = READ_OF[matchupCall(opp)]
  const edge: Read = opp.wrLo > 0.5 ? 'good' : opp.wrHi < 0.5 ? 'bad' : 'flat'
  const gap = (opp.wrAdjusted - opp.wrExpected) * 100
  return { ...opp, gap, low: (opp.wrLo - opp.wrExpected) * 100, high: (opp.wrHi - opp.wrExpected) * 100, read, edge }
}

/** The deck's adjusted result against each opponent beside the prediction, best first; under the floor, hidden until asked for. */
const Matchups = ({ name, matchups, scope, faces }: { name: string; matchups: Matchup[]; scope: Scope; faces: Faces }) => {
  const t = useTranslations('Statistics.beat.matchups')
  const [low, setLow] = useState(false)
  const edgeText = (e: Read) => t(e === 'good' ? 'beats' : e === 'bad' ? 'loses' : 'even')
  const byAnswer = [...matchups].sort((a, b) => a.wrAdjusted - b.wrAdjusted)
  const main = byAnswer.filter((m) => m.games >= MIN_MATCHUP_GAMES)
  const small = byAnswer.filter((m) => m.games < MIN_MATCHUP_GAMES)
  const label = (m: Matchup) => nameOf({ key: m.opponent, name: m.opponentName })
  const link = (m: Matchup, className: string) =>
    m.opponent ? <Link href={deckHref(m.opponent, scope)} className={twMerge(DECK_NAME, 'font-bold hover:text-cyan', className)}>{label(m)}</Link> : <span className={twMerge(DECK_NAME, 'font-bold', className)}>{label(m)}</span>
  const toggle = small.length ? (
    <button type="button" aria-expanded={low} onClick={() => setLow(!low)} className={LINK_BTN}>
      {low ? t('hideLow', { min: MIN_MATCHUP_GAMES }) : t('showLow', { count: small.length, min: MIN_MATCHUP_GAMES })}
    </button>
  ) : <span />

  return (
    <Box className="pt-6 max-[719px]:pt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-6 pb-4 max-[719px]:px-4 max-[719px]:pb-3">
        <div className="flex flex-col gap-1">
          <PanelTitle>{t('title')}</PanelTitle>
          <p className="m-0 text-[13px] leading-5 text-ink-dim"><span className={WIDE}>{t('lede', { name })}</span><span className={NARROW}>{t('ledeShort')}</span></p>
        </div>
        <div aria-hidden className={twMerge('flex flex-wrap gap-4', WIDE)}>
          <span className="flex items-center gap-1.5 text-win signal-sm"><span className="h-1.5 w-2.5 rounded-xs bg-win" />{t('above')}</span>
          <span className="flex items-center gap-1.5 text-loss signal-sm"><span className="h-1.5 w-2.5 rounded-xs bg-loss" />{t('below')}</span>
          <span className="flex items-center gap-1.5 text-draw signal-sm"><span className="h-1.5 w-2.5 rounded-xs bg-[#4a5578]" />{t('unclear')}</span>
        </div>
      </div>

      <div className={twMerge('overflow-x-auto', WIDE)}>
        <div role="table" aria-label={t('aria', { name })} className={twMerge(ROWS, 'min-w-205 border-t border-line')}>
          <div role="row" className={HEAD_ROW} style={{ gridTemplateColumns: MU_COLS }}>
            <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.opponent')}</span>
            <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.games')}</span>
            <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.actual', { name })}</span>
            <span role="columnheader" aria-label={t('axis', { r: R })} className="relative mx-3 block h-11">
              <span className="absolute top-4 left-0 text-ink-muted signal-sm">−{R}</span>
              <span className="absolute top-4 left-1/2 -translate-x-1/2 text-ink-muted signal-sm">0</span>
              <span className="absolute top-4 right-0 text-ink-muted signal-sm">{t('axisEnd', { r: R })}</span>
            </span>
            <span role="columnheader" className={twMerge(TH, 'pr-6 text-right')}>{t('cols.read')}</span>
          </div>
          {main.map((m) => {
            const g = sideOf(m)
            return (
              <div key={m.opponent} role="row" className={twMerge(ROW, 'min-h-15')} style={{ gridTemplateColumns: MU_COLS }}>
                <span role="cell" className="flex min-w-0 items-center gap-3 pl-6"><Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={44} />{link(m, 'text-ink')}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{n(m.games)}</span>
                <span role="cell" className="flex items-baseline gap-1.5 pl-6">
                  <span className="font-bold text-ink tabular-nums">{pc(g.wrAdjusted)}</span>
                  <span className="text-[13px] text-ink-muted tabular-nums">/ {pc(g.wrExpected)}</span>
                </span>
                <span role="cell" className="mx-3"><GapTrack gap={g.gap} low={g.low} high={g.high} range={R} h={52} read={g.read} /></span>
                <span role="cell" className="flex items-center justify-end gap-2.5 pr-6">
                  <span className={twMerge('text-[13px] font-bold tabular-nums', tone(g.gap))}>{signed(g.gap)}</span>
                  <ReadChip read={g.edge} className="px-2">{edgeText(g.edge)}</ReadChip>
                </span>
              </div>
            )
          })}
          {low
            ? small.map((m) => {
                const g = sideOf(m)
                return (
                  <div key={m.opponent} role="row" className="grid min-h-15 items-center bg-surface-100" style={{ gridTemplateColumns: MU_COLS }}>
                    <span role="cell" className="flex min-w-0 items-center gap-3 pl-6">
                      <Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={44} dim />
                      <span className="flex min-w-0 flex-col leading-4.5 text-ink-dim">
                        {link(m, '')}
                        <span className="text-ink-muted signal-sm">{t('under', { min: MIN_MATCHUP_GAMES })}</span>
                      </span>
                    </span>
                    <span role="cell" className={twMerge(NUMERIC, 'text-ink-muted')}>{n(m.games)}</span>
                    <span role="cell" className="flex items-baseline gap-1.5 pl-6">
                      <span className="text-ink-dim tabular-nums">{pc(g.wrAdjusted)}</span>
                      <span className="text-[13px] text-ink-muted tabular-nums">/ {pc(g.wrExpected)}</span>
                    </span>
                    <span role="cell" className="mx-3"><GapTrack gap={g.gap} low={g.low} high={g.high} range={R} h={52} read={g.read} dim /></span>
                    <span role="cell" className={twMerge(NUMERIC, 'pr-6 text-[13px] opacity-75', tone(g.gap))}>{signed(g.gap)}</span>
                  </div>
                )
              })
            : null}
        </div>
      </div>

      <div role="list" aria-label={t('aria', { name })} className={twMerge(ROWS, 'border-t border-line', NARROW)}>
        {main.map((m) => {
          const g = sideOf(m)
          return (
            <div key={m.opponent} role="listitem" className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 bg-surface-100 px-4 py-3">
              <Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={44} />
              <span className="flex min-w-0 flex-col">
                {link(m, 'text-ink')}
                <Small>{t('rowMeta', { act: pc(g.wrAdjusted), exp: pc(g.wrExpected), games: n(m.games) })}</Small>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className={twMerge('text-sm font-bold tabular-nums', tone(g.gap))}>{signed(g.gap)}</span>
                <ReadChip read={g.edge}>{edgeText(g.edge)}</ReadChip>
              </span>
              <span className="col-[2/4]"><GapTrack gap={g.gap} low={g.low} high={g.high} range={R} h={14} read={g.read} /></span>
            </div>
          )
        })}
        {low
          ? small.map((m) => {
              const g = sideOf(m)
              return (
                <div key={m.opponent} role="listitem" className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 bg-surface-100 px-4 py-3">
                  <Art id={m.opponentFace ?? faces[m.opponent]} sub={subFace(m.opponent, faces)} name={label(m)} size={44} dim />
                  <span className="flex min-w-0 flex-col">
                    {link(m, 'text-ink-dim')}
                    <Small>{t('underRow', { min: MIN_MATCHUP_GAMES, games: n(m.games) })}</Small>
                  </span>
                  <span className={twMerge('text-[13px] opacity-75 tabular-nums', tone(g.gap))}>{signed(g.gap)}</span>
                </div>
              )
            })
          : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line px-6 py-1.5 max-[719px]:px-4 max-[719px]:py-0">
        {toggle}
        <span className={twMerge('text-[13px] leading-5 text-ink-muted', WIDE)}>{t('whisker')}</span>
      </div>
    </Box>
  )
}

const KIND_ORDER = ['monster', 'spell', 'trap'] as const

/** What opponents use on the deck, and how much less it wins when the card shows up. */
const UsedAgainst = ({ name, against, cards }: { name: string; against: AgainstCard[]; cards: ReadonlyMap<number, WikiCard> }) => {
  const t = useTranslations('Statistics.beat.against')
  const rows = against.map((c) => {
    const drop = c.winRate != null && c.winRateWithout != null ? (c.winRate - c.winRateWithout) * 100 : null
    // ponytail: the with-card side's binomial SE alone, a floor on the gap's; swap for the server's interval when it sends one
    const clear = drop !== null && c.games > 0 && Math.abs(drop) > 196 * Math.sqrt((c.winRate! * (1 - c.winRate!)) / c.games)
    return { c, drop, clear }
  })
  const color = (drop: number | null, clear: boolean) => (drop === null || !clear ? 'text-ink-muted' : drop < 0 ? 'text-loss' : 'text-win')
  return (
    <Box className="pt-6 min-[720px]:min-w-0 min-[720px]:flex-[2_1_560px] max-[719px]:pt-4">
      <div className="flex flex-col gap-1 px-6 pb-4 max-[719px]:px-4 max-[719px]:pb-3">
        <PanelTitle>{t('title')}</PanelTitle>
        <p className="m-0 text-[13px] leading-5 text-ink-dim"><span className={WIDE}>{t('lede', { name })}</span><span className={NARROW}>{t('ledeShort', { name })}</span></p>
      </div>
      {rows.length ? (
        <>
          <div role="table" aria-label={t('aria', { name })} className={twMerge(ROWS, 'border-t border-line', WIDE)}>
            <div role="row" className={HEAD_ROW} style={{ gridTemplateColumns: CARD_COLS }}>
              <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.card')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.seen')}</span>
              <span role="columnheader" className={twMerge(TH, 'pr-6 text-right')}>{t('cols.win', { name })}</span>
            </div>
            {rows.map(({ c, drop, clear }) => (
              <div key={c.id} role="row" className={twMerge(ROW, 'min-h-15')} style={{ gridTemplateColumns: CARD_COLS }}>
                <span role="cell" className="flex min-w-0 items-center gap-3 pl-6">
                  <span aria-hidden className="h-7 w-1 flex-none" style={{ background: frameColor(cards.get(c.id)) }} />
                  <span className="truncate font-bold text-ink">{cardName(c)}</span>
                </span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(c.rate)}</span>
                <span role="cell" className="flex items-center justify-end gap-2.5 pr-6">
                  <span aria-hidden className="relative block h-1.5 w-16 bg-surface-200">
                    {drop !== null ? <span className={twMerge('absolute top-0 right-0 bottom-0 rounded-l-xs', !clear ? 'bg-line-mid' : drop < 0 ? 'bg-loss' : 'bg-win')} style={{ width: at(Math.abs(drop), 0, DROP_SCALE) }} /> : null}
                  </span>
                  <span className={twMerge('min-w-15 text-right text-[13px] font-bold tabular-nums', color(drop, clear))}>{drop === null ? '–' : t('pts', { value: signed(drop) })}</span>
                </span>
              </div>
            ))}
          </div>
          <div role="list" aria-label={t('aria', { name })} className={twMerge(ROWS, 'border-t border-line', NARROW)}>
            {rows.map(({ c, drop, clear }) => (
              <div key={c.id} role="listitem" className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3 bg-surface-100 px-4 py-2.5">
                <span aria-hidden className="h-7.5" style={{ background: frameColor(cards.get(c.id)) }} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-bold text-ink">{cardName(c)}</span>
                  <Small>{t('seenRow', { rate: pc(c.rate) })}</Small>
                </span>
                <span className={twMerge('text-sm font-bold tabular-nums', color(drop, clear))}>{drop === null ? '–' : t('pts', { value: signed(drop) })}</span>
              </div>
            ))}
          </div>
          <p className="m-0 border-t border-line px-6 py-3 text-xs leading-4 font-medium text-ink-muted max-[719px]:px-4">{t('note')}</p>
          <div className={twMerge('mt-auto flex flex-wrap items-center gap-4 border-t border-line px-6 py-3.5', WIDE)}>
            {KIND_ORDER.map((kind) => (
              <span key={kind} className="flex items-center gap-1.5 text-ink-muted signal-sm">
                <span aria-hidden className="h-3 w-1" style={{ background: `var(--color-type-${kind === 'monster' ? 'effect' : kind})` }} />
                {t(`kinds.${kind}`)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="m-0 border-t border-line px-6 py-4 text-[13px] leading-5 text-ink-muted max-[719px]:px-4">{t('empty')}</p>
      )}
    </Box>
  )
}

/** Game 1 by turn order: games 2–3 are confounded by the loser's choice. */
const FirstOrSecond = ({ deck, name, average }: { deck: DeckStat; name: string; average: number }) => {
  const t = useTranslations('Statistics.beat.turn')
  const lift = deck.firstG1Wr != null && deck.secondG1Wr != null ? (deck.firstG1Wr - deck.secondG1Wr) * 100 : null
  const sides = [
    { id: 'first', rate: deck.firstG1Wr, games: deck.firstG1Games, bar: 'bg-series-1' },
    { id: 'second', rate: deck.secondG1Wr, games: deck.secondG1Games, bar: 'bg-series-3' },
  ] as const
  const strong = (chunks: React.ReactNode, value: number) => <strong className={tone(value)}>{chunks}</strong>
  return (
    <Box className="gap-4.5 p-6 min-[720px]:min-w-0 min-[720px]:flex-[1_1_300px] max-[719px]:gap-3 max-[719px]:p-5">
      <div className="flex flex-col gap-1 max-[719px]:contents">
        <PanelTitle>{t('title')}</PanelTitle>
        <span className="text-ink-muted signal-sm">{t('stamp', { games: n(deck.g1Games) })}</span>
      </div>
      <div className="grid grid-cols-2 gap-px border border-line bg-line">
        {sides.map((s) => (
          <div key={s.id} className="flex flex-col gap-2 bg-surface-200 p-4 max-[719px]:gap-1.5 max-[719px]:p-3">
            <span className="text-ink-muted signal max-[719px]:text-[10px] max-[719px]:leading-3 max-[719px]:tracking-[0.16em]">{t(s.id)}</span>
            <span className="font-display text-[40px] leading-none text-ink max-[719px]:text-[30px]">{pc(s.rate)}</span>
            {s.games != null ? <span className={twMerge('text-xs leading-4 font-medium text-ink-muted', WIDE)}>{t('games', { count: n(s.games) })}</span> : null}
          </div>
        ))}
      </div>
      <div className={twMerge('grid grid-cols-[64px_1fr] items-center gap-3', WIDE)}>
        {sides.map((s) => (
          <span key={s.id} className="contents">
            <span className="text-ink-muted signal-sm">{t(`${s.id}Short`)}</span>
            <span aria-hidden className="relative block h-2.5 bg-surface-200">
              {s.rate != null ? <span className={twMerge('absolute top-0 bottom-0 left-0 rounded-r-xs', s.bar)} style={{ width: at(s.rate, 0.4, 0.7) }} /> : null}
              <span className="absolute -top-1 -bottom-1 left-1/3 w-px bg-line-strong" />
            </span>
          </span>
        ))}
      </div>
      {lift !== null ? (
        <p className="m-0 text-[13px] leading-5 text-ink-dim">
          {t.rich('text', { name, deck: t('pts', { value: signed(lift) }), average: signed(average), d: (c) => strong(c, lift), a: (c) => strong(c, average) })}
          {lift > 0 ? ` ${t('advice')}` : null}
        </p>
      ) : null}
      <p className={twMerge('m-0 mt-auto border-t border-line pt-3 text-xs leading-4 font-medium text-ink-muted', WIDE)}>{t('note')}</p>
    </Box>
  )
}

const total = (cards: SampleCard[]) => cards.reduce((sum, c) => sum + c.count, 0)
const CHIP = 'cut inline-flex h-6 items-center px-2.5 whitespace-nowrap signal-chip [--cut:var(--cut-xs)]'

/** The archetype's sample list by card kind; until the kinds land, main and extra. */
const Sample = ({ deck, name, cards, ladder }: { deck: SampleDeck; name: string; cards: ReadonlyMap<number, WikiCard>; ladder: Scope['ladder'] }) => {
  const t = useTranslations('Statistics.beat.sample')
  const typed = deck.main.every((c) => cards.has(c.id))
  const columns = typed
    ? [
        ...KIND_ORDER.map((kind) => ({ id: kind, list: deck.main.filter((c) => cards.get(c.id)!.kind === kind) })),
        { id: 'extra' as const, list: deck.extra },
      ]
    : [{ id: 'main' as const, list: deck.main }, { id: 'extra' as const, list: deck.extra }]
  const chip = { monster: 'text-ink [--edge:var(--color-type-effect)] [--fill:var(--color-type-effect)]', spell: 'text-space-000 [--edge:var(--color-type-spell)] [--fill:var(--color-type-spell)]', trap: 'text-ink [--edge:var(--color-type-trap)] [--fill:var(--color-type-trap)]', extra: 'text-ink [--edge:var(--color-type-link)] [--fill:var(--color-type-link)]', main: 'text-ink [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)]' }
  const copy = (
    <CopyButton
      text={ydk(deck)}
      label={t('copy')}
      done={t('copied')}
      className="cut inline-flex min-h-10 cursor-pointer items-center px-3.5 text-ink signal-strong [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)] max-[719px]:min-h-9 max-[719px]:px-3"
    />
  )
  return (
    <Box className="gap-4.5 p-6 max-[719px]:gap-3.5 max-[719px]:p-5">
      <div className={twMerge('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', WIDE)}>
        <div className="flex flex-col gap-1">
          <PanelTitle>{t('title')}</PanelTitle>
          <p className="m-0 text-[13px] leading-5 text-ink-dim">{t('lede', { name, ladder: ladder === 'genesys' ? 'Genesys' : 'TCG' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {columns.map((c) => <span key={c.id} className={twMerge(CHIP, chip[c.id])}>{t('chip', { type: t(`kinds.${c.id}`), count: total(c.list) })}</span>)}
          <span className="ml-2">{copy}</span>
        </div>
      </div>
      <div className={twMerge('flex items-center justify-between gap-3', NARROW)}>
        <PanelTitle>{t('title')}</PanelTitle>
        {copy}
      </div>
      <p className={twMerge('m-0 text-[13px] leading-5 text-ink-dim', NARROW)}>{t('ledeShort')}</p>
      <div className="grid gap-x-6 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] max-[719px]:gap-y-3.5">
        {columns.map((c) => (
          <div key={c.id} className="flex flex-col">
            <span className="border-b border-line pb-2 text-ink-muted signal max-[719px]:pb-1.5">{t('column', { type: t(`kinds.${c.id}`), count: total(c.list) })}</span>
            {c.list.map((card) => <CountLine key={card.id} count={card.count} name={card.name ?? cardName({ id: card.id, name: cards.get(card.id)?.name ?? null })} />)}
          </div>
        ))}
      </div>
    </Box>
  )
}
