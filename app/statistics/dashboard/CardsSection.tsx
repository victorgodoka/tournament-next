'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { archKey, type MostUsedCard, type StatArchetype, type StatCard, type Statistics } from '@utils/statistics'
import { Art, Bar, cardName, faceOf, nameOf, NOTE, num, NUM, pct, ROW, SortHeads, sortBy, useSort, type Getters } from '../DeepDive'
import { CardSearch } from '../CardSearch'
import { CardDetail } from './CardDetail'
import { Drawer, FilterField, matches } from './controls'

type Tab = 'mostUsed' | 'byArchetype'
const FOLD = 10

/* ---------------------------------------------------------------- *
 * Most used: staples of both deck parts, popularity first
 * ---------------------------------------------------------------- */

type UsedSort = 'name' | 'popularity' | 'usageRate' | 'delta'
type UsedRow = MostUsedCard & { rank: number; samples: number; delta: number | null }
const USED_GET: Getters<UsedRow, UsedSort> = { name: cardName, popularity: (c) => c.popularity, usageRate: (c) => c.usageRate, delta: (c) => c.delta }
const USED_COLS = '32px minmax(200px, 2fr) minmax(120px, 1fr) minmax(90px, 0.7fr) minmax(80px, 0.7fr) minmax(160px, 1.2fr)'

/** `samples` is the popularity back in deck-games: ±1 game or so off, the API sends the rate rounded to 4 places. */
const MostUsed = ({ cards, totalGames, onOpen }: { cards: MostUsedCard[]; totalGames: number; onOpen: (card: MostUsedCard) => void }) => {
  const t = useTranslations('Statistics.cards')
  const [sort, onSort] = useSort<UsedSort>()
  const [expanded, setExpanded] = useState(false)
  const rows = sortBy(
    cards.map((c, i): UsedRow => ({
      ...c,
      rank: i + 1,
      samples: Math.round(c.popularity * totalGames),
      delta: c.winRateWith != null && c.winRateWithout != null ? c.winRateWith - c.winRateWithout : null,
    })),
    sort,
    USED_GET,
  )
  const visible = expanded ? rows : rows.slice(0, FOLD)
  return (
    <>
      <div className="max-h-[680px] overflow-auto">
        <div role="table" aria-label={t('tabs.mostUsed')} className="min-w-[760px] border border-line">
          <SortHeads
            sticky
            cols={USED_COLS}
            labels={['#', t('cols.card'), t('cols.popularity'), t('cols.deckGames'), t('cols.usage'), t('cols.withWithout')]}
            keys={[null, 'name', 'popularity', null, 'usageRate', 'delta']}
            sort={sort}
            onSort={onSort}
            right={(i) => i >= 2}
          />
          {visible.map((c) => (
            <button key={c.id} type="button" onClick={() => onOpen(c)} className={twMerge(ROW, 'w-full cursor-pointer text-left text-xs')} style={{ gridTemplateColumns: USED_COLS }}>
              <span className="font-mono text-ink-muted">{c.rank}</span>
              <span className="flex min-w-0 items-center gap-2">
                <Art card={c} size={28} className="size-7" />
                <span className="truncate font-semibold text-ink">{cardName(c)}</span>
                {c.extra ? <span className="font-mono text-[9px] text-cyan">{t('extra')}</span> : null}
                {c.handTrap ? <span className="font-mono text-[9px] text-gold">{t('handTrap')}</span> : null}
              </span>
              <Bar value={c.popularity} max={0.8} color="win" label={pct(c.popularity)} w={44} />
              <span className={twMerge(NUM, 'font-mono text-ink-muted')}>≈ {num(c.samples)}</span>
              <span className={twMerge(NUM, 'font-mono text-ink-dim')}>{pct(c.usageRate)}</span>
              <span className="flex items-center justify-end gap-1.5 whitespace-nowrap font-mono tabular-nums">
                <span className="font-semibold text-ink">{pct(c.winRateWith ?? c.winRateWhenUsed)}</span>
                {c.winRateWithout != null ? <span className="text-ink-muted">/ {pct(c.winRateWithout)}</span> : null}
                {c.delta != null ? (
                  <span className={twMerge('text-[10px] font-bold', c.delta > 0 ? 'text-win' : c.delta < 0 ? 'text-loss' : 'text-ink-muted')}>
                    {c.delta > 0 ? '+' : ''}{(c.delta * 100).toFixed(1)}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
      {rows.length > FOLD ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 cursor-pointer self-start text-[13px] text-azure-lift transition-colors hover:text-ink">
          {expanded ? t('showTop', { count: FOLD }) : t('showAll', { count: rows.length })}
        </button>
      ) : null}
      <p className={twMerge(NOTE, 'mt-3')}>{t('mostUsedNote')}</p>
    </>
  )
}

/* ---------------------------------------------------------------- *
 * By archetype: pick a deck, then its tracked cards
 * ---------------------------------------------------------------- */

const ARCH_COLS = '32px minmax(200px, 2fr) minmax(120px, 1fr) minmax(90px, 0.7fr) minmax(90px, 0.7fr)'
type CardSort = 'name' | 'inclusion' | 'sideRate' | 'averageCopies' | 'playRate' | 'winRateWhenUsed' | 'winRateInDeck'
const CARD_GET: Getters<StatCard, CardSort> = {
  name: cardName,
  inclusion: (c) => c.inclusion,
  sideRate: (c) => c.sideRate,
  averageCopies: (c) => c.averageCopies,
  playRate: (c) => c.playRate,
  winRateWhenUsed: (c) => c.winRateWhenUsed,
  winRateInDeck: (c) => c.winRateInDeck,
}
const CARD_COLS = 'minmax(200px, 2fr) minmax(120px, 1fr) repeat(5, minmax(72px, 0.7fr))'

const ByArchetype = ({ archetypes, staples, onOpen }: { archetypes: StatArchetype[]; staples: Map<number, MostUsedCard>; onOpen: (card: MostUsedCard) => void }) => {
  const t = useTranslations('Statistics.cards')
  const [archQuery, setArchQuery] = useState('')
  const [cardQuery, setCardQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [sort, onSort] = useSort<CardSort>()

  const decks = archQuery ? archetypes.filter((a) => matches(nameOf(a), archQuery)) : archetypes
  const visible = expanded || archQuery ? decks : decks.slice(0, FOLD)
  const focus = archetypes.find((a) => archKey(a.archetype) === picked) ?? archetypes[0]
  const cards = focus ? sortBy(cardQuery ? focus.cards.filter((c) => matches(cardName(c), cardQuery)) : focus.cards, sort, CARD_GET) : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <FilterField label={t('searchArchetype')} value={archQuery} onChange={setArchQuery} />
        <div className="overflow-x-auto">
          <div role="table" aria-label={t('tabs.byArchetype')} className="min-w-[600px] border border-line">
            <div role="row" className="grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm" style={{ gridTemplateColumns: ARCH_COLS }}>
              <span>#</span>
              <span>{t('cols.archetype')}</span>
              <span className={NUM}>{t('cols.share')}</span>
              <span className={NUM}>{t('cols.deckGames')}</span>
              <span className={NUM}>{t('cols.tracked')}</span>
            </div>
            {visible.map((a) => {
              const key = archKey(a.archetype)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={focus === a}
                  onClick={() => setPicked(key)}
                  className={twMerge(ROW, 'w-full cursor-pointer text-left aria-pressed:bg-ground-cyan aria-pressed:text-ink aria-pressed:shadow-selected')}
                  style={{ gridTemplateColumns: ARCH_COLS }}
                >
                  <span className="font-mono text-xs text-ink-muted">{archetypes.indexOf(a) + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <Art card={faceOf(a)} size={28} className="size-7" />
                    <span className="truncate font-bold text-ink">{nameOf(a)}</span>
                  </span>
                  <Bar value={a.metaShare} max={archetypes[0]?.metaShare || 1} label={pct(a.metaShare)} w={48} />
                  <span className={twMerge(NUM, 'text-xs')}>{num(a.games)}</span>
                  <span className={twMerge(NUM, 'text-xs')}>{a.cards.length}</span>
                </button>
              )
            })}
          </div>
        </div>
        {!archQuery && decks.length > FOLD ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start cursor-pointer text-[13px] text-azure-lift transition-colors hover:text-ink">
            {expanded ? t('showTop', { count: FOLD }) : t('showAll', { count: decks.length })}
          </button>
        ) : null}
      </div>

      {focus ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 display-3">
              <Art card={faceOf(focus)} size={28} className="size-7" />
              {t('cardsOf', { name: nameOf(focus) })}
            </h3>
            <FilterField label={t('searchCard')} value={cardQuery} onChange={setCardQuery} />
          </div>
          <div className="overflow-x-auto">
            <div role="table" aria-label={t('cardsOf', { name: nameOf(focus) })} className="min-w-[800px] border border-line">
              <SortHeads
                cols={CARD_COLS}
                labels={[t('cols.card'), t('cols.inclusion'), t('cols.side'), t('cols.copies'), t('cols.played'), t('cols.wrUsed'), t('cols.wrInDeck')]}
                keys={['name', 'inclusion', 'sideRate', 'averageCopies', 'playRate', 'winRateWhenUsed', 'winRateInDeck']}
                sort={sort}
                onSort={onSort}
                right={(i) => i > 1}
              />
              {cards.map((c) => {
                const staple = staples.get(c.id)
                const cells = (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <Art card={c} size={28} className="size-7" />
                      <span className="truncate font-bold text-ink">{cardName(c)}</span>
                    </span>
                    <Bar value={c.inclusion} label={pct(c.inclusion)} w={48} />
                    <span className={NUM}>{pct(c.sideRate)}</span>
                    <span className={NUM}>{c.averageCopies.toFixed(2)}</span>
                    <span className={NUM}>{pct(c.playRate)}</span>
                    <span className={twMerge(NUM, 'font-bold text-ink')}>{pct(c.winRateWhenUsed)}</span>
                    <span className={NUM}>{pct(c.winRateInDeck)}</span>
                  </>
                )
                // A staple has season-wide figures for the drawer; a deck's own card only has this row.
                return staple ? (
                  <button key={c.id} type="button" onClick={() => onOpen(staple)} className={twMerge(ROW, 'w-full cursor-pointer text-left')} style={{ gridTemplateColumns: CARD_COLS }}>
                    {cells}
                  </button>
                ) : (
                  <div key={c.id} role="row" className={ROW} style={{ gridTemplateColumns: CARD_COLS }}>
                    {cells}
                  </div>
                )
              })}
              {!cards.length ? <p className={twMerge(NOTE, 'px-4 py-3')}>{t('noCards')}</p> : null}
            </div>
          </div>
          <p className={NOTE}>{t('byArchetypeNote')}</p>
        </div>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------------- *
 * The section
 * ---------------------------------------------------------------- */

export const CardsSection = ({ season, main, extra, archetypes, totalGames }: {
  season: Statistics['season']
  main: MostUsedCard[]
  extra: MostUsedCard[]
  archetypes: StatArchetype[]
  totalGames: number
}) => {
  const t = useTranslations('Statistics.cards')
  const [tab, setTab] = useState<Tab>('mostUsed')
  const [open, setOpen] = useState<MostUsedCard | null>(null)
  const all = [...main, ...extra].sort((a, b) => b.popularity - a.popularity)
  const staples = new Map(all.map((c) => [c.id, c]))

  return (
    <Panel title={t('title')} meta={t('meta')}>
      <TabBar tabs={(['mostUsed', 'byArchetype'] as const).map((id) => ({ id, label: t(`tabs.${id}`) }))} active={tab} onSelect={setTab} label={t('tabsLabel')} idPrefix="cards-tab" fit className="mb-4" />
      {tab === 'mostUsed' ? (
        <div className="flex flex-col gap-4">
          {/* A card in the list opens straight away; any other is read (or calculated) from the API first. */}
          <CardSearch key={season.code} season={season} onLocal={(id) => (staples.has(id) ? (setOpen(staples.get(id)!), true) : false)} onCard={(c) => c && setOpen(c)} />
          <MostUsed cards={all} totalGames={totalGames} onOpen={setOpen} />
        </div>
      ) : (
        <ByArchetype archetypes={archetypes} staples={staples} onOpen={setOpen} />
      )}
      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open ? cardName(open) : ''} closeLabel={t('close')}>
        {open ? <CardDetail card={open} /> : null}
      </Drawer>
    </Panel>
  )
}
