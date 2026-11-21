'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@ui/button'
import { Chip, FilterChip, type ChipTone } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { Lookup } from '@ui/lookup'
import { useResource } from '@hooks/index'
import {
  clearCover,
  getDeck,
  getSeries,
  panelErrorText,
  setCover,
  setIgnore,
  setVariation,
  setVariationCover,
  toSeriesInput,
  updateSeries,
  type DeckDetail,
  type DeckVariation,
  type IgnoreMode,
  type VariationState,
} from '@utils/panel'
import { getSeasons } from '@utils/statistics'
import type { RankedLadderId } from '@utils/types'
import { CardThumb, count, Cover, Failure, findCards, hex, kindLabel, LowValueControl, NextBuildNote, passesLow, percent, points, Rail, RowAction, ShareBar, TWO_STEPS, useAction, useStored, useToast, type LowMode } from '../../shared'
import { Alongside } from './Alongside'
import { ThirdName } from './ThirdName'

const IGNORE: { value: IgnoreMode | 'off'; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'lead', label: 'As lead' },
  { value: 'secondary', label: 'As secondary' },
  { value: 'full', label: 'Fully' },
]
const IGNORE_WORDS: Record<IgnoreMode | 'off', string> = {
  off: 'Counts as lead and secondary',
  lead: 'Ignored as lead',
  secondary: 'Ignored as secondary',
  full: 'Ignored fully',
}
const STATE: Record<VariationState, { label: string; tone: ChipTone }> = {
  on: { label: 'On', tone: 'positive' },
  candidate: { label: 'Candidate', tone: 'gold' },
  refused: { label: 'Refused', tone: 'negative' },
}
const LADDER: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }

type Show = 'all' | VariationState

/** The identity of a variation, as the API keys it. */
const setOfCodes = (codes: number[]) => [...codes].sort((a, b) => a - b).join(',')

const nameOf = (v: DeckVariation) => v.names.map((n, i) => n ?? hex(v.codes[i]!)).join(' / ')

const DeckPage = () => {
  const code = Number(useParams<{ code: string }>().code)
  const [ladder, setLadderState] = useState<RankedLadderId>('tcg')
  // the tab lives in the URL (?ladder=genesys); read after mount, written without a navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the query string only exists in the browser
    if (new URLSearchParams(window.location.search).get('ladder') === 'genesys') setLadderState('genesys')
  }, [])
  const setLadder = (next: RankedLadderId) => {
    setLadderState(next)
    window.history.replaceState(null, '', next === 'tcg' ? window.location.pathname : `${window.location.pathname}?ladder=${next}`)
  }

  const seasons = useResource('statistics-seasons', () => getSeasons())
  const open = (which: RankedLadderId) => (seasons.data ?? []).find((s) => s.ladder === which && s.endsAt === null) ?? (seasons.data ?? []).find((s) => s.ladder === which)
  const season = open(ladder)
  const deck = useResource(season ? `deck:${code}:${season.id}` : null, (signal) => getDeck(code, season!.id, signal))
  const [show, setShow] = useState<Show>('all')
  const [low, setLow] = useStored<LowMode>('deck.variations.low', 'all')
  const [cut, setCut] = useStored('deck.variations.cut', 2)
  const [third, setThird] = useState<DeckVariation | null>(null)
  const [covering, setCovering] = useState<string | null>(null)

  /** Every write saves at once, says what it did, and the read reloads so the row shows what the server kept. */
  const { run, pending, busy, flash } = useAction(deck.reload)
  const toast = useToast()

  const data: DeckDetail | undefined = deck.data
  const name = data?.name ?? hex(code)

  const pinCover = (card: number | null) => {
    if (!data) return
    const was = data.cover.pinned
    const write = (to: number | null): Promise<unknown> => {
      if (data.seriesId === null) return to === null ? clearCover(code) : setCover(code, to)
      const id = data.seriesId
      return getSeries(id).then((series) => updateSeries(id, { ...toSeriesInput(series), cover: to }))
    }
    run('cover', write(card), {
      title: card === null ? `${name} is back to its automatic cover` : `Cover of ${name} pinned`,
      body: 'It shows on the next read of a deck label; /statistics may need its cache cleared on the job page.',
      undo: () => run('cover', write(was), { title: 'Cover put back' }),
    })
  }

  /** A decision on a variation, with the words for it and the way back. */
  const decide = (v: DeckVariation, to: VariationState, id: string) => {
    const label = nameOf(v)
    const said: Record<VariationState, string> = { on: `${label} approved`, refused: `${label} refused`, candidate: v.state === 'on' ? `${label} turned off` : `${label} is a candidate again` }
    run(id, setVariation(v.codes, to), {
      title: said[to],
      body: to === 'on' ? `Its lists take the name ${label}. ${TWO_STEPS}` : v.state === 'on' ? `Its lists go back to ${name} alone. ${TWO_STEPS}` : undefined,
      flash: v.key,
      undo: () => run(id, setVariation(v.codes, v.state), { title: `${label} put back`, flash: v.key }),
    })
  }
  const coverIn = (v: DeckVariation, k: DeckVariation['covers'][number], card: number | null) => {
    const who = v.names[v.codes.indexOf(k.code)] ?? hex(k.code)
    run(`${v.key}:cover:${k.code}`, setVariationCover(v.codes, k.code, card), {
      title: card === null ? `${who} is back to its cover as lead here` : `Cover of ${who} changed in ${nameOf(v)}`,
      body: card === null ? undefined : `Only in this variation: the cover of ${who} as lead stays as it is.`,
      flash: v.key,
      undo: () => run(`${v.key}:cover:${k.code}`, setVariationCover(v.codes, k.code, k.custom ? k.card : null), { title: 'Cover put back', flash: v.key }),
    })
  }

  if (deck.error && !data) {
    return (
      <Failure title="Not a deck of this season">
        {panelErrorText(deck.error)}{' '}
        <Link className="lnk" href="/admin/decks">
          Back to Identified decks
        </Link>
      </Failure>
    )
  }
  if (!data) return <p className="sm">Loading…</p>

  const s = data.summary
  const variations = data.variations
  const candidates = variations.filter((v) => v.state === 'candidate').length
  const on = variations.filter((v) => v.state === 'on').length
  const isLow = (v: DeckVariation) => v.share * 100 < cut
  const visible = variations.filter((v) => (show === 'all' || v.state === show) && passesLow(low, isLow(v)))
  // a three-name row sits under its pair
  const pairs = visible.filter((v) => v.codes.length === 2)
  const triplesOf = (pair: DeckVariation) => visible.filter((v) => v.codes.length === 3 && pair.codes.every((c) => v.codes.includes(c)))
  const loose = visible.filter((v) => v.codes.length === 3 && !pairs.some((p) => p.codes.every((c) => v.codes.includes(c))))
  const top = Math.max(0.0001, ...variations.map((v) => v.share))

  const row = (v: DeckVariation, sub: boolean) => {
    const st = STATE[v.state]
    // low value dims what is still to decide; an approved variation exists, so it reads at full strength
    return (
      <tr key={v.key} className={`${sub ? 'sub' : ''} ${isLow(v) && v.state !== 'on' ? 'low' : ''} ${flash === v.key ? 'flash' : ''}`}>
        <td>
          <span className="who">
            {v.codes.map((c) => (
              <Cover key={c} size={32} card={c === code ? data.cover.card : v.covers.find((k) => k.code === c)?.card} />
            ))}
            <span className="col-s">
              <span className="nm">{nameOf(v)}</span>
              <span className="cap">
                {v.codes.length === 3 ? 'Three names · ' : ''}
                {v.decidedAt ? `${v.state === 'on' ? 'Approved' : 'Refused'} ${new Date(v.decidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : v.firstDay ? `Seen since ${new Date(v.firstDay).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : 'No list in this season'}
                {isLow(v) ? ' · low value' : ''}
              </span>
            </span>
          </span>
        </td>
        <td>
          <Chip tone={st.tone}>{st.label}</Chip>
        </td>
        <td className="r ink">{count(v.lists)}</td>
        <td>
          <ShareBar rate={v.share} of={top} gold={v.state === 'candidate'} />
        </td>
        <td className="r">{count(v.duelists)}</td>
        <td className="r">{percent(v.winRate)}</td>
        <td className={`r ${v.vsPure === null ? '' : v.vsPure >= 0 ? 'gn' : 'ls'}`}>{points(v.vsPure)}</td>
        <td className="r">{v.codes.slice(1).map((c) => (v.cards[String(c)] ?? 0).toFixed(1)).join(' · ')}</td>
        <td>
          <span className="col" style={{ gap: 6 }}>
            {v.covers.map((k) => {
              const slot = `${v.key}:${k.code}`
              return (
                <span key={k.code} className="who" style={{ gap: 8 }}>
                  {k.card ? <CardThumb id={k.card} size={28} /> : <Cover card={null} size={32} />}
                  <span className="col-s">
                    {/* the secondary as a lead of its own, in a new tab: this page keeps its place */}
                    <Link className="lnk" style={{ fontSize: 13, fontWeight: 700 }} href={`/admin/decks/${k.code}${ladder === 'genesys' ? '?ladder=genesys' : ''}`} target="_blank" title={`Open ${v.names[v.codes.indexOf(k.code)] ?? hex(k.code)} as a lead, in a new tab`}>
                      {v.names[v.codes.indexOf(k.code)] ?? hex(k.code)} ↗
                    </Link>
                    <span className="cap">
                      {k.custom ? 'Custom for this variation' : 'Fallback · its cover as lead'} ·{' '}
                      {v.state === 'candidate' ? (
                        'approve to change'
                      ) : (
                        <>
                          <button type="button" className="lnk act" onClick={() => setCovering(covering === slot ? null : slot)}>
                            Change
                          </button>
                          {k.custom ? (
                            <>
                              {' · '}
                              <RowAction id={`${v.key}:cover:${k.code}`} pending={pending} label="Reset" doing="Resetting…" onClick={() => coverIn(v, k, null)} />
                            </>
                          ) : null}
                        </>
                      )}
                    </span>
                    {covering === slot ? (
                      <Lookup
                        compact
                        label={`Cover of ${v.names[v.codes.indexOf(k.code)] ?? k.code} in this variation`}
                        placeholder="Card name or passcode"
                        search={findCards}
                        onPick={(option) => {
                          setCovering(null)
                          coverIn(v, k, Number(option.key))
                        }}
                      />
                    ) : null}
                  </span>
                </span>
              )
            })}
          </span>
        </td>
        <td className="r">
          <span className="fx" style={{ justifyContent: 'flex-end', gap: 14, flexWrap: 'nowrap' }}>
            {v.state === 'on' ? (
              <>
                {v.codes.length === 2 ? (
                  <button type="button" className="act" onClick={() => setThird(third?.key === v.key ? null : v)}>
                    Third name
                  </button>
                ) : null}
                <RowAction id={`${v.key}:off`} pending={pending} label="Turn off" doing="Turning off…" danger onClick={() => decide(v, 'candidate', `${v.key}:off`)} />
              </>
            ) : v.state === 'candidate' ? (
              <>
                <RowAction id={`${v.key}:on`} pending={pending} label="Approve" doing="Approving…" onClick={() => decide(v, 'on', `${v.key}:on`)} />
                <RowAction id={`${v.key}:refuse`} pending={pending} label="Refuse" doing="Refusing…" danger onClick={() => decide(v, 'refused', `${v.key}:refuse`)} />
              </>
            ) : (
              <RowAction id={`${v.key}:restore`} pending={pending} label="Restore" doing="Restoring…" onClick={() => decide(v, 'candidate', `${v.key}:restore`)} />
            )}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <>
      <section className="cut notch c-lg pnl" style={{ padding: 28 }}>
        <div className="split" style={{ gap: 28 }}>
          <div className={`col ${pending === 'cover' ? 'working' : ''}`} style={{ gap: 10, width: 176 }}>
            <Cover card={data.cover.card} size={176} />
            <span className="lbl-sm">Cover as lead</span>
            <span className="t4">{data.cover.pinned ? (data.cover.candidates.find((c) => c.card === data.cover.pinned)?.name ?? `Card ${data.cover.pinned}`) : 'Automatic'}</span>
            {data.cover.pinned ? (
              <button type="button" className="act" style={{ textAlign: 'left' }} disabled={busy} onClick={() => pinCover(null)}>
                Reset to automatic
              </button>
            ) : null}
          </div>
          <div className="wide col" style={{ gap: 14 }}>
            <span className="lbl eyebrow">
              {kindLabel(data.kind)} · <span className="mono">{hex(code)}</span>
            </span>
            <h1 className="t1">{name}</h1>
            <div className="fx" style={{ gap: 6 }}>
              {candidates > 0 ? <Chip tone="gold">{candidates} candidates to review</Chip> : null}
              {on > 0 ? <Chip tone="positive">{on} variations on</Chip> : null}
              <Chip tone={data.ignore === 'off' ? 'neutral' : data.ignore === 'full' ? 'negative' : 'amber'}>{IGNORE_WORDS[data.ignore]}</Chip>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <span className="lbl-sm">Pick the cover · most included cards first</span>
              <div className="tiles" style={{ gap: 12 }}>
                {data.cover.candidates.map((c) => (
                  <button key={c.card} type="button" className="tile" disabled={busy} onClick={() => pinCover(c.card)} style={{ background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', width: 92 }}>
                    <CardThumb id={c.card} name={c.name} size={64} ring={data.cover.pinned === c.card} plain />
                    <span className="nm">{c.name ?? c.card}</span>
                    <span className="cap">{percent(c.inclusion)} of lists</span>
                  </button>
                ))}
                <div className="fld" style={{ flex: '1 1 200px', alignSelf: 'flex-end' }}>
                  <span className="lbl-sm">Or any card</span>
                  <Lookup label="Any card as the cover" placeholder="Card name or passcode" search={findCards} onPick={(option) => pinCover(Number(option.key))} />
                </div>
              </div>
            </div>
          </div>
          <div className="side col" style={{ gap: 14, maxWidth: 360 }}>
            <div className="col" style={{ gap: 6 }}>
              <span className="lbl-sm">Ignore this archetype</span>
              <div className={pending === 'ignore' ? 'working' : undefined}>
                <Segmented
                  label="Ignore this archetype"
                  size="sm"
                  options={IGNORE}
                  value={data.ignore}
                  onChange={(mode) => {
                    const was = data.ignore
                    if (mode === was) return
                    run('ignore', setIgnore(code, mode), {
                      title: mode === 'off' ? `${name} counts as lead and secondary again` : `${name}: ${IGNORE_WORDS[mode].toLowerCase()}`,
                      body: TWO_STEPS,
                      undo: () => run('ignore', setIgnore(code, was), { title: `${name}: ${IGNORE_WORDS[was].toLowerCase()}` }),
                    })
                  }}
                />
              </div>
            </div>
            <div className="col" style={{ gap: 6 }}>
              <p className="sm">
                <b className="ink">As lead</b>: never names a deck first, still joins a variation.
              </p>
              <p className="sm">
                <b className="ink">As secondary</b>: leads its own decks, never the second or third name.
              </p>
              <p className="sm">
                <b className="ink">Fully</b>: its cards carry no name anywhere.
              </p>
              <p className="cap">Only {name}. Sub-families, child setcodes and other Series keep their own setting.</p>
            </div>
            {data.seriesId !== null ? (
              <div className="fx">
                <Button variant="secondary" size="mono" href={`/admin/series/${data.seriesId}`}>
                  Edit Series
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="col" style={{ gap: 0 }}>
        <div className="fx-b" style={{ borderBottom: '1px solid var(--color-line)' }}>
          <div className="fx" style={{ gap: 0 }} role="tablist" aria-label="Ladder">
            {(['tcg', 'genesys'] as const).map((which) => (
              <button
                key={which}
                type="button"
                role="tab"
                aria-selected={ladder === which}
                className={ladder === which ? 'lbl-strong' : 'lbl'}
                onClick={() => setLadder(which)}
                style={{ background: 'transparent', border: 0, borderBottom: `2px solid ${ladder === which ? `var(--color-ladder-${which})` : 'transparent'}`, padding: '14px 20px', cursor: 'pointer' }}
              >
                {LADDER[which]} · {open(which)?.label ?? 'no season'}
              </button>
            ))}
          </div>
          <span className="lbl-sm" style={{ padding: '0 4px' }}>
            Season to date
          </span>
        </div>
        {s ? (
          <div className="stats" style={{ borderTop: 0 }}>
            <div>
              <span className="lbl-sm">Lists as lead</span>
              <span className="fig">{count(s.lists)}</span>
              <span className="cap">
                {percent(s.share)} of {LADDER[ladder]} lists
              </span>
            </div>
            <div>
              <span className="lbl-sm">Duelists</span>
              <span className="fig">{count(s.duelists)}</span>
              <span className="cap">{s.duelists ? (s.lists / s.duelists).toFixed(1) : '—'} lists each</span>
            </div>
            <div>
              <span className="lbl-sm">Win rate</span>
              <span className="fig">{percent(s.winRate)}</span>
              <span className="cap">
                First {percent(s.firstWinRate)} · second {percent(s.secondWinRate)}
              </span>
            </div>
            <div>
              <span className="lbl-sm">Pure lists</span>
              <span className="fig">{percent(s.lists ? s.pureLists / s.lists : null)}</span>
              <span className="cap">No second archetype · {percent(s.pureWinRate)} win rate</span>
            </div>
            <div>
              <span className="lbl-sm">Named cards</span>
              <span className="fig">{s.named.mean.toFixed(1)}</span>
              <span className="cap">
                Mean per list · {s.named.min} to {s.named.max}
              </span>
            </div>
            <div>
              <span className="lbl-sm">As secondary</span>
              <span className="fig">{count(s.secondaryLists)}</span>
              <span className="cap">Lists led by another deck</span>
            </div>
          </div>
        ) : (
          <p className="sm" style={{ padding: '16px 0' }}>
            {name} leads no {LADDER[ladder]} list in this season.
          </p>
        )}
      </div>

      <section id="variations" className="col" style={{ gap: 16 }}>
        <Rail n="01" title="Variations" note="Up to three names · only what is on exists" />
        <p className="sm" style={{ maxWidth: 760 }}>
          A list led by {name} is named {name} alone unless a variation below is on. Candidates are pairs the build saw together; approving one names those lists from the next read, and /statistics after the next build.
        </p>
        <div className="fx-b">
          <div className="fx">
            {(['all', 'on', 'candidate', 'refused'] as Show[]).map((key) => (
              <FilterChip
                key={key}
                pressed={show === key}
                label={key === 'all' ? 'All' : key === 'candidate' ? 'Candidates' : STATE[key].label}
                count={variations.filter((v) => key === 'all' || v.state === key).length}
                onClick={() => setShow(key)}
              />
            ))}
          </div>
          <div className="fx">
            <LowValueControl mode={low} onMode={setLow} cut={cut} onCut={setCut} unit="% of its lists" />
          </div>
        </div>
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Variation</th>
                <th>State</th>
                <th className="r">Lists</th>
                <th style={{ minWidth: 150 }}>Of its lists</th>
                <th className="r">Duelists</th>
                <th className="r">Win rate</th>
                <th className="r">vs pure</th>
                <th className="r">Cards of 2nd</th>
                <th>Cover of the secondary, here</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {s ? (
                <tr>
                  <td>
                    <span className="who">
                      <Cover size={32} card={data.cover.card} />
                      <span className="col-s">
                        <span className="nm">{name}</span>
                        <span className="cap">The pure deck</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Chip tone="neutral">Always</Chip>
                  </td>
                  <td className="r ink">{count(s.pureLists)}</td>
                  <td>
                    <ShareBar rate={s.lists ? s.pureLists / s.lists : 0} />
                  </td>
                  <td className="r mut">—</td>
                  <td className="r">{percent(s.pureWinRate)}</td>
                  <td className="r mut">—</td>
                  <td className="r mut">—</td>
                  <td />
                  <td />
                </tr>
              ) : null}
              {pairs.flatMap((pair) => [row(pair, false), ...triplesOf(pair).map((t) => row(t, true))])}
              {loose.map((t) => row(t, true))}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={10} className="dim">
                    {variations.length === 0 ? 'The build has not seen this deck with another archetype yet.' : 'No variation matches.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {third && season ? (
          <ThirdName
            lead={data}
            pair={third}
            season={season.id}
            busy={busy}
            onAdd={(codes, label) =>
              run(`third:${codes.join(',')}`, setVariation(codes, 'on'), {
                title: `${nameOf(third)} / ${label} approved`,
                body: `Lists with the three take the name. ${TWO_STEPS}`,
                undo: () => run(`third:${codes.join(',')}`, setVariation(codes, 'candidate'), { title: 'Third name taken back' }),
              })
            }
          />
        ) : null}
      </section>

      <section className="col" style={{ gap: 16 }}>
        <Rail n="02" title={`Where ${name} is the secondary`} note="Set on the lead deck" />
        <p className="sm" style={{ maxWidth: 760 }}>
          Each lead picks the cover {name} takes inside its variation. With none picked, the cover as lead above is the fallback, and changing one there never touches it.
        </p>
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Variation</th>
                <th className="r">Lists</th>
                <th className="r">{name} cards</th>
                <th className="r">Win rate</th>
                <th>Cover of {name}, there</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.secondaryIn.map((v) => {
                const mine = v.covers.find((k) => k.code === code)
                return (
                  <tr key={v.key}>
                    <td>
                      <span className="who">
                        {v.codes.map((c) => (
                          <Cover key={c} size={32} card={c === code ? (mine?.card ?? data.cover.card) : v.covers.find((k) => k.code === c)?.card} />
                        ))}
                        <span className="col-s">
                          <span className="nm">{nameOf(v)}</span>
                          <span className="cap">
                            {STATE[v.state].label} on {v.names[0] ?? hex(v.codes[0]!)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="r ink">{count(v.lists)}</td>
                    <td className="r">{(v.cards[String(code)] ?? 0).toFixed(1)}</td>
                    <td className="r">{percent(v.winRate)}</td>
                    <td>
                      <span className="who" style={{ gap: 8 }}>
                        {mine?.card ? <CardThumb id={mine.card} size={28} /> : <Cover card={null} size={32} />}
                        <span className="cap">{mine?.custom ? 'Custom for this variation' : 'Fallback · the cover as lead'}</span>
                      </span>
                    </td>
                    <td className="r">
                      <Link className="act" href={`/admin/decks/${v.codes[0]}${ladder === 'genesys' ? '?ladder=genesys' : ''}`}>
                        Open {v.names[0] ?? hex(v.codes[0]!)}
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {data.secondaryIn.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dim">
                    No other deck holds {name} as a second or third name.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {s && season ? (
        <Alongside
          lead={data}
          season={season.id}
          busy={busy}
          onVariation={(other, label) =>
            run(`make:${other}`, setVariation([code, other], 'on'), {
              title: `${name} / ${label} approved`,
              body: `Its lists take that name. ${TWO_STEPS}`,
              flash: setOfCodes([code, other]),
              undo: () => run(`make:${other}`, setVariation([code, other], 'candidate'), { title: `${name} / ${label} taken back` }),
            })
          }
          onStaple={(card, label) => toast({ tone: 'ok', title: `${label} is a staple now`, body: 'It leaves this table and stops naming decks after the next build.' })}
          onError={(message) => toast({ tone: 'bad', title: "That didn't go through", body: message })}
        />
      ) : null}
      <NextBuildNote />
    </>
  )
}

export default DeckPage
