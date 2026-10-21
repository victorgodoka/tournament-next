'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import type { EvaluateError, Evaluation } from '@utils/combo/evaluate'
import { percent } from './results'

type OddsHeadlineProps = {
  result: Evaluation | EvaluateError
  hasHands: boolean
  /** `any.p` when the last paint stroke began; `null`: no delta. */
  baseline: number | null
}

/** Percentage points, one decimal; `null` when it rounds to 0.0. */
export const deltaPoints = (p: number, baseline: number): number | null => {
  const points = Math.round((p - baseline) * 1000) / 10
  return points === 0 ? null : points
}

/** The playable-hand odds, big, with how far the last paint moved them. */
export const OddsHeadline = ({ result, hasHands, baseline }: OddsHeadlineProps) => {
  const t = useTranslations('Calculator')
  const format = useFormatter()
  const delta = 'error' in result || baseline === null ? null : deltaPoints(result.any.p, baseline)
  const points = delta === null ? '' : format.number(Math.abs(delta), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (
    <div data-tour="odds">
      <Panel tone="framed" title={t('odds.playable')}>
        {'error' in result ? (
          <p className="text-ink-muted body">{t(`results.${result.error}`)}</p>
        ) : !hasHands ? (
          <p className="text-ink-muted body">{t('odds.noHands')}</p>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="display-2">{percent(result.any.p, format)}</span>
            {delta === null ? null : (
              <span className={twMerge('data', delta > 0 ? 'text-win' : 'text-loss')}>
                <span aria-hidden>{delta > 0 ? `▲ +${points}` : `▼ −${points}`}</span>
                <span className="sr-only">{t(delta > 0 ? 'odds.up' : 'odds.down', { points })}</span>
              </span>
            )}
          </p>
        )}
      </Panel>
    </div>
  )
}
