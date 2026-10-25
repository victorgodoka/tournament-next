'use client'

import { useCallback, useState } from 'react'
import { Alert, Button, Chip, Field, Lookup, PageHeader, Panel, Segmented, Switch, Tag, TextArea, TextInput, type ChipTone, type LookupOption } from '@ui/index'
import { useResource } from '@hooks/index'
import { dayTime } from '@utils/format'
import {
  createCardGroup,
  deleteCardGroup,
  listCardGroups,
  listSeries,
  panelErrorText,
  updateCardGroup,
  type CardGroup,
  type CardGroupKind,
} from '@utils/panel'
import { CardList, findCards, findSetcodes, pickedCard } from '../shared'

type Draft = Omit<CardGroup, 'id' | 'updatedAt'> & { id: number | null; updatedAt: string | null }

const blank = (): Draft => ({ id: null, kind: 'engine', name: '', description: '', handTrap: false, exceptions: [], cards: [], cover: null, updatedAt: null })

const kindChip = (g: Pick<CardGroup, 'kind' | 'handTrap'>): { label: string; tone: ChipTone } =>
  g.handTrap ? { label: 'Hand trap', tone: 'negative' } : g.kind === 'engine' ? { label: 'Engine', tone: 'indigo' } : { label: 'Tech', tone: 'gold' }

const load = (signal: AbortSignal) => Promise.all([listCardGroups(signal), listSeries(signal)]).then(([groups, series]) => ({ groups, series }))

const CardGroupsPage = () => {
  const { data, error: loadError, reload } = useResource('card-groups', load)
  const [filter, setFilter] = useState<'all' | CardGroupKind>('all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groups = (data?.groups ?? []).filter((g) => filter === 'all' || g.kind === filter)
  const d = draft ?? (data?.groups[0] ? { ...data.groups[0] } : null)
  const set = (patch: Partial<Draft>) => d && setDraft({ ...d, ...patch })

  const series = data?.series
  const cards = d?.cards
  // The cover is one of the group's own cards: a local search, no request.
  const findCover = useCallback(
    (text: string): Promise<LookupOption[]> =>
      Promise.resolve(
        (cards ?? [])
          .filter((c) => (c.name ?? String(c.id)).toLowerCase().includes(text.toLowerCase()))
          .slice(0, 8)
          .map((c) => ({ key: c.id, label: c.name ?? String(c.id), meta: c.id })),
      ),
    [cards],
  )
  // Archetypes from the card database, plus Series by name: both are valid exception codes.
  const findExceptions = useCallback(
    (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
      findSetcodes(text, signal).then((found) => [
        ...(series ?? []).filter((s) => s.name.toLowerCase().includes(text.toLowerCase())).map((s) => ({ key: s.code, label: `${s.name} (Series)`, meta: s.code })),
        ...found,
      ]),
    [series],
  )

  const save = () => {
    if (!d) return
    const body = {
      kind: d.kind,
      name: d.name.trim(),
      description: d.description,
      handTrap: d.kind === 'tech' && d.handTrap,
      exceptions: d.kind === 'engine' ? d.exceptions.map((e) => e.code) : [],
      cards: d.cards.map((c) => c.id),
      cover: d.cover,
    }
    setBusy(true)
    setError(null)
    ;(d.id === null ? createCardGroup(body) : updateCardGroup(d.id, body))
      .then((saved) => {
        setDraft({ ...saved })
        reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const remove = () => {
    if (d?.id == null) return
    setBusy(true)
    setError(null)
    deleteCardGroup(d.id)
      .then(() => {
        setDraft(null)
        reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Cards · ${data?.groups.length ?? 0} groups`}
        title="Card categories"
        lead="What a card is inside a deck: engine, tech or hand trap. A card can sit in any number of groups, of both kinds."
        end={<Button size="mono-md" onClick={() => setDraft(blank())}>New group</Button>}
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the groups">{panelErrorText(loadError)}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Segmented
            label="Kind"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'engine', label: 'Engine' },
              { value: 'tech', label: 'Tech' },
            ]}
          />
          {groups.map((g) => {
            const chip = kindChip(g)
            const monsters = g.cards.filter((c) => c.kind === 'monster').length
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={g.id === d?.id}
                onClick={() => setDraft({ ...g })}
                className="cut flex w-full cursor-pointer flex-col gap-2 px-4.5 py-4 text-left text-ink [--edge:var(--color-line)] [--fill:var(--color-surface-100)] hover:[--fill:var(--color-surface-300)] aria-pressed:[--edge:var(--color-cyan)] aria-pressed:[--fill:var(--color-ground-cyan)] aria-pressed:[--sw:var(--stroke)]"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1 text-[15px] font-bold">{g.name}</span>
                  <Chip tone={chip.tone}>{chip.label}</Chip>
                </span>
                <span className="text-ink-muted signal-sm">
                  {g.cards.length} cards
                  {g.kind === 'engine' ? ` · ${g.exceptions.length} exceptions` : ''}
                  {g.handTrap ? ` · ${monsters} monsters count for Called by the Grave` : ''}
                </span>
              </button>
            )
          })}
          {data && groups.length === 0 ? <p className="text-ink-muted body-sm">No groups of this kind.</p> : null}
        </div>

        {d ? (
          <Panel label="Group editor" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-ink-muted data">{d.id === null ? 'New group' : `Group #${d.id}${d.updatedAt ? ` · updated ${dayTime(d.updatedAt)}` : ''}`}</span>
              <h2 className="display-2">{d.name || 'Untitled'}</h2>
            </div>
            <div className="grid grid-cols-1 items-start gap-5 min-[720px]:grid-cols-[auto_minmax(0,1fr)]">
              <Field label="Kind">
                <Segmented
                  label="Kind"
                  value={d.kind}
                  onChange={(kind) => set({ kind, handTrap: kind === 'tech' && d.handTrap })}
                  options={[
                    { value: 'engine', label: 'Engine' },
                    { value: 'tech', label: 'Tech' },
                  ]}
                />
              </Field>
              <Field label="Name" htmlFor="grp-name" hint="Unique across engine and tech, ignoring case">
                <TextInput id="grp-name" maxLength={80} value={d.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
            </div>
            <Field label="Description" htmlFor="grp-desc">
              <TextArea id="grp-desc" rows={2} maxLength={2000} placeholder="Optional, up to 2000 characters" value={d.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Switch
              checked={d.handTrap}
              disabled={d.kind !== 'tech'}
              onChange={(handTrap) => set({ handTrap })}
              label="Hand traps"
              hint={d.kind === 'tech' ? 'Only monster hand traps count for “responded by Called by the Grave / Crossout Designator”.' : 'Hand traps are always tech. Switch the kind to Tech to turn this on.'}
            />
            {d.kind === 'engine' ? (
              <Field
                label="Not engine in these decks"
                meta={`${d.exceptions.length} of 50`}
                hint="In a deck of one of these archetypes, these cards count as that deck’s own cards."
              >
                <div className="flex flex-wrap items-center gap-2">
                  {d.exceptions.map((e) => (
                    <Tag key={e.code} note={e.code} removeLabel={`Remove ${e.name}`} onRemove={() => set({ exceptions: d.exceptions.filter((x) => x.code !== e.code) })}>
                      {e.name}
                    </Tag>
                  ))}
                  <Lookup
                    compact
                    label="Add archetype exception"
                    placeholder="Add an archetype or Series"
                    search={findExceptions}
                    className="w-65"
                    onPick={(o) =>
                      !d.exceptions.some((x) => x.code === Number(o.key)) &&
                      set({ exceptions: [...d.exceptions, { code: Number(o.key), name: String(o.label).replace(/ \(Series\)$/, '') }] })
                    }
                  />
                </div>
              </Field>
            ) : null}
            <Field
              label="Cards"
              meta={`${d.cards.length} of 1000`}
              hint="Alternate art is saved as the original passcode, and duplicates collapse into one."
            >
              <Lookup label="Add card" placeholder="Passcode or card name" search={findCards} onPick={(o) => !d.cards.some((c) => c.id === Number(o.key)) && set({ cards: [...d.cards, pickedCard(o)] })} />
              <CardList cards={d.cards} onRemove={(id) => set({ cards: d.cards.filter((c) => c.id !== id), cover: d.cover === id ? null : d.cover })} />
            </Field>
            <Field label="Cover" hint="The card that stands for the group where it shows as one line (cards used against a deck). Optional: without one, the first card of the list is the cover.">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const cover = d.cards.find((c) => c.id === d.cover)
                  return cover ? (
                    <Tag note={cover.id} removeLabel="Clear the cover" onRemove={() => set({ cover: null })}>{cover.name ?? cover.id}</Tag>
                  ) : (
                    <span className="text-ink-muted signal-sm">{d.cards[0] ? `Default: ${d.cards[0].name ?? d.cards[0].id}` : 'No cards yet'}</span>
                  )
                })()}
                <Lookup compact label="Pick the cover" placeholder="One of the group’s cards" search={findCover} className="w-65" onPick={(o) => set({ cover: Number(o.key) })} />
              </div>
            </Field>
            {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
            <div className="flex gap-3 pt-1">
              <Button size="mono-md" disabled={busy || !d.name.trim()} onClick={save}>Save group</Button>
              {d.id !== null ? (
                <Button variant="danger-outline" size="mono-md" disabled={busy} onClick={remove}>Delete</Button>
              ) : null}
            </div>
          </Panel>
        ) : null}
      </div>
    </>
  )
}

export default CardGroupsPage
