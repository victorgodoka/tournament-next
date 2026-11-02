'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { DataTable } from '@ui/data-table'
import { Lookup } from '@ui/lookup'
import { PageHeader } from '@ui/page-header'
import { useResource } from '@hooks/index'
import { dayLabel } from '@utils/format'
import { ignoreArchetype, listIgnored, panelErrorText, unignoreArchetype } from '@utils/panel'
import { findSetcodes, NextBuildNote } from '../shared'

const IgnoredSetcodesPage = () => {
  const { data, error: loadError, reload } = useResource('ignored', listIgnored)
  const [error, setError] = useState<string | null>(null)

  const act = (request: Promise<unknown>) => {
    setError(null)
    request.then(reload, (e) => setError(panelErrorText(e)))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Deck classification · ${data?.length ?? 0} ignored`}
        title="Ignored setcodes"
        lead="Setcodes that never name a deck: a card that carries one is read as if it had none, and ignoring a family ignores its sub-families. A deck with only ignored setcodes is Unknown."
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the list">{panelErrorText(loadError)}</Alert> : null}
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Lookup label="Setcode to ignore" placeholder="Archetype name or setcode — pick one to ignore it" search={findSetcodes} exclude={(data ?? []).map((r) => r.code)} onPick={(o) => act(ignoreArchetype(Number(o.key)))} />
          <div className="overflow-x-auto">
            <DataTable
              rows={data ?? []}
              rowKey={(r) => r.code}
              empty={data ? 'Nothing is ignored.' : 'Loading…'}
              columns={[
                { key: 'code', label: 'Setcode', render: (r) => <span className="text-ink data">{r.code}</span> },
                { key: 'name', label: 'Archetype', strong: true, render: (r) => r.name ?? 'Unknown setcode' },
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
        <aside><NextBuildNote /></aside>
      </div>
    </>
  )
}

export default IgnoredSetcodesPage
