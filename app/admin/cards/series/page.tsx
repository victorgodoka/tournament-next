'use client'

import { useState } from 'react'
import { Alert, Button, Chip, Field, Lookup, PageHeader, Panel, Segmented, Switch, Tag, TextArea, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { createSeries, deleteSeries, getSeries, listSeries, panelErrorText, updateSeries, type Series } from '@utils/panel'
import { ANALYTICS_ENABLED } from '@utils/const'
import { RulesRebuildNotice } from '@omega/analytics/rules-rebuild-notice'
import { CardList, findCards, findSetcodes, pickedCard } from '../shared'

type Draft = Omit<Series, 'id' | 'code' | 'updatedAt' | 'members'> & { id: number | null; code: number | null }

const blank = (): Draft => ({ id: null, code: null, name: '', description: '', archetype: null, mode: 'extend', archetypes: [], cards: [], mentions: [] })
const toDraft = (s: Series): Draft => ({
  id: s.id,
  code: s.code,
  name: s.name,
  description: s.description,
  archetype: s.archetype,
  mode: s.mode,
  archetypes: s.archetypes,
  cards: s.cards,
  mentions: s.mentions,
})

const MEMBERS = 12

const SeriesPage = () => {
  const list = useResource('series', listSeries)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [allMembers, setAllMembers] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const d = draft ?? (list.data?.[0] ? toDraft(list.data[0]) : null)
  const set = (patch: Partial<Draft>) => d && setDraft({ ...d, ...patch })
  const detail = useResource(d?.id != null ? `series:${d.id}` : null, (signal) => getSeries(d!.id!, signal))
  const members = detail.data?.members ?? []

  const save = () => {
    if (!d) return
    const body = {
      name: d.name.trim(),
      description: d.description,
      archetype: d.archetype?.code ?? null,
      mode: d.archetype ? d.mode : 'extend',
      archetypes: d.archetypes.map(({ code, keep }) => ({ code, keep })),
      cards: d.cards.map((c) => c.id),
      mentions: d.mentions.map((c) => c.id),
    }
    setBusy(true)
    setError(null)
    ;(d.id === null ? createSeries(body) : updateSeries(d.id, body))
      .then((saved) => {
        setDraft(toDraft(saved))
        list.reload()
        detail.reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const remove = () => {
    if (d?.id == null) return
    setBusy(true)
    setError(null)
    deleteSeries(d.id)
      .then(() => {
        setDraft(null)
        list.reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Cards · ${list.data?.length ?? 0} Series`}
        title="Series"
        lead="An archetype made of cards. It creates a new one, or overrides an existing setcode. Global analytics, duelist analytics and tournament decklists all read it."
        end={<Button size="mono-md" onClick={() => setDraft(blank())}>New Series</Button>}
      />
      {ANALYTICS_ENABLED ? <RulesRebuildNotice /> : null}
      {list.error ? <Alert tone="negative" title="Couldn't read the Series">{panelErrorText(list.error)}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          {(list.data ?? []).map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === d?.id}
              onClick={() => setDraft(toDraft(s))}
              className="cut flex w-full cursor-pointer flex-col gap-2 px-4.5 py-4 text-left text-ink [--edge:var(--color-line)] [--fill:var(--color-surface-100)] hover:[--fill:var(--color-surface-300)] aria-pressed:[--edge:var(--color-cyan)] aria-pressed:[--fill:var(--color-ground-cyan)] aria-pressed:[--sw:var(--stroke)]"
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex-1 text-[15px] font-bold">{s.name}</span>
                <span className="text-ink-muted data">{s.code}</span>
              </span>
              <span className="flex gap-1.5">
                {s.archetype ? <Chip tone="gold">Override</Chip> : <Chip className="text-cyan [--edge:var(--color-cyan)]">New archetype</Chip>}
                <Chip>
                  {s.mode === 'replace' ? 'Replace' : 'Extend'}
                  {s.archetypes.length ? ` · ${s.archetypes.length} child${s.archetypes.length > 1 ? 'ren' : ''}` : ''}
                </Chip>
              </span>
            </button>
          ))}
          {list.data && list.data.length === 0 ? <p className="text-ink-muted body-sm">No Series yet.</p> : null}
        </div>

        {d ? (
          <Panel label="Series editor" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-ink-muted data">{d.code === null ? 'New Series · code on save' : `Code in the stats · ${d.code}`}</span>
              <h2 className="display-2">{d.name || 'Untitled'}</h2>
            </div>
            <Field label="Name" htmlFor="ser-name">
              <TextInput id="ser-name" maxLength={80} value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="ser-desc">
              <TextArea id="ser-desc" rows={2} maxLength={2000} value={d.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 items-start gap-4 min-[720px]:grid-cols-[minmax(0,1fr)_auto]">
              <Field label="Overrides setcode" hint="One Series per setcode">
                {d.archetype ? (
                  <span>
                    <Tag note={d.archetype.code} removeLabel="Stop overriding" onRemove={() => set({ archetype: null, mode: 'extend' })}>
                      {d.archetype.name ?? d.archetype.code}
                    </Tag>
                  </span>
                ) : (
                  <Lookup
                    label="Setcode to override"
                    placeholder="None · new archetype"
                    search={findSetcodes}
                    onPick={(o) => set({ archetype: { code: Number(o.key), name: String(o.label) } })}
                  />
                )}
              </Field>
              <Field label="Mode" hint={d.archetype ? 'Replace: only the children count' : 'Replace needs a setcode'}>
                <Segmented
                  label="Mode"
                  value={d.mode}
                  onChange={(mode) => set({ mode })}
                  options={[
                    { value: 'extend', label: 'Extend' },
                    { value: 'replace', label: 'Replace', disabled: !d.archetype },
                  ]}
                />
              </Field>
            </div>

            <Field label="Mentions" meta={`${d.mentions.length} of 50`} hint="Takes every card whose English text quotes this card’s name. Resolved again after each card sync.">
              <CardList cards={d.mentions} onRemove={(id) => set({ mentions: d.mentions.filter((c) => c.id !== id) })} />
              <Lookup
                label="Add mention"
                placeholder="Search a card by name"
                search={findCards}
                onPick={(o) => !d.mentions.some((c) => c.id === Number(o.key)) && set({ mentions: [...d.mentions, pickedCard(o)] })}
              />
            </Field>

            <Field
              label="Child archetypes"
              meta={`${d.archetypes.length} of 50`}
              hint={`Keep on: its cards count here only when the deck has another ${d.name || 'Series'} card. Keep off: the setcode stops existing.`}
            >
              {d.archetypes.length ? (
                <ul className="flex flex-col">
                  {d.archetypes.map((child) => (
                    <li key={child.code} className="flex min-h-11 items-center gap-3 border-t border-line">
                      <span className="w-24 text-ink-dim data">{child.code}</span>
                      <span className="flex-1 truncate text-sm font-bold">{child.name ?? '—'}</span>
                      <Switch
                        quiet
                        label="Keep"
                        checked={child.keep}
                        onChange={(keep) => set({ archetypes: d.archetypes.map((x) => (x.code === child.code ? { ...x, keep } : x)) })}
                      />
                      <Button variant="ghost" size="mono" className="text-crimson-lift" onClick={() => set({ archetypes: d.archetypes.filter((x) => x.code !== child.code) })}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border border-dashed border-line-mid px-4 py-3.5 text-[13px] text-ink-muted">
                  No child archetypes. Add a setcode to count all of its cards for {d.name || 'this Series'}.
                </p>
              )}
              <Lookup
                label="Add child archetype"
                placeholder="Add an archetype"
                search={findSetcodes}
                onPick={(o) =>
                  Number(o.key) !== d.archetype?.code &&
                  !d.archetypes.some((x) => x.code === Number(o.key)) &&
                  set({ archetypes: [...d.archetypes, { code: Number(o.key), name: String(o.label), keep: true }] })
                }
              />
            </Field>

            <Field label="Cards" meta={`${d.cards.length} of 1000`} hint="Direct members. Alternate art is saved as the original.">
              <Lookup
                label="Add card"
                placeholder="Passcode or card name"
                search={findCards}
                onPick={(o) => !d.cards.some((c) => c.id === Number(o.key)) && set({ cards: [...d.cards, pickedCard(o)] })}
              />
              <CardList cards={d.cards} onRemove={(id) => set({ cards: d.cards.filter((c) => c.id !== id) })} />
            </Field>

            {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
            <div className="flex gap-3">
              <Button size="mono-md" disabled={busy || !d.name.trim()} onClick={save}>Save Series</Button>
              {d.id !== null ? (
                <Button variant="danger-outline" size="mono-md" disabled={busy} onClick={remove}>Delete</Button>
              ) : null}
            </div>
          </Panel>
        ) : null}

        {d?.id != null ? (
          <Panel label="Members" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)] xl:col-start-2 2xl:col-start-auto">
            <div className="flex flex-col gap-1.5">
              <span className="text-ink-muted signal-sm">Takes today</span>
              <h2 className="display-3">Members</h2>
            </div>
            <ul className="flex flex-col">
              {(allMembers ? members : members.slice(0, MEMBERS)).map((m) => (
                <li key={m.id} className="flex min-h-11 items-center gap-2.5 border-t border-line py-1.5">
                  <span className="flex-1 text-sm">{m.name ?? m.id}</span>
                  <span className="text-ink-muted data">{m.id}</span>
                </li>
              ))}
              {detail.data && members.length === 0 ? <li className="border-t border-line py-3 text-ink-muted body-sm">No members yet.</li> : null}
            </ul>
            {members.length > MEMBERS && !allMembers ? (
              <Button variant="secondary" size="mono" onClick={() => setAllMembers(true)}>Show every member · {members.length}</Button>
            ) : null}
            <span className="text-ink-muted caption">Direct cards plus resolved mentions, as of the last card sync.</span>
          </Panel>
        ) : null}
      </div>
    </>
  )
}

export default SeriesPage
