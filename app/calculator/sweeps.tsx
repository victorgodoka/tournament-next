'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { LineChart, type Series } from '@ui/chart'
import { Segmented } from '@ui/choice'
import { Select, TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import { copyLimit, type DeckCard } from '@utils/combo/deck-cards'
import { copiesFor, sweepCopies, sweepDeckSize, sweepTurn, type SweepPoint } from '@utils/combo/sweep'
import type { Analysis, Draw, Roles, Subject } from '@utils/combo/types'
import type { Banlist } from '@utils/wiki'
import { percent } from './results'

const TOUCH = 'max-lg:min-h-11'

type Mode = 'copies' | 'deckSize' | 'turn'
const MODES: Mode[] = ['copies', 'deckSize', 'turn']
const DEFAULT_TARGET = 80

type SweepsProps = {
  /** The active build's distinct main-deck cards. */
  rows: DeckCard[]
  roles: Roles
  analysis: Analysis
  draw: Draw
  banlist: Banlist | null
  /** The single-card panel's subject: a card there is the first one swept. */
  focus: Subject | null
  nameOf(id: number): string
}

/** Copies of one card, the main-deck size, or the turn, against each hand's odds; a target line names where each series first reaches it. */
export const Sweeps = (p: SweepsProps) => {
  const t = useTranslations('Calculator')
  const format = useFormatter()
  const [mode, setMode] = useState<Mode>('copies')
  const [selected, setSelected] = useState<number | null>(null)
  const [targetText, setTargetText] = useState(String(DEFAULT_TARGET))
  const target = Math.min(100, Math.max(1, Number(targetText) || DEFAULT_TARGET))

  const has = (id: number | null | undefined): id is number => id != null && p.rows.some((r) => r.id === id)
  // The chosen card while it is in the deck; else the focus card, the first tagged card, the first card.
  const cardId = has(selected) ? selected : p.focus?.kind === 'card' && has(p.focus.id) ? p.focus.id : ((p.rows.find((r) => p.roles.has(r.id)) ?? p.rows[0])?.id ?? null)
  const card = p.rows.find((r) => r.id === cardId) ?? null

  const points = useMemo<SweepPoint[]>(() => {
    if (!p.analysis.hands.length) return []
    if (mode === 'deckSize') return sweepDeckSize(p.rows, p.roles, p.analysis, p.draw)
    if (mode === 'turn') return sweepTurn(p.rows, p.roles, p.analysis, p.draw)
    return card ? sweepCopies(p.rows, p.roles, p.analysis, p.draw, card.id, copyLimit(card.card, p.banlist)) : []
  }, [mode, card, p.rows, p.roles, p.analysis, p.draw, p.banlist])

  const hands = p.analysis.hands.length
  const names = [...p.analysis.hands.map((h, i) => h.name || t('hands.name', { n: i + 1 })), t('hands.any')]
  const series: Series[] = names.map((name, i) => ({ name, data: points.map((pt) => (i < hands ? pt.hands[i]! : pt.any) * 100) }))
  const reached = (i: number) => copiesFor(points, target / 100, i < hands ? i : 'any')
  const title = mode === 'copies' ? t('sweeps.copiesOf', { name: card ? p.nameOf(card.id) : '' }) : t(`sweeps.${mode}`)

  return (
    <Panel title={t('sweeps.title')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label={t('sweeps.title')} value={mode} onChange={setMode} options={MODES.map((value) => ({ value, label: t(`sweeps.${value}`) }))} className="max-lg:[&>button]:min-h-11" />
          {mode === 'copies' ? (
            <Select
              aria-label={t('sweeps.card')}
              options={p.rows.map((r) => ({ value: String(r.id), label: p.nameOf(r.id) }))}
              value={cardId === null ? '' : String(cardId)}
              onChange={(e) => setSelected(Number(e.target.value))}
              className={`min-w-0 flex-1 basis-48 ${TOUCH}`}
            />
          ) : null}
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            aria-label={t('sweeps.target')}
            prefix={t('sweeps.target')}
            suffix="%"
            plateClassName={`w-40 min-w-0 ${TOUCH}`}
          />
        </div>
        {hands === 0 ? (
          <p className="text-ink-muted body">{t('sweeps.noHands')}</p>
        ) : points.length === 0 ? (
          <p className="text-ink-muted body">{t('sweeps.noPoints')}</p>
        ) : (
          <>
            <LineChart title={title} labels={points.map((pt) => String(pt.x))} series={series} format={(v) => percent(v / 100, format)} height={240} />
            <ul className="flex flex-col divide-y divide-line">
              {names.map((name, i) => {
                const x = reached(i)
                return (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                    <span className="min-w-28 text-ink-muted signal-sm">{name}</span>
                    <span className="text-ink data">{x === null ? t('sweeps.notReached') : t(`sweeps.reached.${mode}`, { x })}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </Panel>
  )
}
