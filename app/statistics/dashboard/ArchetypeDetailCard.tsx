'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { archKey, matchupStatus, type Matchup, type Side, type StatArchetype } from '@utils/statistics'
import { Art, cardName, faceOf, nameOf, NOTE, num, pct } from '../DeepDive'
import { isLoose, LOOSE_MARGIN } from './MatchupMatrix'

type ArchetypeDetailCardProps = {
  archetype?: StatArchetype | null
  /** Every listed archetype (names and art of the opponents) and the matchups among them. */
  archetypes: StatArchetype[]
  matchups: Matchup[]
  onOpenDeepDive?: (key: string) => void
}

type Tab = 'performance' | 'matchups' | 'cards'
const MATCHUPS_A_SIDE = 5

const TONE = { favorable: 'text-win', neutral: 'text-ink', unfavorable: 'text-loss' } as const
const rateTone = (r: number | null) => (r == null ? 'text-ink' : TONE[matchupStatus(r)])

const Tile = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) => (
  <div className="flex flex-col border border-line bg-surface-200 p-3">
    <span className="text-ink-muted signal-sm">{label}</span>
    <span className="font-mono text-lg font-bold text-ink tabular-nums">{value}</span>
    {hint ? <span className="font-mono text-[11px] text-ink-muted">{hint}</span> : null}
  </div>
)

export const ArchetypeDetailCard = ({ archetype, archetypes, matchups, onOpenDeepDive }: ArchetypeDetailCardProps) => {
  const t = useTranslations('Statistics.detail')
  const [tab, setTab] = useState<Tab>('performance')

  if (!archetype) {
    return (
      <Panel title={t('title')}>
        <p className={NOTE}>{t('empty')}</p>
      </Panel>
    )
  }

  const key = archKey(archetype.archetype)
  // Seasons swept before the per-game split only have G1 / post-side.
  const { byGame, sideboarding } = archetype
  const phases: [string, Side][] = byGame
    ? [['G1', byGame.g1], ['G2', byGame.g2], ['G3', byGame.g3]]
    : [['G1', sideboarding.game1], [t('postSide'), sideboarding.postSide]]

  // Its matchups with a usable sample, weakest first: the two ends, no row in both when there are few.
  const byKey = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const own = matchups
    .filter((m) => archKey(m.archetype) === key && m.winRate != null && !isLoose(m))
    .sort((a, b) => a.winRate! - b.winRate!)
  const worst = own.slice(0, MATCHUPS_A_SIDE)
  const best = own.slice(Math.max(MATCHUPS_A_SIDE, own.length - MATCHUPS_A_SIDE)).reverse()

  return (
    <Panel title={t('title')} meta={archetype.tier ? t('tier', { tier: archetype.tier }) : undefined}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Art card={faceOf(archetype)} size={56} className="size-14" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="truncate text-lg font-bold text-ink">{nameOf(archetype)}</h3>
            <p className="text-xs text-ink-dim">{t('sub', { games: num(archetype.games), mirrors: pct(archetype.mirrorShare) })}</p>
          </div>
          {onOpenDeepDive ? (
            <button type="button" onClick={() => onOpenDeepDive(key)} className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-cyan hover:underline">
              {t('deepDive')} <Icon name="arrow" size={12} />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-4">
          <Tile label={t('winRate')} value={pct(archetype.winRate)} hint={archetype.ci ? `± ${(archetype.ci.margin * 100).toFixed(1)} pts` : undefined} />
          <Tile label={t('share')} value={pct(archetype.metaShare)} />
          <Tile label={t('games')} value={num(archetype.games)} />
          <Tile label={t('players')} value={num(archetype.players)} />
        </div>

        <TabBar
          tabs={(['performance', 'matchups', 'cards'] as const).map((id) => ({ id, label: t(`tabs.${id}`) }))}
          active={tab}
          onSelect={setTab}
          label={t('tabsLabel')}
          idPrefix="arch-detail"
          fit
        />

        {tab === 'performance' ? (
          <div className="grid grid-cols-1 gap-2 min-[720px]:grid-cols-4">
            {phases.map(([label, side]) => (
              <div key={label} className="flex flex-col gap-1.5 border border-line bg-surface-200 p-3">
                <div className="flex items-center justify-between font-mono text-[11px] text-ink-muted">
                  <span>{label}</span>
                  <span className="font-semibold text-ink">{pct(side.winRate)}</span>
                </div>
                <div className="relative h-1.5 bg-surface-300">
                  <div className="h-1.5 bg-win" style={{ width: `${(side.winRate ?? 0) * 100}%` }} />
                  <span aria-hidden className="absolute -top-0.5 left-1/2 h-2.5 w-px bg-ink-muted" />
                </div>
                <span className="font-mono text-[10px] text-ink-muted">{t('gamesCount', { count: num(side.games) })}</span>
              </div>
            ))}
            <div className="flex flex-col justify-center gap-1 border border-line bg-surface-200 p-3 font-mono text-xs text-ink-muted">
              <span>{t('first')} <strong className="text-ink">{pct(archetype.turnOrder.first.winRate)}</strong></span>
              <span>{t('second')} <strong className="text-ink">{pct(archetype.turnOrder.second.winRate)}</strong></span>
            </div>
          </div>
        ) : tab === 'matchups' ? (
          <div className="flex flex-col gap-3 text-xs">
            {own.length ? (
              <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2">
                {([['worst', worst], ['best', best]] as const).map(([which, list]) => (
                  <div key={which} className="flex flex-col gap-1">
                    <span className="text-ink-muted signal-sm">{t(which)}</span>
                    {list.map((m) => {
                      const opp = byKey.get(archKey(m.opponent))
                      return (
                        <div key={archKey(m.opponent)} className="flex items-center gap-2 border border-line bg-surface-200 p-1.5">
                          {opp ? <Art card={faceOf(opp)} size={22} className="size-5.5" /> : null}
                          <span className="truncate text-ink-dim">{opp ? nameOf(opp) : archKey(m.opponent)}</span>
                          <span className={twMerge('ml-auto font-mono font-bold', rateTone(m.winRate))}>{pct(m.winRate)}</span>
                          <span className="w-20 text-right font-mono text-[10px] text-ink-muted">{t('gamesCount', { count: num(m.games) })}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <p className={NOTE}>{t('noMatchups')}</p>
            )}
            {archetype.matchupOthers ? (
              <div className="flex items-center justify-between border border-line bg-surface-200 p-2">
                <span className="font-medium text-ink-dim">{t('others', { count: archetypes.length })}</span>
                <span className={twMerge('font-mono font-bold', rateTone(archetype.matchupOthers.winRate))}>
                  {pct(archetype.matchupOthers.winRate)} · {t('gamesCount', { count: num(archetype.matchupOthers.games) })}
                </span>
              </div>
            ) : null}
            <p className={NOTE}>{t('matchupsNote', { margin: LOOSE_MARGIN * 100 })}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 min-[720px]:grid-cols-2 min-[1200px]:grid-cols-4">
            {archetype.cards.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center gap-2 border border-line bg-surface-200 p-1.5 text-xs">
                <Art card={c} size={22} className="size-5.5" />
                <span className="truncate text-ink-dim">{cardName(c)}</span>
                <span className="ml-auto font-mono text-[10px] text-cyan">{pct(c.inclusion)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
