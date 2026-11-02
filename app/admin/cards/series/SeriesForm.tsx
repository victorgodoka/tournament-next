'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Field, TextArea, TextInput } from '@ui/field'
import { Lookup } from '@ui/lookup'
import type { Series, SeriesInput } from '@utils/panel'
import { findCards, findSetcodes, NextBuildNote } from '../shared'

type Pick = { id: number; label: string }
type State = { name: string; description: string; archetype: Pick | null; archetypes: Pick[]; cards: Pick[]; mentions: Pick[] }

const named = (id: number, name: string | null, fallback: string) => ({ id, label: name ?? `${fallback} ${id}` })

export const stateOf = (series?: Series): State => ({
  name: series?.name ?? '',
  description: series?.description ?? '',
  archetype: series?.archetype ? named(series.archetype.code, series.archetype.name, 'Setcode') : null,
  archetypes: series?.archetypes.map((a) => named(a.code, a.name, 'Setcode')) ?? [],
  cards: series?.cards.map((c) => named(c.id, c.name, 'Card')) ?? [],
  mentions: series?.mentions.map((c) => named(c.id, c.name, 'Card')) ?? [],
})

/** The body the form sends: numbers only, and only the six fields the API accepts. */
export const payloadOf = (s: State): SeriesInput => ({
  name: s.name.trim(),
  description: s.description,
  archetype: s.archetype?.id ?? null,
  archetypes: s.archetypes.map((p) => p.id),
  cards: s.cards.map((p) => p.id),
  mentions: s.mentions.map((p) => p.id),
})

const Chips = ({ items, onRemove }: { items: Pick[]; onRemove: (id: number) => void }) =>
  items.length ? (
    <ul className="flex flex-wrap gap-2">
      {items.map((p) => (
        <li key={p.id}>
          <Chip>
            {p.label}
            <button type="button" aria-label={`Remove ${p.label}`} onClick={() => onRemove(p.id)} className="cursor-pointer text-ink-muted hover:text-ink">×</button>
          </Chip>
        </li>
      ))}
    </ul>
  ) : null

type ListKey = 'archetypes' | 'cards' | 'mentions'

export const SeriesForm = ({ series, saving, error, onSave, onCancel }: { series?: Series; saving: boolean; error: string | null; onSave: (input: SeriesInput) => void; onCancel: () => void }) => {
  const [state, setState] = useState(() => stateOf(series))
  const add = (key: ListKey, o: { key: string | number; label: React.ReactNode }) =>
    setState((s) => ({ ...s, [key]: [...s[key], { id: Number(o.key), label: String(o.label) }] }))
  const remove = (key: ListKey) => (id: number) => setState((s) => ({ ...s, [key]: s[key].filter((p) => p.id !== id) }))
  const ids = (key: ListKey) => state[key].map((p) => p.id)

  return (
    <form
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(payloadOf(state))
      }}
    >
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}
      <Field label="Name" htmlFor="series-name" hint="1 to 80 characters, unique.">
        <TextInput id="series-name" required maxLength={80} value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
      </Field>
      <Field label="Description" htmlFor="series-description">
        <TextArea id="series-description" maxLength={2000} value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} />
      </Field>
      <Field label="Becomes setcode" hint="Empty makes a new archetype; a setcode makes the Series that setcode.">
        <Chips items={state.archetype ? [state.archetype] : []} onRemove={() => setState({ ...state, archetype: null })} />
        <Lookup label="Setcode the Series becomes" placeholder="Archetype name or setcode" search={findSetcodes} onPick={(o) => setState({ ...state, archetype: { id: Number(o.key), label: String(o.label) } })} />
      </Field>
      <Field label="Child setcodes" meta={`${state.archetypes.length} of 32`} hint="Their cards count for the Series in every deck.">
        <Chips items={state.archetypes} onRemove={remove('archetypes')} />
        <Lookup label="Add child setcode" placeholder="Archetype name or setcode" search={findSetcodes} exclude={ids('archetypes')} onPick={(o) => add('archetypes', o)} />
      </Field>
      <Field label="Cards" meta={`${state.cards.length} of 200`} hint="The members.">
        <Chips items={state.cards} onRemove={remove('cards')} />
        <Lookup label="Add card" placeholder="Card name or passcode" search={findCards} exclude={ids('cards')} onPick={(o) => add('cards', o)} />
      </Field>
      <Field label="Mentions" meta={`${state.mentions.length} of 200`} hint="Cards whose quoted name makes members; not members themselves.">
        <Chips items={state.mentions} onRemove={remove('mentions')} />
        <Lookup label="Add mention" placeholder="Card name or passcode" search={findCards} exclude={ids('mentions')} onPick={(o) => add('mentions', o)} />
      </Field>
      <div className="flex gap-3">
        <Button type="submit" disabled={saving || !state.name.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <NextBuildNote />
    </form>
  )
}
