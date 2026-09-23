'use client'

import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button, Chip } from '@ui/index'
import { useSearch } from '@hooks/index'
import { findArchetypes, searchCardArts, type Archetype } from '@utils/cards'
import {
  createCardGroup,
  deleteCardGroup,
  listCardGroups,
  updateCardGroup,
  type CardGroup,
  type CardGroupBody,
  type CardGroupKind,
} from '@utils/panel'
import { Empty, errorText, Field, INPUT, List, ListRow, Notice, Row, RowButton, Toggle } from './ui'

type GroupCard = CardGroup['cards'][number]

type Draft = {
  kind: CardGroupKind
  name: string
  description: string
  handTrap: boolean
  exceptions: Archetype[]
  cards: GroupCard[]
}

const BLANK: Draft = { kind: 'engine', name: '', description: '', handTrap: false, exceptions: [], cards: [] }

const toDraft = ({ kind, name, description, handTrap, exceptions, cards }: CardGroup): Draft => ({
  kind,
  name,
  description,
  handTrap,
  exceptions,
  cards,
})

/** Only what belongs to the kind is sent: the API answers 400 on a hand-trap engine or a tech with exceptions. */
const toBody = (draft: Draft): CardGroupBody => ({
  kind: draft.kind,
  name: draft.name.trim(),
  description: draft.description.trim(),
  handTrap: draft.kind === 'tech' && draft.handTrap,
  exceptions: draft.kind === 'engine' ? draft.exceptions.map(({ code }) => code) : [],
  cards: draft.cards.map(({ id }) => id),
})

const findCards = (text: string, signal: AbortSignal) => searchCardArts(text, 8, signal)
const findExceptions = async (text: string, signal: AbortSignal) => (await findArchetypes(text, signal)).slice(0, 8)

const cardLabel = (card: GroupCard) => card.name ?? `#${card.id} — not in the card database`

const PICK = 'cursor-pointer border border-surface-400 px-3 py-2.25 text-ink-muted signal-chip hover:border-gold hover:text-gold'

/* ---------------------------------------------------------------- *
 * The form
 * ---------------------------------------------------------------- */

const GroupForm = ({
  group,
  onDone,
  onCancel,
}: {
  group: CardGroup | null
  onDone: (group: CardGroup) => void
  onCancel: () => void
}) => {
  const [draft, setDraft] = useState<Draft>(group ? toDraft(group) : BLANK)
  const [cardText, setCardText] = useState('')
  const [archetypeText, setArchetypeText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cardResults = useSearch(cardText, findCards)
  const archetypeResults = useSearch(archetypeText, findExceptions)

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))

  const addCard = (card: GroupCard) => {
    if (!draft.cards.some(({ id }) => id === card.id)) set({ cards: [...draft.cards, card] })
    setCardText('')
  }

  const addException = (archetype: Archetype) => {
    if (!draft.exceptions.some(({ code }) => code === archetype.code)) set({ exceptions: [...draft.exceptions, archetype] })
    setArchetypeText('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = toBody(draft)
      onDone(group ? await updateCardGroup(group.id, body) : await createCardGroup(body))
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-line-strong bg-surface-100 p-5.5 lg:p-7">
      <p className="text-gold signal-lg">{group ? `Edit ${group.name}` : 'New group'}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field id="group-name" label="Name" hint="Unique across engine and tech, case-insensitive.">
          <input
            id="group-name"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            required
            maxLength={80}
            autoComplete="off"
            placeholder="Fallen of Albaz"
            className={INPUT}
          />
        </Field>

        <Field id="group-kind" label="Kind" hint="Hand traps are always techs; exceptions are engine only.">
          <select
            id="group-kind"
            value={draft.kind}
            onChange={(e) => set({ kind: e.target.value as CardGroupKind })}
            className={INPUT}
          >
            <option value="engine">Engine</option>
            <option value="tech">Tech</option>
          </select>
        </Field>

        <Field id="group-description" label="Description" className="md:col-span-2">
          <textarea
            id="group-description"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={2000}
            rows={2}
            className={INPUT}
          />
        </Field>

        {draft.kind === 'tech' ? (
          <div className="md:col-span-2">
            <Toggle label="Hand trap" checked={draft.handTrap} onChange={(handTrap) => set({ handTrap })} />
          </div>
        ) : (
          <Field
            id="group-exceptions"
            label="Not engine in"
            hint="Deck archetypes where these cards are not engine. Up to 50."
            className="md:col-span-2"
          >
            <input
              id="group-exceptions"
              value={archetypeText}
              onChange={(e) => setArchetypeText(e.target.value)}
              autoComplete="off"
              placeholder="Search an archetype"
              className={INPUT}
            />
            {archetypeText.trim().length >= 2 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {archetypeResults.map((archetype) => (
                  <button key={archetype.code} type="button" onClick={() => addException(archetype)} className={PICK}>
                    {archetype.name}
                  </button>
                ))}
              </div>
            ) : null}
            {draft.exceptions.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {draft.exceptions.map((archetype) => (
                  <RowButton
                    key={archetype.code}
                    tone="gold"
                    aria-label={`Remove ${archetype.name}`}
                    onClick={() => set({ exceptions: draft.exceptions.filter(({ code }) => code !== archetype.code) })}
                  >
                    {archetype.name} ×
                  </RowButton>
                ))}
              </div>
            ) : null}
          </Field>
        )}

        <Field
          id="group-cards"
          label={`Cards (${draft.cards.length})`}
          hint="By name or passcode. An alternate art is saved as the original card. Up to 1000."
          className="md:col-span-2"
        >
          <input
            id="group-cards"
            value={cardText}
            onChange={(e) => setCardText(e.target.value)}
            autoComplete="off"
            placeholder="Called by the Grave"
            className={INPUT}
          />
          {cardText.trim().length >= 2 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cardResults.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => addCard({ id: card.id, name: card.name, kind: null })}
                  className={PICK}
                >
                  {card.name}
                </button>
              ))}
            </div>
          ) : null}
          {draft.cards.length ? (
            <List className="mt-3">
              {draft.cards.map((card) => (
                <ListRow key={card.id} className="flex items-center justify-between gap-3 py-2">
                  <span className={twMerge('min-w-0 truncate body-sm', card.name ? 'text-ink' : 'text-negative')}>
                    {cardLabel(card)}
                    <span className="ml-2 text-ink-muted mono-note">
                      {card.id}
                      {card.kind ? ` · ${card.kind}` : ''}
                    </span>
                  </span>
                  <RowButton
                    tone="danger"
                    aria-label={`Remove ${card.name ?? card.id}`}
                    onClick={() => set({ cards: draft.cards.filter(({ id }) => id !== card.id) })}
                  >
                    Remove
                  </RowButton>
                </ListRow>
              ))}
            </List>
          ) : null}
        </Field>
      </div>

      {error ? (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : group ? 'Save group' : 'Create group'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- *
 * The list
 * ---------------------------------------------------------------- */

const GroupRow = ({ group, onEdit, onDelete }: { group: CardGroup; onEdit: () => void; onDelete: () => Promise<void> }) => {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const missing = group.cards.filter((card) => card.name === null).length
  // Only monster hand traps count in the "responded by Called by the Grave / Crossout" statistic.
  const monsters = group.handTrap ? group.cards.filter((card) => card.kind === 'monster').length : 0

  return (
    <ListRow>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ink display-5">{group.name}</p>
          <p className="mt-1.5 text-ink-muted mono-data">
            {group.cards.length} card{group.cards.length === 1 ? '' : 's'}
            {group.handTrap ? ` · ${monsters} monster${monsters === 1 ? '' : 's'} counted vs. Called by / Crossout` : ''}
            {group.exceptions.length ? ` · not engine in ${group.exceptions.map(({ name }) => name).join(', ')}` : ''}
          </p>
          {group.description ? <p className="mt-1.5 text-ink-dim body-sm">{group.description}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Chip tone={group.kind === 'engine' ? 'cyan' : 'indigo'}>{group.kind}</Chip>
          {group.handTrap ? <Chip tone="gold">hand trap</Chip> : null}
          {missing ? (
            <Chip tone="amber" title="Cards that left the card database.">
              {missing} missing
            </Chip>
          ) : null}
          <RowButton onClick={onEdit}>Edit</RowButton>
          <RowButton tone="danger" onClick={() => setConfirming(true)}>
            Delete
          </RowButton>
        </div>
      </div>

      {confirming ? (
        <div className="mt-3.75 border border-negative bg-ground-negative px-4 py-3.5">
          <p className="text-ink body-sm">
            Delete <strong>{group.name}</strong>? Its {group.cards.length} cards stop counting as {group.kind}.
          </p>
          <div className="mt-3 flex gap-2">
            <RowButton
              tone="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onDelete().finally(() => setBusy(false))
              }}
            >
              {busy ? 'Deleting…' : 'Delete it'}
            </RowButton>
            <RowButton onClick={() => setConfirming(false)} disabled={busy}>
              Keep
            </RowButton>
          </div>
        </div>
      ) : null}
    </ListRow>
  )
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'engine', label: 'Engine' },
  { id: 'tech', label: 'Tech' },
] as const

export const CardGroupsPanel = () => {
  const [groups, setGroups] = useState<CardGroup[] | null>(null)
  const [filter, setFilter] = useState<'all' | CardGroupKind>('all')
  const [editing, setEditing] = useState<CardGroup | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    listCardGroups(abort.signal)
      .then(setGroups)
      .catch((failure) => !abort.signal.aborted && setError(errorText(failure)))
    return () => abort.abort()
  }, [])

  const saved = (group: CardGroup) => {
    setEditing(null)
    setError(null)
    setGroups((current) => {
      const rest = (current ?? []).filter(({ id }) => id !== group.id)
      // Same order as the API: kind, then name.
      return [...rest, group].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
    })
  }

  const remove = async (id: number) => {
    try {
      await deleteCardGroup(id)
      setGroups((current) => current?.filter((group) => group.id !== id) ?? null)
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  const shown = groups?.filter((group) => filter === 'all' || group.kind === filter) ?? null

  return (
    <Row
      index="01"
      title="Card groups"
      blurb="What each card is inside a deck: engine, tech, hand trap. A card can sit in any number of groups, of both kinds. Global analytics reads them at the nightly sweep: re-sweep the season (Ranked ops) to apply a change to past days."
      action={
        editing === null ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            New group
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6">
        {editing !== null ? (
          <GroupForm
            key={editing === 'new' ? 'new' : editing.id}
            group={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)} onDone={saved} />
        ) : null}

        <Notice tone="error">{error}</Notice>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by kind">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={twMerge(
                'cursor-pointer border px-3 py-2.25 signal-chip',
                filter === id ? 'border-gold bg-gold text-gold-on' : 'border-surface-400 text-ink-muted hover:border-gold hover:text-gold',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {shown === null ? (
          <Empty>Loading card groups…</Empty>
        ) : shown.length === 0 ? (
          <Empty>No group here yet.</Empty>
        ) : (
          <List>
            {shown.map((group) => (
              <GroupRow key={group.id} group={group} onEdit={() => setEditing(group)} onDelete={() => remove(group.id)} />
            ))}
          </List>
        )}
      </div>
    </Row>
  )
}
