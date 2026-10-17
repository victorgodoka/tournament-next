'use client'

import { useEffect, useState } from 'react'
import { Alert, Button } from '@ui/index'
import { useResource } from '@hooks/index'
import { getAnalyticsSweep, panelErrorText, rebuildOpenSeasons } from '@utils/panel'

/** A saved Series shows up within a poll; a running sweep is followed faster. */
const IDLE_MS = 15_000
const RUNNING_MS = 5_000

/**
 * Says when the open seasons were swept with older archetype rules (series, ignored archetypes,
 * card groups) and offers the rebuild the 01:00 sweep would run anyway. Nothing while they're current.
 */
export const RulesRebuildNotice = () => {
  const sweep = useResource('sweep', getAnalyticsSweep)
  const [error, setError] = useState<string | null>(null)
  const running = sweep.data?.running ?? null
  const stale = sweep.data?.rulesStale ?? false
  const reload = sweep.reload
  const sweeping = running !== null

  useEffect(() => {
    const timer = setInterval(reload, sweeping ? RUNNING_MS : IDLE_MS)
    return () => clearInterval(timer)
  }, [sweeping, reload])

  const rebuild = () => {
    setError(null)
    rebuildOpenSeasons().then(reload, (e) => setError(panelErrorText(e)))
  }

  if (running)
    return (
      <Alert edged tone="info" className="items-center">
        <span className="text-sm text-ink">
          Sweeping {running.from} → {running.to}: {running.done.length} days done. /statistics updates when it ends.
        </span>
      </Alert>
    )
  if (!stale) return null
  return (
    <Alert
      edged
      tone="warn"
      className="items-center"
      action={<Button size="mono" variant="secondary" onClick={rebuild}>Rebuild now</Button>}
    >
      <span className="text-sm text-ink">
        Statistics still use older archetype rules. They rebuild tonight at 01:00 — or rebuild the open seasons now.
        {error ? <span className="mt-1 block text-loss">{error}</span> : null}
      </span>
    </Alert>
  )
}
