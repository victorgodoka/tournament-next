'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@iconify/react'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { pct, num, nameOf, faceOf, Art, Bar, NOTE } from '../DeepDive'
import type { StatArchetype } from '@utils/statistics'
import { archKey } from '@utils/statistics'

type ArchetypeDetailCardProps = {
  archetype?: StatArchetype | null
  onOpenDeepDive?: (key: string) => void
}

const TABS = [
  { id: 'performance' as const, label: 'Desempenho' },
  { id: 'matchups' as const, label: 'Matchups' },
  { id: 'lists' as const, label: 'Listas' },
] as const

export const ArchetypeDetailCard = ({ archetype, onOpenDeepDive }: ArchetypeDetailCardProps) => {
  const [tab, setTab] = useState<'performance' | 'matchups' | 'lists'>('performance')

  if (!archetype) {
    return (
      <Panel title="Análise de arquétipo" meta="Nenhum selecionado">
        <p className={NOTE}>Selecione um arquétipo no ranking ou na tabela para ver a análise detalhada.</p>
      </Panel>
    )
  }

  const key = archKey(archetype.archetype)
  const face = faceOf(archetype)
  const name = nameOf(archetype)

  const g1Wr = archetype.byGame?.g1?.winRate ?? archetype.sideboarding?.game1?.winRate
  const g2Wr = archetype.byGame?.g2?.winRate
  const g3Wr = archetype.byGame?.g3?.winRate ?? archetype.sideboarding?.postSide?.winRate

  return (
    <Panel
      title="Análise de arquétipo"
      meta={archetype.tier ? `Tier ${archetype.tier}` : undefined}
    >
      <div className="flex flex-col gap-4">
        {/* Header with Card Art & Title */}
        <div className="flex items-start gap-3">
          <Art card={face} size={54} className="size-14 rounded-xs border border-line flex-none" />
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="font-bold text-ink text-base truncate">{name}</h4>
            <p className="text-xs text-ink-dim leading-snug line-clamp-2 mt-0.5">
              Deck focado em consistência e grind game, com excelente capacidade de recuperação e pressão no meio jogo.
            </p>
          </div>
        </div>

        {/* 4 Stat Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="flex flex-col p-2 bg-surface-200 border border-line rounded-xs">
            <span className="text-[11px] text-ink-muted">Win rate</span>
            <span className="font-bold text-ink text-sm font-mono tabular-nums">
              {pct(archetype.winRate)}
            </span>
            {archetype.ci && (
              <span className="text-[10px] text-ink-muted font-mono">
                ±{(archetype.ci.margin * 100).toFixed(1)}%
              </span>
            )}
          </div>

          <div className="flex flex-col p-2 bg-surface-200 border border-line rounded-xs">
            <span className="text-[11px] text-ink-muted">Popularidade</span>
            <span className="font-bold text-ink text-sm font-mono tabular-nums">
              {pct(archetype.metaShare)}
            </span>
            <span className="text-[10px] text-ink-muted font-mono">no meta</span>
          </div>

          <div className="flex flex-col p-2 bg-surface-200 border border-line rounded-xs">
            <span className="text-[11px] text-ink-muted">Partidas</span>
            <span className="font-bold text-ink text-sm font-mono tabular-nums">
              {num(archetype.games)}
            </span>
            <span className="text-[10px] text-ink-muted font-mono">jogadas</span>
          </div>

          <div className="flex flex-col p-2 bg-surface-200 border border-line rounded-xs">
            <span className="text-[11px] text-ink-muted">Jogadores</span>
            <span className="font-bold text-ink text-sm font-mono tabular-nums">
              {num(archetype.players)}
            </span>
            <span className="text-[10px] text-ink-muted font-mono">únicos</span>
          </div>
        </div>

        {/* Tab selection */}
        <div className="border-b border-line">
          <TabBar
            tabs={TABS}
            active={tab}
            onSelect={setTab}
            label="Detalhamento do arquétipo"
            idPrefix="arch-detail"
            fit
            className="border-b-0"
          />
        </div>

        {/* Tab content */}
        {tab === 'performance' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-dim">Win rate por fase</span>
              {onOpenDeepDive && (
                <button
                  type="button"
                  onClick={() => onOpenDeepDive(key)}
                  className="text-xs text-cyan hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                >
                  Ver detalhes <Icon icon="mdi:arrow-right" className="text-xs" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1 p-2 bg-surface-200 rounded-xs border border-line">
                <div className="flex justify-between items-center text-[11px] text-ink-muted font-mono">
                  <span>G1</span>
                  <span className="text-ink font-semibold">{pct(g1Wr)}</span>
                </div>
                <div className="h-1.5 bg-surface-300 rounded-round overflow-hidden">
                  <div
                    className="h-1.5 rounded-round bg-win"
                    style={{ width: `${Math.min(100, ((g1Wr ?? 0.5) / 1) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 p-2 bg-surface-200 rounded-xs border border-line">
                <div className="flex justify-between items-center text-[11px] text-ink-muted font-mono">
                  <span>G2</span>
                  <span className="text-ink font-semibold">{pct(g2Wr ?? g1Wr)}</span>
                </div>
                <div className="h-1.5 bg-surface-300 rounded-round overflow-hidden">
                  <div
                    className="h-1.5 rounded-round bg-win"
                    style={{ width: `${Math.min(100, (((g2Wr ?? g1Wr) ?? 0.5) / 1) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 p-2 bg-surface-200 rounded-xs border border-line">
                <div className="flex justify-between items-center text-[11px] text-ink-muted font-mono">
                  <span>G3</span>
                  <span className="text-ink font-semibold">{pct(g3Wr)}</span>
                </div>
                <div className="h-1.5 bg-surface-300 rounded-round overflow-hidden">
                  <div
                    className="h-1.5 rounded-round bg-win"
                    style={{ width: `${Math.min(100, ((g3Wr ?? 0.5) / 1) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Turn order mini-split */}
            <div className="flex items-center justify-between p-2.5 bg-surface-200 rounded-xs border border-line text-xs font-mono">
              <span className="text-ink-muted">Indo 1º: <strong className="text-ink">{pct(archetype.turnOrder?.first?.winRate)}</strong></span>
              <span className="text-line-mid">|</span>
              <span className="text-ink-muted">Indo 2º: <strong className="text-ink">{pct(archetype.turnOrder?.second?.winRate)}</strong></span>
            </div>
          </div>
        ) : tab === 'matchups' ? (
          <div className="flex flex-col gap-2 text-xs">
            {archetype.matchupOthers && (
              <div className="flex items-center justify-between p-2 bg-surface-200 rounded-xs border border-line">
                <span className="text-ink-dim font-medium">Contra Outros decks</span>
                <span className={twMerge('font-bold font-mono', archetype.matchupOthers.status === 'favorable' ? 'text-win' : archetype.matchupOthers.status === 'unfavorable' ? 'text-loss' : 'text-ink')}>
                  {pct(archetype.matchupOthers.winRate)} ({num(archetype.matchupOthers.games)} j)
                </span>
              </div>
            )}
            <p className={NOTE}>Consulte a Matchup Matrix acima para ver todos os confrontos contra os principais decks.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-ink-dim font-medium">Cartas mais frequentes na lista:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(archetype.cards ?? []).slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-1.5 bg-surface-200 rounded-xs border border-line text-xs">
                  <Art card={c} size={22} className="size-5.5 flex-none" />
                  <span className="truncate text-ink-dim">{c.name ?? `#${c.id}`}</span>
                  <span className="ml-auto font-mono text-[10px] text-cyan">{pct(c.inclusion)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
