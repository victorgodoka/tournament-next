'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { DataTable, type Column } from '@ui/data-table'
import { Panel } from '@ui/panel'
import type { Evaluation, EvaluateError } from '@utils/combo/evaluate'
import type { Build, Hand } from '@utils/combo/types'
import { buildLabel } from './build-tabs'
import { percent } from './results'

/** `p` is null where that build has no result; `delta` is `(p − p_A) · 100` percentage points, null for A and beside a missing side. */
export type CompareCell = { p: number | null; delta: number | null }
export type CompareRow = { key: number | 'any'; cells: CompareCell[] }

const evaluation = (r: Evaluation | EvaluateError | undefined): Evaluation | null => (r && !('error' in r) ? r : null)

/** One row per hand (key = index) then `'any'`, one cell per build. */
export const compareRows = (hands: readonly Hand[], results: readonly (Evaluation | EvaluateError)[]): CompareRow[] => {
  const row = (key: number | 'any', pick: (e: Evaluation) => number | undefined): CompareRow => {
    const ps = results.map((r) => evaluation(r)).map((e) => (e ? (pick(e) ?? null) : null))
    const base = ps[0] ?? null
    return { key, cells: ps.map((p, i) => ({ p, delta: i > 0 && p !== null && base !== null ? (p - base) * 100 : null })) }
  }
  return [...hands.map((_, i) => row(i, (e) => e.hands[i]?.odds.p)), row('any', (e) => e.any.p)]
}

type Line = { key: string; label: string; cell(build: number): React.ReactNode }
type CompareProps = { builds: Build[]; hands: Hand[]; results: (Evaluation | EvaluateError)[] }

/** The builds side by side: deck size, each hand, any hand, and every build's distance from A in percentage points. */
export const Compare = ({ builds, hands, results }: CompareProps) => {
  const t = useTranslations('Calculator')
  const format = useFormatter()
  const label = (i: number) => buildLabel(builds[i]!, i, t('builds.untitled', { n: i + 1 }))

  const odds = (c: CompareCell, build: number) => {
    if (c.p === null) {
      const r = results[build]
      return <span title={r && 'error' in r ? t(`results.${r.error}`) : undefined}>—</span>
    }
    return (
      <span className="flex flex-col items-end">
        <span className="text-ink data">{percent(c.p, format)}</span>
        {c.delta !== null ? (
          <span className={twMerge('signal-sm', c.delta > 0 ? 'text-win' : c.delta < 0 ? 'text-crimson-lift' : 'text-ink-muted')}>
            {t('compare.delta', { pp: format.number(c.delta, { signDisplay: 'exceptZero', maximumFractionDigits: 2 }) })}
          </span>
        ) : null}
      </span>
    )
  }

  const lines: Line[] = [
    { key: 'size', label: t('compare.deckSize'), cell: (i) => <span className="text-ink data">{builds[i]!.deck.main.length}</span> },
    ...compareRows(hands, results).map((r) => ({
      key: String(r.key),
      label: r.key === 'any' ? t('hands.any') : hands[r.key]!.name || t('hands.name', { n: r.key + 1 }),
      cell: (i: number) => odds(r.cells[i]!, i),
    })),
  ]
  const columns: Column<Line>[] = [
    { key: 'label', label: '', strong: true, render: (line) => line.label },
    ...builds.map((_, i) => ({ key: `build-${i}`, label: label(i), numeric: true, render: (line: Line) => line.cell(i) })),
  ]

  return (
    <Panel title={t('compare.title')}>
      <div className="overflow-x-auto">
        <DataTable columns={columns} rows={lines} rowKey={(line) => line.key} caption={t('compare.caption', { name: label(0) })} />
      </div>
    </Panel>
  )
}
