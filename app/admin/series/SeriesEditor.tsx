'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@ui/button'
import { Segmented, Switch } from '@ui/choice'
import { Select } from '@ui/field'
import { Lookup } from '@ui/lookup'
import { useResource } from '@hooks/index'
import { searchCardArts, setcodeCards } from '@utils/cards'
import { dayLabel } from '@utils/format'
import { createSeries, listFilters, listSeriesMembers, panelErrorText, updateSeries, type Series, type SeriesInput } from '@utils/panel'
import { CardThumb, count, Cover, Failure, findCards, findSetcodes, Head, hex, NextBuildNote, Rail, TWO_STEPS, useToast } from '../shared'

const LIMITS = { archetypes: 32, cards: 200, mentions: 200, filters: 20 }
const KINDS = [
  { value: 'new', label: 'New archetype' },
  { value: 'setcode', label: 'Becomes a setcode' },
] as const

type Named = { id: number; name: string | null }
export type SeriesState = {
  name: string
  description: string
  kind: 'new' | 'setcode'
  archetype: { code: number; name: string | null } | null
  archetypes: { code: number; name: string | null; only: boolean }[]
  cards: (Named & { only: boolean })[]
  mentions: Named[]
  filters: { id: number; name: string }[]
  cover: Named | null
}

export const stateOf = (series?: Series): SeriesState => ({
  name: series?.name ?? '',
  description: series?.description ?? '',
  kind: series?.archetype ? 'setcode' : 'new',
  archetype: series?.archetype ?? null,
  archetypes: series?.archetypes ?? [],
  cards: series?.cards.map(({ id, name, only }) => ({ id, name, only })) ?? [],
  mentions: series?.mentions.map(({ id, name }) => ({ id, name })) ?? [],
  filters: series?.filters ?? [],
  cover: series?.cover ? { id: series.cover.id, name: series.cover.name } : null,
})

/** What the API accepts: every key the form owns, numbers and flags only. */
export const payloadOf = (state: SeriesState): SeriesInput => ({
  name: state.name.trim(),
  description: state.description.trim(),
  archetype: state.kind === 'setcode' ? (state.archetype?.code ?? null) : null,
  archetypes: state.archetypes.map(({ code, only }) => ({ code, only })),
  cards: state.cards.map(({ id, only }) => ({ id, only })),
  mentions: state.mentions.map((m) => m.id),
  filters: state.filters.map((f) => f.id),
  cover: state.cover?.id ?? null,
})

/** The tiles of the cover picker: the pinned card, the first mention, then a few of its cards. A card shows once. */
const coverPicks = (state: SeriesState): (Named & { note: string })[] => {
  const picks = new Map<number, Named & { note: string }>()
  const add = (card: Named, note: string) => picks.has(card.id) || picks.set(card.id, { id: card.id, name: card.name, note })
  if (state.cover) add(state.cover, 'Pinned')
  if (state.mentions[0]) add(state.mentions[0], 'First mention')
  for (const card of state.cards.slice(0, 3)) add(card, 'One of its cards')
  return [...picks.values()]
}

/** A child setcode and the cards that carry it. */
const SetcodeRow = ({ child, onOnly, onRemove }: { child: SeriesState['archetypes'][number]; onOnly: (only: boolean) => void; onRemove: () => void }) => {
  const cards = useResource(`setcode-cards:${child.code}`, (signal) => setcodeCards([child.code], signal))
  return (
    <tr>
      <td>
        <span className="who">
          <span className="col-s">
            <span className="nm">{child.name ?? 'Unnamed setcode'}</span>
            <span className="cap mono">{hex(child.code)}</span>
          </span>
          <span className="fx" style={{ gap: 4, flexWrap: 'nowrap', paddingLeft: 8 }}>
            {(cards.data ?? []).slice(0, 4).map((c) => (
              <CardThumb key={c.id} id={c.id} name={c.name} size={28} />
            ))}
          </span>
        </span>
      </td>
      <td className="r">{cards.data ? count(cards.data.length) : '—'}</td>
      <td>
        <span className="fx" style={{ gap: 10, flexWrap: 'nowrap' }}>
          <Switch checked={child.only} onChange={onOnly} label="Only as child" quiet />
          <span className="cap">{child.only ? 'Counts here only' : `Still names ${child.name ?? 'its own'} decks elsewhere`}</span>
        </span>
      </td>
      <td className="r">
        <button type="button" className="act dz" onClick={onRemove}>
          Remove
        </button>
      </td>
    </tr>
  )
}

/** The Series editor, new and edit: the form on the left, the cards it resolves to on the right. */
export const SeriesEditor = ({ series }: { series?: Series }) => {
  const router = useRouter()
  const toast = useToast()
  const [state, setState] = useState(() => stateOf(series))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<SeriesState>) => {
    setSaved(false)
    setState((s) => ({ ...s, ...patch }))
  }

  // "Add to Series" on a deck page lands here with ?card=ID: the card comes pre-added, unsaved.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('card'))
    if (!id) return
    searchCardArts(String(id), 1).then(([card]) => {
      if (card) setState((s) => (s.cards.some((c) => c.id === card.id) ? s : { ...s, cards: [...s.cards, { id: card.id, name: card.name, only: false }] }))
    }, () => undefined)
  }, [])

  const filters = useResource('filters', listFilters)
  const members = useResource(series ? `series-members:${series.id}:${series.updatedAt}` : null, (signal) => listSeriesMembers(series!.id, signal))
  const own = useResource(state.kind === 'setcode' && state.archetype ? `setcode-cards:${state.archetype.code}` : null, (signal) => setcodeCards([state.archetype!.code], signal))
  const kids = useResource(state.archetypes.length ? `setcode-cards:${state.archetypes.map((a) => a.code).join(',')}` : null, (signal) => setcodeCards(state.archetypes.map((a) => a.code), signal))

  const quoting = (members.data ?? []).filter((m) => m.via === 'mention')
  const filtered = (members.data ?? []).filter((m) => m.via === 'filter')
  const sources = [
    ...(state.kind === 'setcode' && state.archetype ? [{ label: `${state.archetype.name ?? hex(state.archetype.code)} setcode`, ids: (own.data ?? []).map((c) => c.id) }] : []),
    { label: 'Child setcodes', ids: state.archetypes.length ? (kids.data ?? []).map((c) => c.id) : [] },
    { label: 'Cards', ids: state.cards.map((c) => c.id) },
    { label: 'Mentions', ids: quoting.map((c) => c.id) },
    { label: 'Filters', ids: filtered.map((c) => c.id) },
  ]
  const total = new Set(sources.flatMap((s) => s.ids)).size
  const changedLists = series && (JSON.stringify(state.mentions.map((m) => m.id)) !== JSON.stringify(series.mentions.map((m) => m.id)) || JSON.stringify(state.filters.map((f) => f.id)) !== JSON.stringify(series.filters.map((f) => f.id)))

  const code = series ? series.code : null
  const full = { archetypes: state.archetypes.length >= LIMITS.archetypes, cards: state.cards.length >= LIMITS.cards, mentions: state.mentions.length >= LIMITS.mentions }
  const invalid = !state.name.trim() || (state.kind === 'setcode' && !state.archetype)

  const save = () => {
    setError(null)
    setSaving(true)
    const input = payloadOf(state)
    ;(series ? updateSeries(series.id, input) : createSeries(input)).then(
      (kept) => {
        setSaving(false)
        setSaved(true)
        toast({ tone: 'ok', title: `${kept.name} saved`, body: TWO_STEPS })
        if (series) setState(stateOf(kept))
        else router.replace(`/admin/series/${kept.id}`)
      },
      (e) => {
        setSaving(false)
        setError(panelErrorText(e))
      },
    )
  }

  const attachable = (filters.data ?? []).filter((f) => !state.filters.some((s) => s.id === f.id))

  return (
    <>
      <Head
        eyebrow={
          series ? (
            <>
              Series · <span className="mono">{hex(series.code)}</span> · Updated {dayLabel(series.updatedAt)}
            </>
          ) : (
            'Series · new'
          )
        }
        title={state.name.trim() || 'Untitled Series'}
        lead="The Series names the deck. Child setcodes, cards, mentions and filters only decide which cards count for it."
        end={
          <>
            {code !== null ? (
              <Button variant="secondary" size="mono" href={`/admin/decks/${code}`}>
                Open as identified deck
              </Button>
            ) : null}
            <Button variant="ghost" href="/admin/series">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || invalid}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save Series'}
            </Button>
          </>
        }
      />
      {error ? <Failure>{error}</Failure> : null}

      <div className="split">
        <div className="wide col" style={{ gap: 32 }}>
          <section className="cut notch c-md pnl">
            <div className="g2" style={{ gap: 16 }}>
              <label className="fld">
                <span className="lbl-sm">Name</span>
                <span className="cut inpw">
                  <input className="inp" value={state.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
                </span>
                <span className="cap">1 to 80 characters, unique.</span>
              </label>
              <div className="fld">
                <span className="lbl-sm">Kind</span>
                <Segmented label="Kind" options={KINDS} value={state.kind} onChange={(kind) => set({ kind })} />
                <span className="cap">A new archetype gets its own code. Becoming a setcode keeps that setcode&apos;s cards as members.</span>
              </div>
            </div>
            <div className="g2" style={{ gap: 16 }}>
              {state.kind === 'setcode' ? (
                <div className="fld">
                  <span className="lbl-sm">Becomes setcode</span>
                  {state.archetype ? (
                    <span className="cut inpw" style={{ padding: '6px 12px' }}>
                      <span className="col-s grow" style={{ gap: 0 }}>
                        <span className="t4" style={{ fontSize: 14 }}>
                          {state.archetype.name ?? 'Unnamed setcode'}
                        </span>
                        <span className="cap mono">
                          {hex(state.archetype.code)}
                          {own.data ? ` · ${count(own.data.length)} cards` : ''}
                        </span>
                      </span>
                      <button type="button" className="act" onClick={() => set({ archetype: null })}>
                        Change
                      </button>
                    </span>
                  ) : (
                    <Lookup label="The setcode this Series becomes" placeholder="Archetype name or code" search={findSetcodes} exclude={state.archetypes.map((a) => a.code)} onPick={(o) => set({ archetype: { code: Number(o.key), name: String(o.label) } })} />
                  )}
                </div>
              ) : null}
              <label className="fld">
                <span className="lbl-sm">Description</span>
                <span className="cut inpw">
                  <input className="inp" value={state.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} />
                </span>
              </label>
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="01" title="Child setcodes" note={`${state.archetypes.length} of ${LIMITS.archetypes}`} />
            <div className="cut f-gold c-xs" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="t4">What Only as child does</span>
              <span className="sm">
                On: the setcode or card is left out of every other calculation and scores for this Series alone. Off: it can still name other decks, but in a deck that holds this Series it scores for the Series only.
              </span>
            </div>
            {full.archetypes ? null : (
              <Lookup
                label="Add a child setcode"
                placeholder="Add a setcode: archetype name or code"
                search={findSetcodes}
                exclude={[...state.archetypes.map((a) => a.code), ...(state.archetype ? [state.archetype.code] : [])]}
                onPick={(o) => set({ archetypes: [...state.archetypes, { code: Number(o.key), name: String(o.label), only: true }] })}
              />
            )}
            <div className="tblbox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Setcode</th>
                    <th className="r">Cards</th>
                    <th>Only as child</th>
                    <th className="r">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {state.archetypes.map((child) => (
                    <SetcodeRow
                      key={child.code}
                      child={child}
                      onOnly={(only) => set({ archetypes: state.archetypes.map((a) => (a.code === child.code ? { ...a, only } : a)) })}
                      onRemove={() => set({ archetypes: state.archetypes.filter((a) => a.code !== child.code) })}
                    />
                  ))}
                  {state.archetypes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="dim">
                        No child setcode.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="02" title="Cards" note={`${state.cards.length} of ${LIMITS.cards}`} />
            {full.cards ? null : (
              <Lookup label="Add a card" placeholder="Add a card: name or passcode" search={findCards} exclude={state.cards.map((c) => c.id)} onPick={(o) => set({ cards: [...state.cards, { id: Number(o.key), name: String(o.label), only: false }] })} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {state.cards.map((card) => (
                <div key={card.id} className="well" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <CardThumb id={card.id} name={card.name} size={64} />
                  <div className="col grow" style={{ gap: 8 }}>
                    <div className="col-s">
                      <span className="t4" style={{ fontSize: 14 }}>
                        {card.name ?? `Card ${card.id}`}
                      </span>
                      <span className="cap mono">{card.id}</span>
                      <span className="cap">{card.only ? 'Counts here only' : 'Keeps its own archetypes elsewhere'}</span>
                    </div>
                    <Switch checked={card.only} onChange={(only) => set({ cards: state.cards.map((c) => (c.id === card.id ? { ...c, only } : c)) })} label="Only as child" quiet />
                    <button type="button" className="act dz" style={{ textAlign: 'left' }} onClick={() => set({ cards: state.cards.filter((c) => c.id !== card.id) })}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="03" title="Mentions" note={`${state.mentions.length} of ${LIMITS.mentions} · no Only as child`} />
            <p className="sm">Every card whose text quotes the name is a member. The quoted card itself is not, unless its own text names it.</p>
            {full.mentions ? null : (
              <Lookup label="Add a mention" placeholder="Add a mention: card name or passcode" search={findCards} exclude={state.mentions.map((m) => m.id)} onPick={(o) => set({ mentions: [...state.mentions, { id: Number(o.key), name: String(o.label) }] })} />
            )}
            {state.mentions.map((mention) => (
              <div key={mention.id} className="well" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <CardThumb id={mention.id} name={mention.name} size={64} />
                <div className="col-s" style={{ flex: '0 1 200px' }}>
                  <span className="t4" style={{ fontSize: 14 }}>
                    &quot;{mention.name ?? mention.id}&quot;
                  </span>
                  <span className="cap mono">{mention.id}</span>
                  <button type="button" className="act dz" style={{ paddingTop: 8, textAlign: 'left' }} onClick={() => set({ mentions: state.mentions.filter((m) => m.id !== mention.id) })}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {state.mentions.length ? (
              <div className="col" style={{ gap: 8 }}>
                <span className="lbl-sm">{series ? `Quoted by ${count(quoting.length)} cards${changedLists ? ' · as saved' : ''}` : 'The quoting cards are listed once the Series is saved'}</span>
                <div className="fx" style={{ gap: 4 }}>
                  {quoting.slice(0, 14).map((c) => (
                    <CardThumb key={c.id} id={c.id} name={c.name} size={28} />
                  ))}
                  {quoting.length > 14 ? (
                    <span className="mono mut" style={{ paddingLeft: 6 }}>
                      +{count(quoting.length - 14)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="04" title="Filters" note={`${state.filters.length} attached`} />
            <p className="sm">A filter widens the Series to every card it matches. It never names anything: the name stays {state.name.trim() || 'the Series’'}.</p>
            {state.filters.map((filter) => (
              <div key={filter.id} className="well fx-b">
                <div className="col-s">
                  <span className="t4">{filter.name}</span>
                  <span className="cap">{series?.filters.some((f) => f.id === filter.id) ? `${count(filtered.length)} cards from the attached filters, as saved` : 'Counts after you save'}</span>
                </div>
                <div className="fx" style={{ gap: 14 }}>
                  <Link className="act" href={`/admin/filters/${filter.id}`} target="_blank">
                    Open filter
                  </Link>
                  <button type="button" className="act dz" onClick={() => set({ filters: state.filters.filter((f) => f.id !== filter.id) })}>
                    Detach
                  </button>
                </div>
              </div>
            ))}
            <div className="fx">
              {attachable.length && state.filters.length < LIMITS.filters ? (
                <Select
                  label="Attach a filter"
                  value=""
                  options={[{ value: '', label: 'Pick a saved filter' }, ...attachable.map((f) => ({ value: String(f.id), label: f.name }))]}
                  onChange={(e) => {
                    const picked = attachable.find((f) => String(f.id) === e.target.value)
                    if (picked) set({ filters: [...state.filters, { id: picked.id, name: picked.name }] })
                  }}
                />
              ) : null}
              <Button variant="secondary" size="mono-md" href="/admin/filters/new">
                Build a filter
              </Button>
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="05" title="Cover" note="The art of this Series' decks as lead" />
            <div className="tiles" style={{ gap: 12 }}>
              {coverPicks(state).map((card) => (
                <button key={card.id} type="button" className="tile" onClick={() => set({ cover: { id: card.id, name: card.name } })} style={{ background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', width: 104 }}>
                  <CardThumb id={card.id} name={card.name} size={104} ring={state.cover?.id === card.id} plain />
                  <span className="nm">{card.name ?? card.id}</span>
                  <span className="cap">{card.note}</span>
                </button>
              ))}
              <div className="fld" style={{ flex: '1 1 220px', alignSelf: 'flex-end' }}>
                <span className="lbl-sm">Or any card</span>
                <Lookup label="Any card as the cover" placeholder="Card name or passcode" search={findCards} onPick={(o) => set({ cover: { id: Number(o.key), name: String(o.label) } })} />
                {state.cover ? (
                  <button type="button" className="act" style={{ textAlign: 'left' }} onClick={() => set({ cover: null })}>
                    Reset to automatic
                  </button>
                ) : null}
              </div>
            </div>
            <p className="cap">With no cover picked: the first mention, else the most included card of the first child setcode, else of the setcode it becomes, else the first card.</p>
          </section>

          <NextBuildNote />
        </div>

        <aside className="side cut notch c-md pnl" style={{ position: 'sticky', top: 24 }}>
          <div className="fx-b">
            <h2 className="t3">Cards in this Series</h2>
            <span className="fig-s">{count(total)}</span>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {sources.map((source) => (
              <div key={source.label} className="col" style={{ gap: 4 }}>
                <div className="fx-b">
                  <span className="sm ink">{source.label}</span>
                  <span className="mono">{count(source.ids.length)}</span>
                </div>
                <span className="bar">
                  <i style={{ width: `${total ? (source.ids.length / total) * 100 : 0}%` }} />
                </span>
              </div>
            ))}
          </div>
          <p className="cap">A card can come from more than one source, so the bars do not sum to the total. Mentions and filters are resolved by the server: they show the saved Series until the next save.</p>
          <hr className="hr" />
          <div className="fx" style={{ gap: 4 }}>
            <Cover card={state.cover?.id} size={32} />
            {[...new Set(sources.flatMap((s) => s.ids))].slice(0, 24).map((id) => (
              <CardThumb key={id} id={id} size={28} />
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}
