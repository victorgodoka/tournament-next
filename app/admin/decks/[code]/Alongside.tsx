'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import { Segmented } from '@ui/choice'
import { useResource } from '@hooks/index'
import { getDeckAlongside, panelErrorText, setStaple, type AlongsideStats, type AlongsideZone, type DeckDetail } from '@utils/panel'
import { CardThumb, count, Cover, Failure, hex, LowValueControl, passesLow, percent, points, Rail, ShareBar, useStored, type LowMode } from '../../shared'

type Show = 'all' | 'archetypes' | 'cards'
type Zone = 'all' | 'main' | 'extra' | 'side'

const SHOW: { value: Show; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'archetypes', label: 'Archetypes' },
  { value: 'cards', label: 'Cards' },
]
const ZONE: { value: Zone; label: string }[] = [
  { value: 'all', label: 'All zones' },
  { value: 'main', label: 'Main' },
  { value: 'extra', label: 'Extra' },
  { value: 'side', label: 'Side' },
]
const ZONES: { key: Exclude<Zone, 'all'>; label: string; note: string }[] = [
  { key: 'main', label: 'Main deck', note: 'What names a deck' },
  { key: 'extra', label: 'Extra deck', note: 'Counts for a name only when the main deck carries it too' },
  { key: 'side', label: 'Side deck', note: 'Never names a deck · shown for staple and tech decisions' },
]
const IGNORED = { lead: 'Ignored as lead', secondary: 'Ignored as secondary', full: 'Ignored fully' } as const
const VARIATION = { on: 'Variation on', candidate: 'Candidate', refused: 'Refused' } as const

const withText = (row: AlongsideStats) =>
  row.top.map((t) => `${t.code === null ? 'Pure' : (t.name ?? hex(t.code))} ${percent(row.lists ? t.lists / row.lists : null)}`).join(' · ') || '—'

/** The eight numeric cells every row shares. */
const Cells = ({ row, distinct, top }: { row: AlongsideStats; distinct: boolean; top: number }) => {
  const diff = row.winRateWith !== null && row.winRateWithout !== null ? row.winRateWith - row.winRateWithout : null
  return (
    <>
      <td>
        <ShareBar rate={row.share} of={top} />
      </td>
      <td className="r ink">{count(row.lists)}</td>
      <td className="r">{count(row.duelists)}</td>
      <td className="r">{row.copies.mean.toFixed(1)}</td>
      <td className="r">
        {row.copies.min}–{row.copies.max}
      </td>
      <td className={`r ${distinct ? '' : 'mut'}`}>{distinct && row.distinct !== null ? row.distinct.toFixed(1) : '—'}</td>
      <td className="r">{percent(row.winRateWith)}</td>
      <td className={`r ${diff === null ? '' : diff >= 0 ? 'gn' : 'ls'}`}>{points(diff)}</td>
      <td className="cap">{withText(row)}</td>
    </>
  )
}

/** Section 03: what the lists led by this deck also play, zone by zone, staples left out. */
export const Alongside = ({ lead, season, busy, onVariation, onStaple, onError }: { lead: DeckDetail; season: number; busy: boolean; onVariation: (code: number, label: string) => void; onStaple: (card: number, label: string) => void; onError: (message: string) => void }) => {
  const read = useResource(`alongside:${lead.code}:${season}`, (signal) => getDeckAlongside(lead.code, season, signal))
  const [show, setShow] = useStored<Show>('deck.alongside.show', 'all')
  const [zone, setZone] = useStored<Zone>('deck.alongside.zone', 'all')
  const [low, setLow] = useStored<LowMode>('deck.alongside.low', 'all')
  const [cut, setCut] = useStored('deck.alongside.cut', 2)
  const name = lead.name ?? hex(lead.code)
  const isLow = (row: AlongsideStats) => row.share * 100 < cut
  const keep = <T extends AlongsideStats>(rows: T[]) => rows.filter((row) => passesLow(low, isLow(row)))
  const all: AlongsideZone[] = read.data ? [read.data.main, read.data.extra, read.data.side] : []
  const top = Math.max(0.0001, ...all.flatMap((z) => [...z.archetypes, ...z.cards]).map((r) => r.share))

  return (
    <section className="col" style={{ gap: 16 }}>
      <Rail n="03" title="Played alongside" note={`Over the ${count(read.data?.lists ?? lead.summary?.lists)} lists led by ${name} · staples left out`} />
      <div className="fx-b">
        <div className="fx">
          <Segmented label="Show" size="sm" options={SHOW} value={show} onChange={setShow} />
          <Segmented label="Zone" size="sm" options={ZONE} value={zone} onChange={setZone} />
        </div>
        <div className="fx">
          <LowValueControl mode={low} onMode={setLow} cut={cut} onCut={setCut} unit="% of its lists" />
        </div>
      </div>
      {read.error ? <Failure title="Couldn't read what it is played with">{panelErrorText(read.error)}</Failure> : null}
      <div className="tblbox">
        <table className="tbl">
          <thead>
            <tr>
              <th>Archetype or card</th>
              <th style={{ minWidth: 160 }}>In lists</th>
              <th className="r">Lists</th>
              <th className="r">Duelists</th>
              <th className="r">Copies</th>
              <th className="r">Min–max</th>
              <th className="r">Distinct cards</th>
              <th className="r">Win rate with</th>
              <th className="r">vs without</th>
              <th>Mostly with</th>
              <th className="r">Action</th>
            </tr>
          </thead>
          <tbody>
            {!read.data && !read.error ? (
              <tr>
                <td colSpan={11} className="dim">
                  Loading…
                </td>
              </tr>
            ) : null}
            {ZONES.filter((z) => zone === 'all' || zone === z.key).map((z) => {
              const data = read.data?.[z.key]
              if (!data) return null
              const archetypes = show === 'cards' ? [] : keep(data.archetypes)
              const cards = show === 'archetypes' ? [] : keep(data.cards)
              return (
                <Fragment key={z.key}>
                  <tr className="grp">
                    <td colSpan={11}>
                      <span className="fx-b">
                        <span className="lbl-strong">{z.label}</span>
                        <span className="lbl-sm">
                          {z.key === 'main' ? `${archetypes.length} archetypes · ${cards.length} cards` : z.note}
                        </span>
                      </span>
                    </td>
                  </tr>
                  {archetypes.length ? (
                    <tr>
                      <td colSpan={11} className="lbl-sm" style={{ padding: '8px 14px' }}>
                        Archetypes and Series
                      </td>
                    </tr>
                  ) : null}
                  {archetypes.map((r) => (
                    <tr key={r.code} className={isLow(r) ? 'low' : ''}>
                      <td>
                        <span className="who">
                          <Cover size={32} card={r.cover?.card} />
                          <span className="col-s">
                            <Link className="nm" href={`/admin/decks/${r.code}`}>
                              {r.name ?? hex(r.code)}
                            </Link>
                            <span className="cap">{[r.variation ? VARIATION[r.variation] : null, r.ignore === 'off' ? null : IGNORED[r.ignore]].filter(Boolean).join(' · ') || 'Never a raw pair with it'}</span>
                          </span>
                        </span>
                      </td>
                      <Cells row={r} distinct top={top} />
                      <td className="r">
                        {z.key === 'side' ? null : r.variation ? (
                          <a className="act" href="#variations">
                            Open variation
                          </a>
                        ) : (
                          <button type="button" className="act" disabled={busy} onClick={() => onVariation(r.code, r.name ?? hex(r.code))}>
                            Make variation
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {cards.length ? (
                    <tr>
                      <td colSpan={11} className="lbl-sm" style={{ padding: '8px 14px' }}>
                        Cards with no archetype
                      </td>
                    </tr>
                  ) : null}
                  {cards.map((r) => (
                    <tr key={r.id} className={isLow(r) ? 'low' : ''}>
                      <td>
                        <span className="who">
                          <CardThumb id={r.id} name={r.name} size={28} />
                          <span className="col-s">
                            <span className="nm">{r.name ?? `Card ${r.id}`}</span>
                            <span className="cap mono">{r.id}</span>
                          </span>
                        </span>
                      </td>
                      <Cells row={r} distinct={false} top={top} />
                      <td className="r">
                        <span className="fx" style={{ justifyContent: 'flex-end', gap: 14, flexWrap: 'nowrap' }}>
                          {lead.seriesId !== null ? (
                            <Link className="act" href={`/admin/series/${lead.seriesId}?card=${r.id}`}>
                              Add to Series
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            className="act"
                            disabled={busy}
                            onClick={() =>
                              setStaple(r.id, true).then(
                                () => {
                                  onStaple(r.id, r.name ?? `Card ${r.id}`)
                                  read.reload()
                                },
                                (e) => onError(panelErrorText(e)),
                              )
                            }
                          >
                            Staple
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {archetypes.length + cards.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="dim">
                        Nothing here passes the filters.
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="cap">
        Copies is the mean over the lists that play it. Win rate with and without compare {name} lists that hold the row against those that don&apos;t, game 1 only. A row under the low value cut-off is dimmed. A card made a staple leaves this table after the next build.
      </p>
    </section>
  )
}
