'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Lookup } from '@ui/lookup'
import { useResource } from '@hooks/index'
import {
  getDeck,
  panelErrorText,
  type DeckDetail,
  type DeckVersion,
} from '@utils/panel'
import { getSeasons } from '@utils/statistics'
import type { RankedLadderId } from '@utils/types'
import { CardThumb, count, Cover, Failure, findCards, hex, kindLabel, LowValueControl, NextBuildNote, passesLow, percent, points, Rail, ShareBar, useAction, useStored, useToast, type LowMode } from '../../shared'
import { writeCover } from '../covers'
import { Alongside } from './Alongside'

const LADDER: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }

const nameOf = (v: Pick<DeckVersion, 'codes' | 'names'>) => v.names.map((n, i) => n ?? hex(v.codes[i]!)).join(' / ')
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

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
  const [low, setLow] = useStored<LowMode>('deck.variations.low', 'all')
  const [cut, setCut] = useStored('deck.variations.cut', 2)

  /** Every write saves at once, says what it did, and the read reloads so the row shows what the server kept. */
  const { run, pending, busy } = useAction(deck.reload)
  const toast = useToast()

  const data: DeckDetail | undefined = deck.data
  const name = data?.name ?? hex(code)

  const pinCover = (card: number | null) => {
    if (!data) return
    const was = data.cover.pinned
    const write = (to: number | null) => writeCover(data, to)
    run('cover', write(card), {
      title: card === null ? `${name} is back to its automatic cover` : `Cover of ${name} pinned`,
      body: 'It shows on the next read of a deck label; /statistics may need its cache cleared on the job page.',
      undo: () => run('cover', write(was), { title: 'Cover put back' }),
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
  const versions = data.decks.filter((v) => v.codes.length > 1)
  const isLow = (v: DeckVersion) => v.codes.length > 1 && v.share * 100 < cut
  const visible = data.decks.filter((v) => passesLow(low, isLow(v)))
  const top = Math.max(0.0001, ...data.decks.map((v) => v.share))
  // the lead shows the cover it has here (pinned or picked); the other names, their cover as a lead
  const coverIn = (v: DeckVersion, i: number) => (v.codes[i] === code ? data.cover.card : v.covers[i])

  const row = (v: DeckVersion) => {
    const pure = v.codes.length === 1
    return (
      <tr key={v.key} className={isLow(v) ? 'low' : ''}>
        <td>
          <span className="who">
            {v.codes.map((c, i) => (
              <Cover key={c} size={32} card={coverIn(v, i)} />
            ))}
            <span className="col-s">
              <span className="nm">
                {nameOf(v)}
                {v.near ? (
                  <>
                    {' '}
                    <Chip tone="amber">Near the minimum</Chip>
                  </>
                ) : null}
              </span>
              <span className="cap">
                {pure ? 'The pure deck' : v.firstDay ? `Seen since ${day(v.firstDay)}` : 'No list in this season'}
                {v.seasonShare !== null && v.seasonLists !== null
                  ? ` · ${count(v.seasonLists)} lists, ${percent(v.seasonShare)} of the season (needs ${count(data.minLists)} and ${percent(data.versionShare)})`
                  : ''}
                {isLow(v) ? ' · low value' : ''}
              </span>
            </span>
          </span>
        </td>
        <td className="r ink">{count(v.lists)}</td>
        <td>
          <ShareBar rate={v.share} of={top} />
        </td>
        <td className="r">{v.duelists === null ? <span className="mut">—</span> : count(v.duelists)}</td>
        <td className="r">{percent(v.winRate)}</td>
        <td className={`r ${pure || v.vsPure === null ? 'mut' : v.vsPure >= 0 ? 'gn' : 'ls'}`}>{pure ? '—' : points(v.vsPure)}</td>
        <td className="r">{pure ? <span className="mut">—</span> : v.codes.slice(1).map((c) => (v.cards[String(c)] ?? 0).toFixed(1)).join(' · ')}</td>
        <td className="r">
          {pure ? null : (
            <span className="fx" style={{ justifyContent: 'flex-end', gap: 14, flexWrap: 'nowrap' }}>
              {v.codes.slice(1).map((c, i) => (
                <Link key={c} className="act" href={`/admin/decks/${c}${ladder === 'genesys' ? '?ladder=genesys' : ''}`}>
                  Open {v.names[i + 1] ?? hex(c)}
                </Link>
              ))}
            </span>
          )}
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
            <p className="sm">
              {versions.length > 0 ? `Leads ${versions.length} version${versions.length === 1 ? '' : 's'} besides the pure deck.` : 'Named alone: no version with it passed the minimum.'}
            </p>
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
              <span className="lbl-sm">How it is named</span>
              <p className="sm">
                The build names decks by itself: a version of up to three names is a deck when it reaches {percent(data.versionShare)} of a season&apos;s lists (and the
                floor of games); its lists otherwise count for the longest version above it, down to {name} alone.
              </p>
              <p className="cap">To shape it: make a card a staple, or group cards in a Series.</p>
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

      <section id="decks" className="col" style={{ gap: 16 }}>
        <Rail n="01" title="Decks" note={`Named by the build · a version from ${percent(data.versionShare)} of a season's lists`} />
        <p className="sm" style={{ maxWidth: 760 }}>
          The pure deck and every version {name} leads in this season, with the same numbers as /statistics. Nothing here is decided by hand.
        </p>
        <div className="fx-b">
          <span className="cap">
            {count(versions.length)} version{versions.length === 1 ? '' : 's'}
          </span>
          <LowValueControl mode={low} onMode={setLow} cut={cut} onCut={setCut} unit="% of its lists" />
        </div>
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Deck</th>
                <th className="r">Lists</th>
                <th style={{ minWidth: 150 }}>Of its lists</th>
                <th className="r">Duelists</th>
                <th className="r">Win rate</th>
                <th className="r">vs pure</th>
                <th className="r">Cards of the others</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row)}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="dim">
                    {data.decks.length === 0 ? `${name} leads no list in this season.` : 'No deck matches.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <span className="lbl-sm">Under the minimum</span>
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Set</th>
                <th className="r">Lists</th>
                <th className="r">Of the season</th>
                <th>Counted as</th>
              </tr>
            </thead>
            <tbody>
              {data.under.map((u) => (
                <tr key={u.codes.join('>')} className="low">
                  <td>
                    <span className="nm">{nameOf(u)}</span>
                  </td>
                  <td className="r">
                    {count(u.lists)} <span className="mut">of {count(data.minLists)}</span>
                  </td>
                  <td className="r">
                    {percent(u.seasonShare)} <span className="mut">of {percent(data.versionShare)}</span>
                  </td>
                  <td>{nameOf(u.countedAs)}</td>
                </tr>
              ))}
              {data.under.length === 0 ? (
                <tr>
                  <td colSpan={4} className="dim">
                    Nothing under the minimum: every set {name} leads is a version, or it is always played alone.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="col" style={{ gap: 16 }}>
        <Rail n="02" title={`Where ${name} is a secondary`} note="Versions another deck leads" />
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Deck</th>
                <th className="r">Lists</th>
                <th className="r">{name} cards</th>
                <th className="r">Win rate</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.secondaryIn.map((v) => (
                <tr key={v.key}>
                  <td>
                    <span className="who">
                      {v.codes.map((c, i) => (
                        <Cover key={c} size={32} card={v.covers[i]} />
                      ))}
                      <span className="nm">{nameOf(v)}</span>
                    </span>
                  </td>
                  <td className="r ink">{count(v.lists)}</td>
                  <td className="r">{(v.cards[String(code)] ?? 0).toFixed(1)}</td>
                  <td className="r">{percent(v.winRate)}</td>
                  <td className="r">
                    <Link className="act" href={`/admin/decks/${v.codes[0]}${ladder === 'genesys' ? '?ladder=genesys' : ''}`}>
                      Open {v.names[0] ?? hex(v.codes[0]!)}
                    </Link>
                  </td>
                </tr>
              ))}
              {data.secondaryIn.length === 0 ? (
                <tr>
                  <td colSpan={5} className="dim">
                    No version of another deck holds {name}.
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
          onStaple={(card, label) => toast({ tone: 'ok', title: `${label} is a staple now`, body: 'It leaves this table and stops naming decks after the next build.' })}
          onError={(message) => toast({ tone: 'bad', title: "That didn't go through", body: message })}
        />
      ) : null}
      <NextBuildNote />
    </>
  )
}

export default DeckPage
