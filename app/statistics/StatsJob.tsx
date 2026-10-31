'use client'

/**
 * A deck or card that isn't in the page's data: read from the API and, if nobody calculated it yet, started by a
 * signed-in viewer. The job runs on the server's queue, so leaving the page loses the poll, not the result.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@hooks/index'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'
import { hhmm } from './DeepDive'

type Waiting = { status: 'missing' } | { status: 'queued'; position: number } | { status: 'running' } | { status: 'failed'; error: string } | { status: 'limited'; retryAt?: string }
export type JobState<R> = R | Waiting
const POLL_MS = 3000

/** `read` and `request` must be stable. `failed`: the HTTP status of a read that didn't answer, 0 offline. */
export const useStatsJob = <R extends { status: 'ready' }>(read: (signal: AbortSignal) => Promise<JobState<R>>, request: () => Promise<JobState<R>>) => {
  const [state, setState] = useState<JobState<R> | null>(null)
  const [failed, setFailed] = useState<number | null>(null)
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const run = useCallback(
    (first: (signal: AbortSignal) => Promise<JobState<R>>) => {
      controller.current?.abort()
      clearTimeout(timer.current)
      const live = new AbortController()
      controller.current = live
      const step = (req: Promise<JobState<R>>) =>
        req.then(
          (s) => {
            if (live.signal.aborted) return
            setFailed(null)
            setState(s)
            if (s.status === 'queued' || s.status === 'running') timer.current = setTimeout(() => step(read(live.signal)), POLL_MS)
          },
          (e: { status?: number }) => {
            if (!live.signal.aborted) setFailed(e?.status ?? 0)
          },
        )
      step(first(live.signal))
    },
    [read],
  )

  useEffect(() => {
    run(read)
    return () => {
      controller.current?.abort()
      clearTimeout(timer.current)
    }
  }, [run, read])

  return { state, failed, retry: useCallback(() => run(read), [run, read]), calculate: useCallback(() => run(request), [run, request]) }
}

/** Every state but `ready`. `kind` picks the words; `signedIn` is `undefined` while auth loads. */
export const JobPanel = ({ kind, name, state, failed, onRetry, onCalculate, back }: {
  kind: 'deck' | 'card'
  name: string
  state: Waiting | null
  failed: number | null
  onRetry: () => void
  onCalculate: () => void
  back: string
}) => {
  const t = useTranslations('Statistics.jobs')
  const { user } = useAuth()
  const backButton = <Button size="sm" variant="secondary" href={back}>{t('back')}</Button>

  if (failed !== null)
    return (
      <Panel title={failed === 404 ? t(kind === 'deck' ? 'deckGoneTitle' : 'cardGoneTitle') : t('couldntRead')} meta={name}>
        <div className="flex flex-col items-start gap-4">
          <p className="text-ink-dim body">{failed === 404 ? t(kind === 'deck' ? 'deckGone' : 'cardGone') : failed === 401 ? t('sessionExpired') : t('serverDown')}</p>
          <div className="flex flex-wrap gap-3">
            {failed === 401 ? <Button size="sm" href="/login">{t('signIn')}</Button> : failed === 404 ? null : <Button size="sm" onClick={onRetry}>{t('retry')}</Button>}
            {backButton}
          </div>
        </div>
      </Panel>
    )

  if (!state || (state.status === 'missing' && user === undefined))
    return <div role="status" aria-label={t('loading', { name })} className="h-64 animate-pulse bg-surface-200 motion-reduce:animate-none" />

  switch (state.status) {
    case 'missing':
      return (
        <Panel title={t('notCalculated')} meta={name}>
          <div className="flex flex-col items-start gap-4">
            <p className="max-w-[60ch] text-ink-dim body">{t(kind === 'deck' ? 'deckOutside' : 'cardOutside')}</p>
            <div className="flex flex-wrap gap-3">
              {user ? <Button size="sm" onClick={onCalculate}>{t('calculate')}</Button> : <Button size="sm" href="/login">{t('signInToCalculate')}</Button>}
              {backButton}
            </div>
          </div>
        </Panel>
      )
    case 'queued':
    case 'running':
      return (
        <Panel title={state.status === 'queued' ? t('inLine', { position: state.position }) : t('calculating')} meta={name}>
          <div role="status" className="flex flex-col items-start gap-4">
            <p className="max-w-[60ch] text-ink-dim body">{t('calcDetail')}</p>
            <div className="h-1.5 w-full animate-pulse bg-series-1 motion-reduce:animate-none" aria-hidden />
            <span className="text-ink-muted signal-sm">{t('autoUpdate')}</span>
            {backButton}
          </div>
        </Panel>
      )
    case 'failed':
      return (
        <Panel title={t(kind === 'deck' ? 'failedDeck' : 'failedCard')} meta={name}>
          <div role="alert" className="flex flex-col items-start gap-4">
            <p className="max-w-[60ch] text-ink-dim body">{t('failedBody')}</p>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={onCalculate}>{t('retry')}</Button>
              {backButton}
            </div>
          </div>
        </Panel>
      )
    case 'limited':
      return (
        <Panel title={t('limitReached')} meta={name}>
          <div role="alert" className="flex flex-col items-start gap-4">
            <p className="max-w-[60ch] text-ink-dim body">{t('limitBody')}</p>
            <Button size="sm" variant="secondary" disabled>{state.retryAt ? t('availableAt', { time: hhmm(state.retryAt) }) : t('trySoon')}</Button>
            {backButton}
          </div>
        </Panel>
      )
  }
}
