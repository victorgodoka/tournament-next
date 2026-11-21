'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Icon } from '@ui/icon'
import { Lookup } from '@ui/lookup'
import { useResource } from '@hooks/index'
import { createFilter, EMPTY_RULES, panelErrorText, previewFilter, updateFilter, type CardFilter, type FilterCards, type FilterRange, type FilterRules } from '@utils/panel'
import { CardThumb, count, Failure, findCards, Head, NextBuildNote, Rail, TWO_STEPS, useToast } from '../shared'
import { ABILITIES, ATTRIBUTES, COMMON_RACES, FRAMES, hasRules, label, RACES, rulePills, SPELL_TRAP } from './rules'

type Card = FilterCards['cards'][number]
type View = 'all' | 'counting' | 'excluded'

const KINDS = [
  { value: 'any', label: 'Any' },
  { value: 'monster', label: 'Monster' },
  { value: 'spell', label: 'Spell' },
  { value: 'trap', label: 'Trap' },
] as const
const DECKS = [
  { value: 'any', label: 'Any' },
  { value: 'main', label: 'Main deck' },
  { value: 'extra', label: 'Extra deck' },
] as const
const TERM_MODE = [
  { value: 'every', label: 'Every term' },
  { value: 'any', label: 'Any term' },
] as const
const TERM_IN = [
  { value: 'both', label: 'Name and text' },
  { value: 'name', label: 'Name' },
  { value: 'text', label: 'Text' },
] as const

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
const picked = (list: string[], upper = false) => (list.length ? list.map((v) => label(v, upper)).join(', ') : null)
const rangeText = (r: FilterRange) => (r.min === null && r.max === null ? null : `${r.min ?? 'Any'}–${r.max ?? 'Any'}`)

/** A debounced copy of a value: the results follow the rules a moment after the last change. */
const useSettled = <T,>(value: T, ms = 350): T => {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

const RangeRow = ({ name, hint, value, onChange, disabled }: { name: string; hint: string; value: FilterRange; onChange: (next: FilterRange) => void; disabled: boolean }) => {
  const end = (side: 'min' | 'max', text: string) => {
    const number = text.trim() === '' ? null : Number(text)
    if (number === null || Number.isInteger(number)) onChange({ ...value, [side]: number })
  }
  return (
    <tr className={disabled ? 'off' : ''}>
      <td>
        <span className="col-s">
          <span className="nm">{name}</span>
          <span className="cap">{hint}</span>
        </span>
      </td>
      <td>
        <div className="fx" style={{ gap: 8, flexWrap: 'nowrap', maxWidth: 360 }}>
          {(['min', 'max'] as const).map((side) => (
            <span key={side} className="cut inpw grow" style={{ minHeight: 34 }}>
              <span className="lbl-sm">{side === 'min' ? 'From' : 'To'}</span>
              <input className="inp mono" inputMode="numeric" placeholder="Any" disabled={disabled} aria-label={`${name} ${side === 'min' ? 'from' : 'to'}`} value={value[side] ?? ''} onChange={(e) => end(side, e.target.value)} />
            </span>
          ))}
        </div>
      </td>
      <td className="r">{rangeText(value) ? <span className="cy">{rangeText(value)}</span> : <span className="mut">Any</span>}</td>
    </tr>
  )
}

const PillRow = ({ name, hint, values, value, onChange, disabled, upper, more }: { name: string; hint: string; values: string[]; value: string[]; onChange: (next: string[]) => void; disabled: boolean; upper?: boolean; more?: React.ReactNode }) => (
  <tr className={disabled ? 'off' : ''}>
    <td>
      <span className="col-s">
        <span className="nm">{name}</span>
        <span className="cap">{hint}</span>
      </span>
    </td>
    <td>
      <div className="fx" style={{ gap: 6 }}>
        {values.map((v) => (
          <button key={v} type="button" className={value.includes(v) ? 'pill on' : 'pill'} aria-pressed={value.includes(v)} disabled={disabled} style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => onChange(toggle(value, v))}>
            {label(v, upper)}
          </button>
        ))}
        {more}
      </div>
    </td>
    <td className="r">{picked(value, upper) ? <span className="cy">{picked(value, upper)}</span> : <span className="mut">{disabled ? '—' : 'Any'}</span>}</td>
  </tr>
)

/** The filter builder, new and edit. Rules on the left, what they resolve to on the right. */
export const FilterForm = ({ filter }: { filter?: CardFilter }) => {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState(filter?.name ?? '')
  const [description, setDescription] = useState(filter?.description ?? '')
  const [rules, setRules] = useState<FilterRules>(filter?.rules ?? EMPTY_RULES)
  const [excluded, setExcluded] = useState<number[]>(filter?.excluded ?? [])
  /** Names of the cards the form knows by id: mentions and excluded cards, for the pills and the tables. */
  const [known, setKnown] = useState<Map<number, string>>(new Map())
  const [draft, setDraft] = useState('')
  const [allRaces, setAllRaces] = useState(false)
  const [view, setView] = useState<View>('all')
  const [find, setFind] = useState('')
  const [pages, setPages] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<FilterRules>) => {
    setRules({ ...rules, ...patch })
    setPages(1)
  }
  const monster = rules.kind === null || rules.kind === 'monster'
  const spellTrap = rules.kind === null || rules.kind === 'spell' || rules.kind === 'trap'

  const settled = useSettled(JSON.stringify(rules))
  const result = useResource(`filter-preview:${settled}:${pages}`, async (signal) => {
    const body = { rules: JSON.parse(settled) as FilterRules, excluded: [] }
    // 60 a page from the API; a page of the builder is one request more
    const got: FilterCards[] = []
    for (let page = 0; page < pages; page++) got.push(await previewFilter(body, page * 60, signal))
    return { match: got[0]!.match, cards: got.flatMap((g) => g.cards) }
  })
  const found = result.data?.cards ?? []
  const out = new Set(excluded)
  const matchedOut = found.filter((c) => out.has(c.id)).length
  const match = result.data?.match ?? 0
  const needle = find.trim().toLowerCase()
  const shown = found.filter((c) => (view === 'all' || (view === 'excluded') === out.has(c.id)) && (!needle || c.name.toLowerCase().includes(needle)))
  const nameOf = (id: number) => known.get(id) ?? found.find((c) => c.id === id)?.name ?? `Card ${id}`

  const flip = (card: Card) => {
    setKnown(new Map(known).set(card.id, card.name))
    setExcluded(out.has(card.id) ? excluded.filter((id) => id !== card.id) : [...excluded, card.id])
  }

  const addTerm = () => {
    const term = draft.trim()
    if (term && !rules.terms.some((t) => t.toLowerCase() === term.toLowerCase())) set({ terms: [...rules.terms, term] })
    setDraft('')
  }

  const save = () => {
    const used = filter?.series ?? []
    if (used.length && !window.confirm(`Saving changes the members of ${used.map((s) => s.name).join(', ')}. Save the filter?`)) return
    setError(null)
    setSaving(true)
    const input = { name: name.trim(), description: description.trim(), rules, excluded }
    ;(filter ? updateFilter(filter.id, input) : createFilter(input)).then(
      (saved) => {
        setSaving(false)
        const used = saved.series.map((s) => s.name).join(', ')
        toast({ tone: 'ok', title: `${saved.name} saved`, body: used ? `The members of ${used} follow it. ${TWO_STEPS}` : 'Attach it from a Series for it to count.' })
        if (!filter) router.replace(`/admin/filters/${saved.id}`)
      },
      (e) => {
        setSaving(false)
        setError(panelErrorText(e))
      },
    )
  }

  const pills = rulePills(rules, known)
  const byKind = (kind: string) => found.filter((c) => c.kind === kind && !out.has(c.id)).length

  return (
    <>
      <Head
        eyebrow={filter ? `Filter · #${filter.id}` : 'Filter · new'}
        title={name.trim() || 'Untitled filter'}
        lead="A card search that a Series attaches. It widens the Series to every card it matches and never names anything."
        end={
          <>
            <Button variant="ghost" href="/admin/filters">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim() || !hasRules(rules)}>
              {saving ? 'Saving…' : 'Save filter'}
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
                  <input className="inp" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </span>
                <span className="cap">1 to 80 characters, unique.</span>
              </label>
              <label className="fld">
                <span className="lbl-sm">Description</span>
                <span className="cut inpw">
                  <input className="inp" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
                </span>
              </label>
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <div className="rail">
              <span className="n">01</span>
              <h2 className="t3">Card rules</h2>
              <i />
              <button type="button" className="act" onClick={() => set({ ...EMPTY_RULES, terms: rules.terms, termsMode: rules.termsMode, termsIn: rules.termsIn, mentions: rules.mentions })}>
                Clear every rule
              </button>
            </div>
            <p className="sm">A card must pass every rule that has something picked. Inside one rule, any picked value passes. A rule with nothing picked lets everything through.</p>
            <div className="tblbox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 190 }}>Rule</th>
                    <th>Values</th>
                    <th className="r" style={{ width: 130 }}>
                      Picked
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="grp">
                    <td colSpan={3}>
                      <span className="lbl-strong">Card</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="col-s">
                        <span className="nm">Card type</span>
                        <span className="cap">Decides which rules below apply</span>
                      </span>
                    </td>
                    <td>
                      <Segmented
                        label="Card type"
                        size="sm"
                        options={KINDS}
                        value={rules.kind ?? 'any'}
                        onChange={(kind) =>
                          // a rule of the other group would silently match nothing: drop it with the switch
                          set(
                            kind === 'any'
                              ? { kind: null }
                              : kind === 'monster'
                                ? { kind, spellTrapTypes: [] }
                                : { kind, attributes: [], races: [], frames: [], abilities: [], level: EMPTY_RULES.level, atk: EMPTY_RULES.atk, def: EMPTY_RULES.def },
                          )
                        }
                      />
                    </td>
                    <td className="r">{rules.kind ? <span className="cy">{label(rules.kind)}</span> : <span className="mut">Any</span>}</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="col-s">
                        <span className="nm">Deck</span>
                        <span className="cap">Where the card sits</span>
                      </span>
                    </td>
                    <td>
                      <Segmented label="Deck" size="sm" options={DECKS} value={rules.extraDeck === null ? 'any' : rules.extraDeck ? 'extra' : 'main'} onChange={(deck) => set({ extraDeck: deck === 'any' ? null : deck === 'extra' })} />
                    </td>
                    <td className="r">{rules.extraDeck === null ? <span className="mut">Any</span> : <span className="cy">{rules.extraDeck ? 'Extra deck' : 'Main deck'}</span>}</td>
                  </tr>
                  <tr className="grp">
                    <td colSpan={3}>
                      <span className="fx-b">
                        <span className="lbl-strong">Monster</span>
                        {monster ? null : <span className="lbl-sm">Off while the card type is {label(rules.kind!)}</span>}
                      </span>
                    </td>
                  </tr>
                  <PillRow name="Attribute" hint="Any of the picked" values={ATTRIBUTES} value={rules.attributes} onChange={(attributes) => set({ attributes })} disabled={!monster} upper />
                  <PillRow
                    name="Monster type"
                    hint="Any of the picked"
                    values={allRaces ? RACES : RACES.filter((r, i) => i < COMMON_RACES || rules.races.includes(r))}
                    value={rules.races}
                    onChange={(races) => set({ races })}
                    disabled={!monster}
                    more={
                      <button type="button" className="act" onClick={() => setAllRaces(!allRaces)}>
                        {allRaces ? 'Fewer types' : `All ${RACES.length} types`}
                      </button>
                    }
                  />
                  <PillRow name="Frame" hint="Any of the picked" values={FRAMES} value={rules.frames} onChange={(frames) => set({ frames })} disabled={!monster} />
                  <PillRow name="Ability" hint="Any of the picked" values={ABILITIES} value={rules.abilities} onChange={(abilities) => set({ abilities })} disabled={!monster} />
                  <tr className="grp">
                    <td colSpan={3}>
                      <span className="lbl-strong">Numbers</span>
                    </td>
                  </tr>
                  <RangeRow name="Level, Rank or Link" hint="0 to 13" value={rules.level} onChange={(level) => set({ level })} disabled={!monster} />
                  <RangeRow name="ATK" hint="? is -2" value={rules.atk} onChange={(atk) => set({ atk })} disabled={!monster} />
                  <RangeRow name="DEF" hint="Link monsters never match" value={rules.def} onChange={(def) => set({ def })} disabled={!monster} />
                  <tr className="grp">
                    <td colSpan={3}>
                      <span className="fx-b">
                        <span className="lbl-strong">Spell and Trap</span>
                        {spellTrap ? null : <span className="lbl-sm">Off while the card type is Monster</span>}
                      </span>
                    </td>
                  </tr>
                  <PillRow name="Kind" hint="Icon of the Spell or Trap" values={SPELL_TRAP} value={rules.spellTrapTypes} onChange={(spellTrapTypes) => set({ spellTrapTypes })} disabled={!spellTrap} />
                </tbody>
              </table>
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="02" title="Name or text contains" note={`${rules.terms.length} terms`} />
            <p className="sm">Add as many terms as you need. Each one becomes a pill; remove it to drop the term.</p>
            <div className="fx" style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
              <label className="fld grow">
                <span className="cut inpw">
                  <Icon name="search" size={16} />
                  <input className="inp" value={draft} maxLength={80} placeholder="Words in the card name or effect" aria-label="Term to add" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTerm()} />
                </span>
              </label>
              <Button variant="secondary" onClick={addTerm}>
                Add
              </Button>
            </div>
            <div className="fx" style={{ gap: 8 }}>
              {rules.terms.map((term) => (
                <span key={term} className="pill on" style={{ paddingRight: 4 }}>
                  <span>&quot;{term}&quot;</span>
                  <button type="button" aria-label={`Remove the term ${term}`} onClick={() => set({ terms: rules.terms.filter((t) => t !== term) })} style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, background: 'transparent', border: 0, color: 'var(--color-ink-dim)', cursor: 'pointer' }}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
              {rules.terms.length === 0 ? <span className="cap">No term yet: the text is not checked.</span> : null}
            </div>
            <div className="fx-b">
              <div className="fx">
                <span className="lbl-sm">A card needs</span>
                <Segmented label="Terms a card needs" size="sm" options={TERM_MODE} value={rules.termsMode} onChange={(termsMode) => set({ termsMode })} />
              </div>
              <div className="fx">
                <span className="lbl-sm">Look in</span>
                <Segmented label="Where to look" size="sm" options={TERM_IN} value={rules.termsIn} onChange={(termsIn) => set({ termsIn })} />
              </div>
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="03" title="Mentions" note={`${rules.mentions.length} cards`} />
            <p className="sm">Pick a card: only cards whose text quotes its name pass. The quoted card itself does not, unless its own text names it.</p>
            <Lookup
              label="Add a mention"
              placeholder="Add a mention: card name or passcode"
              search={findCards}
              exclude={rules.mentions}
              onPick={(option) => {
                setKnown(new Map(known).set(Number(option.key), String(option.label)))
                set({ mentions: [...rules.mentions, Number(option.key)] })
              }}
            />
            {rules.mentions.map((id) => (
              <div key={id} className="well" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <CardThumb id={id} name={nameOf(id)} size={64} />
                <div className="col-s" style={{ flex: '0 1 220px' }}>
                  <span className="t4" style={{ fontSize: 14 }}>
                    &quot;{nameOf(id)}&quot;
                  </span>
                  <span className="cap mono">{id}</span>
                  <button type="button" className="act dz" style={{ paddingTop: 8, textAlign: 'left' }} onClick={() => set({ mentions: rules.mentions.filter((m) => m !== id) })}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="04" title="Cards found" note="Click a card to exclude it or put it back" />
            <div className="fx-b">
              <Segmented
                label="Show"
                size="sm"
                options={[
                  { value: 'all', label: `All ${count(match)}` },
                  { value: 'counting', label: 'Counting' },
                  { value: 'excluded', label: 'Excluded' },
                ]}
                value={view}
                onChange={setView}
              />
              <label className="fld" style={{ flex: '0 1 280px' }}>
                <span className="cut inpw" style={{ minHeight: 32 }}>
                  <Icon name="search" size={16} />
                  <input className="inp" type="search" placeholder="Find in the results" aria-label="Find in the results" value={find} onChange={(e) => setFind(e.target.value)} />
                </span>
              </label>
            </div>
            {result.error ? <Failure title="Couldn't run the search">{panelErrorText(result.error)}</Failure> : null}
            {!hasRules(rules) ? <p className="sm">Pick a rule, add a term or a mention: a filter with nothing picked matches no card.</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
              {shown.map((card) => {
                const off = out.has(card.id)
                return (
                  <button key={card.id} type="button" aria-pressed={off} onClick={() => flip(card)} className="well" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', padding: 12, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                    <span className={`cd ${off ? 'x' : ''}`} style={{ width: '100%' }}>
                      <CardThumbFill id={card.id} />
                    </span>
                    <span className="t4" style={{ fontSize: 13, lineHeight: '16px' }}>
                      {card.name}
                    </span>
                    <span className="cap">{label(card.kind)}</span>
                    <span className={off ? 'lbl-sm rd' : 'lbl-sm cy'}>{off ? 'Excluded · put back' : 'Counts'}</span>
                  </button>
                )
              })}
            </div>
            <div className="fx-b">
              <span className="cap">
                {count(found.length)} of {count(match)} loaded.
              </span>
              {found.length < match ? (
                <Button variant="secondary" size="mono-md" onClick={() => setPages(pages + 1)}>
                  Load more
                </Button>
              ) : null}
            </div>
          </section>

          <section className="col" style={{ gap: 14 }}>
            <Rail n="05" title="Excluded by hand" note={`${excluded.length} cards`} />
            <div className="tblbox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Still matches</th>
                    <th className="r">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {excluded.map((id) => (
                    <tr key={id}>
                      <td>
                        <span className="who">
                          <CardThumb id={id} name={nameOf(id)} size={28} />
                          <span className="col-s">
                            <span className="nm">{nameOf(id)}</span>
                            <span className="cap mono">{id}</span>
                          </span>
                        </span>
                      </td>
                      <td className="dim">{found.some((c) => c.id === id) ? 'Yes' : found.length < match ? 'Not in the loaded results' : 'No longer matches the rules'}</td>
                      <td className="r">
                        <button type="button" className="act" onClick={() => setExcluded(excluded.filter((e) => e !== id))}>
                          Put back
                        </button>
                      </td>
                    </tr>
                  ))}
                  {excluded.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="dim">
                        No card excluded.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="cap">An excluded card stays out even when the rules still match it, and through card database updates.</p>
          </section>

          <NextBuildNote />
        </div>

        <aside className="side cut notch c-md pnl" style={{ position: 'sticky', top: 24 }}>
          <div className="fx-b">
            <h2 className="t3">This filter</h2>
            <span className="fig-s">{count(Math.max(0, match - matchedOut))}</span>
          </div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div>
              <span className="lbl-sm">Match</span>
              <span className="fig-s">{count(match)}</span>
            </div>
            <div>
              <span className="lbl-sm">Excluded</span>
              <span className="fig-s">{count(excluded.length)}</span>
            </div>
            <div>
              <span className="lbl-sm">Count</span>
              <span className="fig-s">{count(Math.max(0, match - matchedOut))}</span>
            </div>
          </div>
          <span className="lbl-sm">Reads as</span>
          <div className="fx" style={{ gap: 6 }}>
            {pills.map((pill, i) => (
              <span key={`${i}:${pill}`} className="pill on">
                {pill}
              </span>
            ))}
            {excluded.map((id) => (
              <span key={id} className="pill off">
                {nameOf(id)}
              </span>
            ))}
            {pills.length === 0 ? <span className="cap">Nothing picked yet.</span> : null}
          </div>
          <hr className="hr" />
          <span className="lbl-sm">Loaded results by card type</span>
          <div className="col" style={{ gap: 10 }}>
            {(['monster', 'spell', 'trap'] as const).map((kind) => (
              <div key={kind} className="col" style={{ gap: 4 }}>
                <div className="fx-b">
                  <span className="sm ink">{label(kind)}</span>
                  <span className="mono">{count(byKind(kind))}</span>
                </div>
                <span className="bar">
                  <i style={{ width: `${found.length ? (byKind(kind) / found.length) * 100 : 0}%` }} />
                </span>
              </div>
            ))}
          </div>
          <hr className="hr" />
          <span className="lbl-sm">Used by</span>
          {filter?.series.length ? (
            <div className="col-s">
              {filter.series.map((s) => (
                <Link key={s.id} className="lnk sm" href={`/admin/series/${s.id}`}>
                  {s.name}
                </Link>
              ))}
            </div>
          ) : (
            <span className="cap">No Series yet. Attach it from a Series&apos; editor.</span>
          )}
          <p className="cap">A card added to the database later joins when it matches.</p>
        </aside>
      </div>
    </>
  )
}

/** The card filling the tile's `.cd` box (the box owns the size and the grey state). */
const CardThumbFill = ({ id }: { id: number }) => (
  // eslint-disable-next-line @next/next/no-img-element -- a 140px tile in a grid of up to hundreds: the optimizer would mint a variant per card
  <img src={`https://ygopro.online/assets/card-images/common/${id}.jpg`} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
)
