'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@ui/button'
import { Chip, FilterChip, type ChipTone } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { Select } from '@ui/field'
import { Icon } from '@ui/icon'
import { useResource } from '@hooks/index'
import { dayTime } from '@utils/format'
import { listDecks, panelErrorText, type IdentifiedDeck } from '@utils/panel'
import { getSeasons } from '@utils/statistics'
import { count, Cover, Failure, Head, hex, kindLabel, LowValueControl, passesLow, percent, ShareBar, useStored, type LowMode } from '../shared'

type Sort = 'lists' | 'wr' | 'cand' | 'name'
type Only = 'all' | 'review' | 'variations' | 'cover' | 'series' | 'ignored'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'lists', label: 'Lists' },
  { value: 'wr', label: 'Win rate' },
  { value: 'cand', label: 'Candidates' },
  { value: 'name', label: 'A–Z' },
]

const IGNORE: Record<string, { label: string; tone: ChipTone }> = {
  lead: { label: 'Ignored as lead', tone: 'amber' },
  secondary: { label: 'Ignored as secondary', tone: 'amber' },
  full: { label: 'Ignored fully', tone: 'negative' },
}

const PAGE = 100
const lists = (d: IdentifiedDeck) => (d.tcg?.lists ?? 0) + (d.genesys?.lists ?? 0)

const FILTERS: Record<Only, (d: IdentifiedDeck) => boolean> = {
  all: () => true,
  review: (d) => d.review,
  variations: (d) => d.variations.on > 0,
  cover: (d) => !d.cover?.pinned,
  series: (d) => d.kind !== 'setcode',
  ignored: (d) => d.ignore !== 'off',
}

const SORT: Record<Sort, (a: IdentifiedDeck, b: IdentifiedDeck) => number> = {
  lists: (a, b) => lists(b) - lists(a),
  wr: (a, b) => (b.tcg?.winRate ?? -1) - (a.tcg?.winRate ?? -1),
  cand: (a, b) => b.variations.candidates - a.variations.candidates || lists(b) - lists(a),
  name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
}

const DecksPage = () => {
  const router = useRouter()
  const [picked, setPicked] = useState<{ tcg?: number; genesys?: number }>({})
  const decks = useResource(`decks:${picked.tcg ?? ''}:${picked.genesys ?? ''}`, (signal) => listDecks(picked, signal))
  const seasons = useResource('statistics-seasons', () => getSeasons())
  const [text, setText] = useState('')
  const [only, setOnly] = useState<Only>('all')
  const [low, setLow] = useStored<LowMode>('decks.low', 'hide')
  const [cut, setCut] = useStored<number | null>('decks.cut', null)
  const [sort, setSort] = useStored<Sort>('decks.sort', 'lists')
  const [shown, setShown] = useState(PAGE)

  const data = decks.data
  const all = data?.decks ?? []
  // the cut-off defaults to the setting, in percent
  const cutOff = cut ?? (data ? data.lowValueShare * 100 : 2)
  const isLow = (d: IdentifiedDeck) => (d.tcg?.share ?? 0) * 100 < cutOff && (d.genesys?.share ?? 0) * 100 < cutOff
  const needle = text.trim().toLowerCase()
  const matches = (d: IdentifiedDeck) =>
    !needle || (d.name ?? '').toLowerCase().includes(needle) || String(d.code) === needle || hex(d.code).toLowerCase() === needle
  const inScope = all.filter((d) => matches(d) && passesLow(low, isLow(d)))
  const rows = inScope.filter(FILTERS[only]).sort(SORT[sort])
  const hidden = all.filter(matches).length - inScope.length
  const top = Math.max(0.0001, ...all.map((d) => d.tcg?.share ?? 0))
  const options = (format: 'TCG' | 'Genesys') => (seasons.data ?? []).filter((s) => s.ladder === (format === 'TCG' ? 'tcg' : 'genesys') && s.sweptThrough).map((s) => ({ value: String(s.id), label: s.label }))

  return (
    <>
      <Head
        eyebrow={`Decks · ${count(all.length)} identified${data?.builtAt ? ` · Built ${dayTime(data.builtAt)}` : ''}`}
        title="Identified decks"
        lead="Every archetype and Series the build found in ranked lists. Open one to pick its cover, approve its variations and decide where it counts."
        end={
          <>
            <Select label="TCG season" value={String(data?.seasons.tcg?.id ?? '')} options={options('TCG')} onChange={(e) => setPicked({ ...picked, tcg: Number(e.target.value) })} />
            <Select label="Genesys season" value={String(data?.seasons.genesys?.id ?? '')} options={options('Genesys')} onChange={(e) => setPicked({ ...picked, genesys: Number(e.target.value) })} />
          </>
        }
      />
      {decks.error ? <Failure title="Couldn't read the decks">{panelErrorText(decks.error)}</Failure> : null}

      <div className="stats">
        <div>
          <span className="lbl-sm">Identified</span>
          <span className="fig">{count(all.length)}</span>
          <span className="cap">Setcodes and Series with a list</span>
        </div>
        <div>
          <span className="lbl-sm">Needs review</span>
          <span className="fig gd">{count(all.filter((d) => d.review && d.ignore !== 'full').length)}</span>
          <span className="cap">A candidate to decide, or no cover</span>
        </div>
        <div>
          <span className="lbl-sm">Approved variations</span>
          <span className="fig">{count(all.reduce((n, d) => n + d.variations.on, 0))}</span>
          <span className="cap">Names of two or three</span>
        </div>
        <div>
          <span className="lbl-sm">Low value</span>
          <span className="fig">{count(all.filter(isLow).length)}</span>
          <span className="cap">Under {cutOff}% of lists in both ladders</span>
        </div>
        <div>
          <span className="lbl-sm">Ignored</span>
          <span className="fig">{count(all.filter((d) => d.ignore !== 'off').length)}</span>
          <span className="cap">As lead, as secondary or fully</span>
        </div>
      </div>

      <section className="col" style={{ gap: 16 }}>
        <div className="fx-b">
          <label className="fld" style={{ flex: '1 1 280px', maxWidth: 420 }}>
            <span className="lbl-sm">Find a deck</span>
            <span className="cut inpw">
              <Icon name="search" size={16} />
              <input className="inp" type="search" placeholder="Archetype, Series or setcode" value={text} onChange={(e) => setText(e.target.value)} />
            </span>
          </label>
          <div className="fx">
            <LowValueControl mode={low} onMode={setLow} cut={cutOff} onCut={setCut} />
            <div className="col-s">
              <span className="lbl-sm">Sort</span>
              <Segmented label="Sort" size="sm" options={SORTS} value={sort} onChange={setSort} />
            </div>
          </div>
        </div>
        <div className="fx">
          {(
            [
              ['all', 'All'],
              ['review', 'Needs review'],
              ['variations', 'Has variations'],
              ['cover', 'No cover'],
              ['series', 'Series'],
              ['ignored', 'Ignored'],
            ] as [Only, string][]
          ).map(([key, label]) => (
            <FilterChip key={key} pressed={only === key} label={label} count={inScope.filter(FILTERS[key]).length} onClick={() => setOnly(key)} />
          ))}
          <span className="cap">
            {count(rows.length)} shown{hidden > 0 ? ` · ${count(hidden)} ${low === 'only' ? 'not low value' : 'low value'} hidden` : ''}
          </span>
        </div>

        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Deck</th>
                <th>State</th>
                <th className="r">TCG lists</th>
                <th style={{ minWidth: 150 }}>TCG share</th>
                <th className="r">TCG win rate</th>
                <th className="r">Genesys lists</th>
                <th className="r">Genesys share</th>
                <th className="r">As secondary</th>
                <th>Variations</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((d) => (
                <tr key={d.code} className={`lnk-row ${d.ignore === 'full' ? 'off' : ''}`} onClick={() => router.push(`/admin/decks/${d.code}`)}>
                  <td>
                    <span className="who">
                      <Cover card={d.cover?.card} />
                      <span className="col-s">
                        <span className="nm">{d.name ?? 'Unnamed'}</span>
                        <span className="cap">
                          {kindLabel(d.kind)} · <span className="mono">{hex(d.code)}</span>
                        </span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="fx" style={{ gap: 6 }}>
                      {d.review && d.ignore !== 'full' ? <Chip tone="gold">Review</Chip> : null}
                      {d.cover?.pinned ? null : <Chip tone="neutral">No cover</Chip>}
                      {d.ignore !== 'off' ? <Chip tone={IGNORE[d.ignore]!.tone}>{IGNORE[d.ignore]!.label}</Chip> : null}
                    </span>
                  </td>
                  <td className="r ink">{count(d.tcg?.lists ?? 0)}</td>
                  <td>
                    <ShareBar rate={d.tcg?.share ?? 0} of={top} />
                  </td>
                  <td className="r">{percent(d.tcg?.winRate)}</td>
                  <td className="r">{count(d.genesys?.lists ?? 0)}</td>
                  <td className="r">{percent(d.genesys?.share ?? 0)}</td>
                  <td className="r">{count((d.tcg?.secondaryLists ?? 0) + (d.genesys?.secondaryLists ?? 0))}</td>
                  <td>
                    <span className="mono">
                      <span className="ink">{d.variations.on}</span> on<span className="mut"> · </span>
                      <span className={d.variations.candidates > 0 ? 'gd' : 'mut'}>{d.variations.candidates} candidates</span>
                    </span>
                  </td>
                  <td className="r">
                    <Link className="act" href={`/admin/decks/${d.code}`} onClick={(e) => e.stopPropagation()}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="dim">
                    {!data ? (decks.error ? 'Nothing to show.' : 'Loading…') : all.length === 0 ? 'No lists in this season yet. The numbers appear after the next build.' : 'No deck matches.'}{' '}
                    {data && all.length > 0 ? (
                      <button type="button" className="act" onClick={() => { setText(''); setOnly('all'); setLow('all') }}>
                        Clear filters
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="fx-b">
          <span className="cap">Lists are ranked decklists of the two seasons, one per deck per match. Share is of all named lists in that ladder.</span>
          {rows.length > shown ? (
            <Button variant="secondary" size="mono-md" onClick={() => setShown(shown + PAGE)}>
              Load more
            </Button>
          ) : null}
        </div>
      </section>
    </>
  )
}

export default DecksPage
