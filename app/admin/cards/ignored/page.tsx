'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { DataTable } from '@ui/data-table'
import { Lookup } from '@ui/lookup'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { useResource } from '@hooks/index'
import { dayLabel } from '@utils/format'
import { ignoreArchetype, listIgnored, listSeries, panelErrorText, unignoreArchetype } from '@utils/panel'
import { findSetcodes } from '../shared'

const load = (signal: AbortSignal) => Promise.all([listIgnored(signal), listSeries(signal)]).then(([ignored, series]) => ({ ignored, series }))

const IgnoredArchetypesPage = () => {
  const { data, error: loadError, reload } = useResource('ignored', load)
  const [error, setError] = useState<string | null>(null)

  const inSeries = (code: number) => {
    const s = data?.series.find((x) => x.archetype?.code === code || x.archetypes.some((a) => a.code === code))
    return s ? `${s.name} (${s.archetype?.code === code ? 'override' : 'child'})` : '—'
  }

  const act = (request: Promise<unknown>) => {
    setError(null)
    request.then(reload, (e) => setError(panelErrorText(e)))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Cards · ${data?.ignored.length ?? 0} ignored`}
        title="Ignored archetypes"
        lead="Setcodes that never name a deck. A deck made only of ignored archetypes shows as Unknown."
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the list">{panelErrorText(loadError)}</Alert> : null}
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Lookup label="Archetype to ignore" placeholder="Archetype name or setcode — pick one to ignore it" search={findSetcodes} exclude={(data?.ignored ?? []).map((r) => r.code)} onPick={(o) => act(ignoreArchetype(Number(o.key)))} />
          <div className="overflow-x-auto">
            <DataTable
              rows={data?.ignored ?? []}
              rowKey={(r) => r.code}
              empty={data ? 'Nothing is ignored.' : 'Loading…'}
              columns={[
                { key: 'code', label: 'Setcode', render: (r) => <span className="text-ink data">{r.code}</span> },
                { key: 'name', label: 'Archetype', strong: true, render: (r) => r.name ?? 'Unknown setcode' },
                { key: 'series', label: 'In a Series', render: (r) => inSeries(r.code) },
                { key: 'when', label: 'Ignored since', render: (r) => dayLabel(r.updatedAt) },
                {
                  key: 'actions',
                  label: <span className="block text-right">Actions</span>,
                  render: (r) => (
                    <span className="flex justify-end">
                      <Button variant="ghost" size="mono" onClick={() => act(unignoreArchetype(r.code))}>Stop ignoring</Button>
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Panel title="Inside a Series" className="[--edge:var(--color-line-mid)]">
            <p className="text-sm leading-5.5 text-ink-dim">
              When an ignored setcode is a child of a Series, or the Series overrides it, its cards count for that Series only if the deck also has another card of
              the Series.
            </p>
            <Link href="/admin/cards/series" className="mt-4.5 inline-block signal-strong">Open Series</Link>
          </Panel>
          <Alert edged plain={false} tone="warn" title="Past days don’t change on their own">
            Re-run the sweep for the days that should change. Tournament decklists pick it up within about 10 minutes.
          </Alert>
        </aside>
      </div>
    </>
  )
}

export default IgnoredArchetypesPage
