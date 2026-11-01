'use client'

import Image from 'next/image'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Segmented, Switch } from '@ui/choice'
import { DataTable, type Column } from '@ui/data-table'
import { TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import { referencedSubjects } from '@utils/combo/atoms'
import type { DeckCard } from '@utils/combo/deck-cards'
import type { Evaluation, EvaluateError } from '@utils/combo/evaluate'
import { nextSeed, rng } from '@utils/combo/rng'
import { addCounts, dealHand, estimate, monteCarlo, type Counts, type EffectLog, type Estimate } from '@utils/combo/simulate'
import { DRAW_EFFECTS, LIMITS, type Analysis, type Banish, type Draw, type EffectKind, type Effects, type Roles } from '@utils/combo/types'
import { CARD_ART_URL } from '@utils/const'
import { imageOf } from '@utils/deck/model'
import { cardLoader } from '@utils/image-loader'
import { clamp } from './calculator.reducer'
import { percent } from './results'

const TOUCH = 'max-lg:min-h-11'
/** Hands simulated per animation frame: the page stays responsive at the 200 000 ceiling. */
const CHUNK = 5_000
const DEFAULT_RUNS = 10_000
const BANISH: readonly Banish[] = [3, 6]

type SimulatorProps = {
  /** The active build's distinct main-deck cards. */
  rows: DeckCard[]
  roles: Roles
  analysis: Analysis
  draw: Draw
  effects: Effects
  /** Extra Deck size: what Prosperity and Extravagance can banish. */
  extraSize: number
  seed: number
  /** The exact result for the same deck and hands, shown beside the estimate. */
  result: Evaluation | EvaluateError
  nameOf(id: number): string
  onSeed(seed: number): void
  onToggleEffect(id: number): void
  onBanish(card: 'prosperity' | 'extravagance', count: Banish): void
}

/** A run in progress or finished. `key` is the inputs it was computed for: a changed deck leaves it on screen, marked stale. */
type Sim = { key: object; counts: Counts; total: number; running: boolean }
type Line = { key: string; label: string; e: Estimate }

/** Deal a seeded hand, toggle the deck's draw effects, estimate the odds by Monte Carlo under the exact panels. */
export const Simulator = (p: SimulatorProps) => {
  const t = useTranslations('Calculator')
  const format = useFormatter()
  const [extra, setExtra] = useState(0)
  const [runsText, setRunsText] = useState(String(DEFAULT_RUNS))
  const [sim, setSim] = useState<Sim | null>(null)
  const frame = useRef(0)

  const { rows, roles, analysis, draw, effects, extraSize, nameOf } = p
  const inputs = useMemo(() => ({ rows, roles, analysis, draw, effects, extraSize }), [rows, roles, analysis, draw, effects, extraSize])
  const deal = useMemo(() => dealHand(inputs.rows, inputs.roles, inputs.analysis, inputs.draw, inputs.effects, inputs.extraSize, p.seed, extra), [inputs, p.seed, extra])
  // A pending chunk must never run on inputs that are gone: changed inputs (or unmount) cancel it.
  useEffect(() => () => cancelAnimationFrame(frame.current), [inputs])

  const stale = sim !== null && sim.key !== inputs
  const running = sim?.running === true && !stale
  const tooFew = 'error' in p.result && p.result.error === 'tooFewCards'
  const exact = 'error' in p.result ? null : p.result
  const est = sim ? estimate(sim.counts, exact) : null
  /** Roles a rule names: their chips light up on the dealt cards. */
  const referenced = useMemo(() => new Set(referencedSubjects(analysis, null).flatMap((s) => (s.kind === 'role' ? [s.role.toLowerCase()] : []))), [analysis])
  const effectRows = (Object.entries(DRAW_EFFECTS) as [EffectKind, number][]).filter(([, id]) => rows.some((r) => r.id === id && r.copies > 0))
  const names = (ids: readonly number[]) => ids.map(nameOf).join(', ')

  const start = () => {
    const total = clamp(Number(runsText) || DEFAULT_RUNS, LIMITS.runs)
    const r = rng(p.seed)
    const key = inputs
    let counts: Counts = { runs: 0, hits: inputs.analysis.hands.map(() => 0), any: 0 }
    cancelAnimationFrame(frame.current)
    setSim({ key, counts, total, running: true })
    const tick = () => {
      counts = addCounts(counts, monteCarlo(inputs.rows, inputs.roles, inputs.analysis, inputs.draw, inputs.effects, inputs.extraSize, Math.min(CHUNK, total - counts.runs), r))
      setSim({ key, counts, total, running: counts.runs < total })
      if (counts.runs < total) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }
  const stop = () => {
    cancelAnimationFrame(frame.current)
    setSim((s) => s && { ...s, running: false })
  }

  const logLine = (l: EffectLog) => {
    const name = nameOf(DRAW_EFFECTS[l.effect])
    if (l.skipped) return t(`simulator.skipped.${l.skipped}`, { name })
    if (l.added !== null) return t('simulator.excavated', { name, cards: names(l.excavated), card: nameOf(l.added) })
    return t('simulator.drew', { name, cards: names(l.drew) })
  }
  const verdict = (passes: boolean) => (passes ? <Chip tone="positive">{t('simulator.passes')}</Chip> : <Chip>{t('simulator.fails')}</Chip>)

  const lines: Line[] = est
    ? [...est.hands.map((e, i) => ({ key: String(i), label: analysis.hands[i]?.name || t('hands.name', { n: i + 1 }), e })), { key: 'any', label: t('hands.any'), e: est.any }]
    : []
  const columns: Column<Line>[] = [
    { key: 'label', label: t('simulator.hand'), strong: true, render: (l) => l.label },
    { key: 'rate', label: t('simulator.estimate'), numeric: true, render: (l) => <span className="text-ink data">{percent(l.e.rate, format)}</span> },
    { key: 'halfWidth', label: t('simulator.halfWidth'), numeric: true, render: (l) => `± ${percent(l.e.halfWidth, format)}` },
    { key: 'exact', label: t('simulator.exact'), numeric: true, render: (l) => (l.e.exact === null ? '—' : percent(l.e.exact, format)) },
    {
      key: 'diff',
      label: t('simulator.diff'),
      numeric: true,
      render: (l) =>
        l.e.diff === null ? (
          '—'
        ) : (
          <span className={twMerge('signal-sm', l.e.diff > 0 ? 'text-win' : l.e.diff < 0 ? 'text-crimson-lift' : 'text-ink-muted')}>
            {t('compare.delta', { pp: format.number(l.e.diff, { signDisplay: 'exceptZero', maximumFractionDigits: 2 }) })}
          </span>
        ),
    },
  ]

  return (
    <Panel title={t('simulator.title')}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-ink body-strong" title={t('simulator.policy')}>
            {t('simulator.effects')}
          </h3>
          {effectRows.length === 0 ? (
            <p className="text-ink-muted signal-sm">{t('simulator.noEffects', { cards: names(Object.values(DRAW_EFFECTS)) })}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {effectRows.map(([kind, id]) => (
                <li key={kind} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <Switch
                    quiet
                    checked={effects.resolve.includes(id)}
                    onChange={() => p.onToggleEffect(id)}
                    label={t('simulator.resolve', { name: nameOf(id) })}
                    hint={t(`simulator.effect.${kind}`)}
                    className={TOUCH}
                  />
                  {kind === 'prosperity' || kind === 'extravagance' ? (
                    <Segmented
                      size="sm"
                      label={t('simulator.banish')}
                      value={effects[kind]}
                      onChange={(count) => p.onBanish(kind, count)}
                      options={BANISH.map((n) => ({ value: n, label: String(n) }))}
                      className="max-lg:[&>button]:min-h-11"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {tooFew ? (
          <Alert tone="warn" edged title={t('results.tooFewCards')} />
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-ink body-strong">{t('simulator.deal')}</h3>
                <span className="text-ink-muted signal-sm">
                  {t('simulator.cardsInHand', { count: deal.hand.length })} · {t('simulator.deckLeft', { count: deal.left })}
                </span>
                <span className="ml-auto flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      p.onSeed(nextSeed(p.seed))
                      setExtra(0)
                    }}
                    className={TOUCH}
                  >
                    {t('simulator.dealAgain')}
                  </Button>
                  <Button variant="secondary" size="sm" aria-disabled={deal.left === 0 || undefined} onClick={() => deal.left > 0 && setExtra((e) => e + 1)} className={TOUCH}>
                    {t('simulator.drawNext')}
                  </Button>
                </span>
              </div>
              <ul aria-label={t('simulator.deal')} className="flex flex-wrap gap-2">
                {deal.hand.map((id, i) => {
                  const row = rows.find((r) => r.id === id)
                  return (
                    <li key={i} className="flex w-24 flex-col gap-1">
                      <span className="relative aspect-[4/3] w-full bg-surface-300">
                        {row?.card ? <Image loader={cardLoader} src={CARD_ART_URL(imageOf(row.passcode, row.card))} alt="" fill sizes="96px" className="object-cover" /> : null}
                      </span>
                      <span className="truncate text-ink signal-sm" title={nameOf(id)}>
                        {nameOf(id)}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {(roles.get(id) ?? []).map((role) => (
                          <Chip key={role} tone={referenced.has(role.toLowerCase()) ? 'cyan' : 'neutral'}>
                            {role}
                          </Chip>
                        ))}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <ul className="flex flex-col divide-y divide-line">
                {analysis.hands.map((h, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="text-ink-muted signal-sm">{h.name || t('hands.name', { n: i + 1 })}</span>
                    {verdict(deal.passes[i] === true)}
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="text-ink body-strong">{t('hands.any')}</span>
                  {verdict(deal.any)}
                </li>
              </ul>
              {deal.log.length ? (
                <ul className="flex flex-col gap-1 text-ink-muted signal-sm">
                  {deal.log.map((l, i) => (
                    <li key={i}>{logLine(l)}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.runs[0]}
                  max={LIMITS.runs[1]}
                  step={1000}
                  value={runsText}
                  onChange={(e) => setRunsText(e.target.value)}
                  aria-label={t('simulator.runs')}
                  prefix={t('simulator.runs')}
                  plateClassName={`w-48 min-w-0 ${TOUCH}`}
                />
                {running ? (
                  <Button variant="secondary" onClick={stop} className={TOUCH}>
                    {t('simulator.stop')}
                  </Button>
                ) : (
                  <Button onClick={start} className={TOUCH}>
                    {t('simulator.simulate')}
                  </Button>
                )}
                {running && sim ? (
                  <span role="status" className="text-ink-muted signal-sm">
                    {t('simulator.progress', { done: sim.counts.runs, total: sim.total })}
                  </span>
                ) : null}
              </div>
              {sim && est ? (
                <>
                  {stale ? <p className="text-ink-muted signal-sm">{t('simulator.stale')}</p> : null}
                  <div className="overflow-x-auto">
                    <DataTable columns={columns} rows={lines} rowKey={(l) => l.key} caption={t('simulator.estimateLabel', { n: sim.counts.runs })} />
                  </div>
                </>
              ) : null}
            </section>
          </>
        )}
      </div>
    </Panel>
  )
}
