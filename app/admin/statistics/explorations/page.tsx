'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Field, TextArea, TextInput } from '@ui/field'
import { Icon } from '@ui/icon'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { Switch } from '@ui/choice'
import { useResource } from '@hooks/index'
import { configProblem } from '@utils/explorer'
import { dayLabel } from '@utils/format'
import type { GlobalExploration } from '@utils/global-explorer'
import { deletePanelExploration, listPanelExplorations, panelErrorText, updatePanelExploration } from '@utils/panel'

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

const ExplorationsPage = () => {
  const { data, error: loadError, reload, setData } = useResource('explorations', listPanelExplorations)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ id: string; name: string; description: string; published: boolean } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = data ?? []
  const picked = list.find((e) => e.id === pickedId) ?? list[0]
  const d = draft?.id === picked?.id ? draft : picked ? { id: picked.id, name: picked.name, description: picked.description, published: picked.published } : null
  const published = list.filter((e) => e.published).length

  /** Moves `id` to `to`, then one `PATCH { position }` per exploration whose index changed. */
  const move = (id: string, to: number) => {
    const from = list.findIndex((e) => e.id === id)
    if (from < 0 || to < 0 || to >= list.length || to === from) return
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    setData(() => next.map((e, position) => ({ ...e, position })))
    Promise.all(next.flatMap((e, position) => (list[position]?.id !== e.id ? [updatePanelExploration(e.id, { position })] : []))).catch((e) => {
      setError(panelErrorText(e))
      reload()
    })
  }

  const save = () => {
    if (!d) return
    setBusy(true)
    setError(null)
    updatePanelExploration(d.id, { name: d.name.trim(), description: d.description, published: d.published })
      .then((saved) => setData((cur) => cur?.map((e) => (e.id === saved.id ? saved : e))))
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const remove = () => {
    if (!d) return
    setBusy(true)
    setError(null)
    deletePanelExploration(d.id)
      .then(() => {
        setPickedId(null)
        reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const statusOf = (e: GlobalExploration) =>
    e.published ? { chip: <Chip tone="positive">Published</Chip>, when: e.publishedAt ? dayLabel(e.publishedAt) : '' } : { chip: <Chip>Draft</Chip>, when: `Edited ${dayLabel(e.updatedAt)}` }

  const problem = picked ? configProblem(picked.config) : null

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Analytics · ${published} published · ${list.length - published} drafts`}
        title="Global explorations"
        lead="Explorations of the whole server, built with the same builder duelists use. A draft stays here. A published one is public to anyone, no link needed."
        end={<Button href="/admin/statistics/explorations/new" size="mono-md">New exploration</Button>}
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the explorations">{panelErrorText(loadError)}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex-1 text-ink-muted signal">In the order duelists see them</span>
            <span className="text-ink-muted signal-sm">Drag, or arrow keys on the handle</span>
          </div>
          {list.map((e, i) => {
            const status = statusOf(e)
            return (
              <div
                key={e.id}
                role="group"
                aria-label={e.name}
                draggable
                onDragStart={() => setDragging(e.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={() => dragging && move(dragging, i)}
                className={twMerge(
                  'cut grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 py-4 pr-4.5 pl-2 [--edge:var(--color-line)] [--fill:var(--color-surface-100)] hover:[--fill:var(--color-surface-300)]',
                  e.id === picked?.id && '[--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)] [--sw:var(--stroke)] hover:[--fill:var(--color-ground-cyan)]',
                  dragging === e.id && 'opacity-(--opacity-dim)',
                )}
              >
                <button
                  type="button"
                  aria-label={`Move ${e.name}. Arrow up or down.`}
                  onKeyDown={(ev) => {
                    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
                      ev.preventDefault()
                      move(e.id, i + (ev.key === 'ArrowUp' ? -1 : 1))
                    }
                  }}
                  className="grid h-10 w-8 cursor-grab place-items-center text-ink-muted hover:text-ink"
                >
                  <Icon name="grip" size={14} />
                </button>
                <button type="button" onClick={() => setPickedId(e.id)} className="flex min-w-0 cursor-pointer flex-col gap-1.5 text-left">
                  <span className="flex items-center gap-2.5">
                    <span className="text-ink-muted data">{i}</span>
                    <span className="text-[15px] font-bold">{e.name}</span>
                  </span>
                  {e.description ? <span className="text-[13px] leading-5 text-ink-dim">{e.description}</span> : null}
                  <span className="flex flex-wrap gap-1.5">
                    <Chip>{cap(e.config.technique)}</Chip>
                    {e.config.segments.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </span>
                </button>
                <span className="flex flex-col items-end gap-1.5">
                  {status.chip}
                  <span className="text-ink-muted signal-sm">{status.when}</span>
                </span>
              </div>
            )
          })}
          {data && list.length === 0 ? <p className="text-ink-muted body-sm">No global exploration yet. A new one stays a draft until you publish it.</p> : null}
        </div>

        {picked && d ? (
          <Panel label="Exploration" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-ink-muted data">Exploration {picked.id} · position {picked.position}</span>
              <h2 className="display-2">{d.name || 'Untitled'}</h2>
            </div>
            <Field label="Name" htmlFor="ex-name" hint="1–60 characters">
              <TextInput id="ex-name" maxLength={60} value={d.name} onChange={(e) => setDraft({ ...d, name: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="ex-desc">
              <TextArea id="ex-desc" rows={3} maxLength={2000} value={d.description} onChange={(e) => setDraft({ ...d, description: e.target.value })} />
            </Field>
            <Field
              label="Config"
              meta={<span className={problem ? 'text-gold' : 'text-win'}>{problem ? problem.title : 'Valid'}</span>}
              hint="Every metric from one source, and every dimension inside each metric’s split. Archetype values are setcodes."
            >
              <dl className="flex flex-col">
                {[
                  ['Technique', cap(picked.config.technique)],
                  ['Segments', picked.config.segments.join(', ')],
                  ['Rows', picked.config.rows.join(', ') || '—'],
                  ['Columns', picked.config.columns ?? '—'],
                  ['Values', picked.config.values.join(', ') || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="grid min-h-10 grid-cols-[96px_minmax(0,1fr)] items-center gap-3 border-t border-line">
                    <dt className="text-ink-muted signal-sm">{label}</dt>
                    <dd className={label === 'Technique' ? 'text-sm' : 'text-ink data'}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <Button href={`/admin/statistics/explorations/${picked.id}`} variant="secondary" size="mono">Edit in the builder</Button>
              </div>
            </Field>
            <Switch
              checked={d.published}
              onChange={(value) => setDraft({ ...d, published: value })}
              label="Published"
              hint={
                picked.publishedAt
                  ? `First published ${dayLabel(picked.publishedAt)}. Turning it off makes it a draft again.`
                  : 'Public to anyone once saved, listed on the analytics page.'
              }
            />
            {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
            <div className="flex gap-3">
              <Button size="mono-md" className="flex-1" disabled={busy || !d.name.trim()} onClick={save}>Save exploration</Button>
              <Button variant="danger-outline" size="mono-md" disabled={busy} onClick={remove}>Delete</Button>
            </div>
          </Panel>
        ) : null}
      </div>
    </>
  )
}

export default ExplorationsPage
