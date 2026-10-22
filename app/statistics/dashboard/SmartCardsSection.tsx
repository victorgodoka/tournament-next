'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@iconify/react'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { Chip } from '@ui/chip'
import { pct, num, cardName, Art, Bar, NOTE, ROW, NUM } from '../DeepDive'
import type { MostUsedCard, CardCombination, StatArchetype } from '@utils/statistics'

type CardsTabMode = 'mostUsed' | 'byArchetype' | 'mainExtra' | 'combinations'

type SmartCardsSectionProps = {
  main: MostUsedCard[]
  extra: MostUsedCard[]
  combinations?: CardCombination[]
  selectedArchetype?: StatArchetype
  onPickCard?: (id: number) => void
  selectedCardId?: number | null
}

const TABS = [
  { id: 'mostUsed' as const, label: 'Mais usadas' },
  { id: 'byArchetype' as const, label: 'Por arquétipo' },
  { id: 'mainExtra' as const, label: 'Main vs Extra' },
  { id: 'combinations' as const, label: 'Combinações' },
] satisfies ReadonlyArray<{ id: CardsTabMode; label: string }>

const COLS = '36px minmax(180px, 2.2fr) minmax(110px, 1fr) minmax(100px, 1fr) minmax(120px, 1.2fr)'

export const SmartCardsSection = ({
  main,
  extra,
  combinations = [],
  selectedArchetype,
  onPickCard,
  selectedCardId,
}: SmartCardsSectionProps) => {
  const [activeTab, setActiveTab] = useState<CardsTabMode>('mostUsed')
  const [sideFilter, setSideFilter] = useState<'all' | 'main' | 'extra'>('all')

  const cardsList = (() => {
    if (activeTab === 'byArchetype') {
      return (selectedArchetype?.cards ?? []).map((c, i) => ({
        id: c.id,
        name: c.name,
        handTrap: false,
        extra: false,
        popularity: c.inclusion,
        usageRate: c.playRate,
        winRateWhenUsed: c.winRateWhenUsed,
        winRateWith: c.winRateInDeck,
        winRateWithout: null,
        detail: {
          decklists: { mainExtra: c.inclusion, side: null },
          usage: { game1: null, postSide: null },
          winRate: { match: null, game1: null, postSide: null },
          responded: { activations: 0, rate: null, dominus: null, yokaiGirls: null, psyFrame: null, calledCrossout: null, impermanence: null, mulcharmy: null, solemn: null, others: null }
        }
      })) as MostUsedCard[]
    }
    if (activeTab === 'mainExtra') {
      return sideFilter === 'extra' ? extra : sideFilter === 'main' ? main : [...main.slice(0, 15), ...extra.slice(0, 10)]
    }
    // mostUsed
    return [...main]
  })()

  return (
    <Panel
      title="Estatísticas de cartas"
      meta={activeTab === 'combinations' ? `${combinations.length} sinergias` : `${cardsList.length} cartas`}
    >
      <div className="flex flex-col gap-4">
        {/* Tab selection */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line">
          <TabBar
            tabs={TABS}
            active={activeTab}
            onSelect={setActiveTab}
            label="Categorias de cartas"
            idPrefix="cards-tab"
            fit
            className="border-b-0"
          />
          {activeTab === 'mainExtra' && (
            <div className="flex gap-1 py-1">
              {(['all', 'main', 'extra'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setSideFilter(side)}
                  className={twMerge(
                    'px-2.5 py-1 text-xs rounded-xs transition-colors cursor-pointer capitalize font-mono',
                    sideFilter === side
                      ? 'bg-azure text-ink font-bold'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-200'
                  )}
                >
                  {side === 'all' ? 'Todas' : side}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'combinations' ? (
          /* Combinações view */
          <div className="flex flex-col gap-3">
            {combinations.length === 0 ? (
              <p className={NOTE}>Nenhuma combinação de staples identificada para o filtro atual.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {combinations.slice(0, 8).map((c, i) => (
                  <div
                    key={`${c.card1.id}-${c.card2.id}`}
                    className="flex flex-col gap-2 p-3 bg-surface-200 border border-line rounded-xs hover:border-line-mid transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Art card={c.card1} size={28} className="size-7 flex-none" />
                        <span className="text-xs font-bold text-ink truncate">{c.card1.name ?? `#${c.card1.id}`}</span>
                        <span className="text-ink-muted text-xs font-bold">×</span>
                        <Art card={c.card2} size={28} className="size-7 flex-none" />
                        <span className="text-xs font-bold text-ink truncate">{c.card2.name ?? `#${c.card2.id}`}</span>
                      </div>
                      <span className="font-mono text-xs text-cyan shrink-0 font-bold">
                        {pct(c.averageWinRate)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-ink-muted pt-1 border-t border-line">
                      <span>{c.archetypesCount} arquétipos ({c.topArchetypes.slice(0, 2).join(', ')})</span>
                      <span>Inc. média: {pct(c.averageInclusion)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className={NOTE}>
              Sinergias detectadas entre duplas de staples com alta taxa de inclusão conjunta nos mesmos arquétipos.
            </p>
          </div>
        ) : (
          /* Cards Table view */
          <div className="overflow-x-auto">
            <div className="min-w-[540px]">
              {/* Header */}
              <div
                className="grid min-h-9 items-center gap-x-3 border-b border-line-mid bg-surface-200 px-3 text-ink-muted signal-sm font-mono"
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="text-center">#</span>
                <span>Carta</span>
                <span className="text-right">Popularidade</span>
                <span className="text-right">Uso (Main/Extra)</span>
                <span className="text-right">Win rate (com/sem)</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-line">
                {cardsList.slice(0, 10).map((card, idx) => {
                  const isSelected = selectedCardId === card.id
                  const wrWith = card.winRateWith
                  const wrWithout = card.winRateWithout
                  const delta = wrWith != null && wrWithout != null ? wrWith - wrWithout : null

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onPickCard?.(card.id)}
                      className={twMerge(
                        'grid min-h-11 w-full items-center gap-x-3 px-3 text-left transition-colors cursor-pointer text-xs',
                        isSelected
                          ? 'bg-azure/20 text-ink border-l-2 border-azure font-semibold'
                          : 'bg-surface-100 hover:bg-surface-200 text-ink-dim hover:text-ink'
                      )}
                      style={{ gridTemplateColumns: COLS }}
                    >
                      <span className="font-mono text-ink-muted text-center">{idx + 1}</span>

                      <div className="flex items-center gap-2 min-w-0">
                        <Art card={card} size={28} className="size-7 flex-none" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-semibold text-ink text-xs">{cardName(card)}</span>
                          {card.handTrap && (
                            <span className="text-[9px] font-mono text-gold leading-none">Hand trap</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 text-right">
                        <Bar
                          value={card.popularity}
                          max={0.8}
                          color="win"
                          label={pct(card.popularity)}
                          w={44}
                        />
                      </div>

                      <div className="text-right font-mono tabular-nums text-ink-dim">
                        <span>{pct(card.detail?.decklists?.mainExtra ?? card.popularity)}</span>
                        {card.detail?.decklists?.side != null && (
                          <span className="text-ink-muted text-[10px]"> / {pct(card.detail.decklists.side)}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1.5 font-mono tabular-nums text-right">
                        <span className={twMerge('font-semibold', wrWith != null && wrWith >= 0.5 ? 'text-win' : 'text-ink')}>
                          {pct(wrWith ?? card.winRateWhenUsed)}
                        </span>
                        {wrWithout != null && (
                          <>
                            <span className="text-ink-muted">/</span>
                            <span className="text-loss">{pct(wrWithout)}</span>
                          </>
                        )}
                        {delta != null && (
                          <span
                            className={twMerge(
                              'text-[10px] ml-1 font-bold',
                              delta > 0 ? 'text-win' : delta < 0 ? 'text-loss' : 'text-ink-muted'
                            )}
                          >
                            ({delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <p className={twMerge(NOTE, 'mt-3')}>
              Win rate com/sem: taxa de vitória quando a carta está presente no deck versus quando decks do mesmo arquétipo não a utilizam.
            </p>
          </div>
        )}
      </div>
    </Panel>
  )
}
