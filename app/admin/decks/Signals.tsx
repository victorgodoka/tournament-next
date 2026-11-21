'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Segmented } from '@ui/choice'
import { useResource } from '@hooks/index'
import { getSeasonUnder, getVersionChanges, ignoreSetcode, panelErrorText, resetArchetypeStaples, setArchetypeStaples, unignoreSetcode, type DeckList, type VersionChange } from '@utils/panel'
import type { RankedLadderId } from '@utils/types'
import { count, Cover, Failure, hex, percent, Rail, RowAction, TWO_STEPS } from '../shared'

const label = (v: { codes: number[]; names: (string | null)[] }) => v.names.map((n, i) => n ?? hex(v.codes[i]!)).join(' / ')
type Run = (id: string, request: Promise<unknown>, done: { title: string; body?: string; undo?: () => void }) => void

/** Archetypes that join versions of many leads: likely a generic package. One action makes its cards staples. */
export const NoisePackages = ({ noise, run, pending }: { noise: DeckList['noise']; run: Run; pending: string | null }) => {
  const undo = (code: number, name: string) => run(`noise:${code}`, resetArchetypeStaples(code), { title: `${name} cards are back to the automatic detection`, body: TWO_STEPS })
  const unignore = (code: number, name: string) => run(`ignore:${code}`, unignoreSetcode(code), { title: `${name} names decks again`, body: TWO_STEPS })
  const ignore = (code: number, name: string) =>
    run(`ignore:${code}`, ignoreSetcode(code), {
      title: `${name} is ignored`,
      body: `It names nothing: not as a lead, not as a second name. Its cards stay as they are. ${TWO_STEPS}`,
      undo: () => unignore(code, name),
    })
  const stage = (code: number, name: string) =>
    run(`noise:${code}`, setArchetypeStaples(code), {
      title: `${name} cards are staples now`,
      body: `Cards you set by hand stay as they are. It stops joining deck names. ${TWO_STEPS}`,
      undo: () => undo(code, name),
    })
  return (
    <section className="col" style={{ gap: 16 }}>
      <Rail n="01" title="Looks like a generic package" note="Second name in versions of many leads" />
      <p className="sm" style={{ maxWidth: 760 }}>
        An engine joins the decks it belongs to; a package played everywhere joins the names of unrelated decks. Ignoring the setcode takes it out of every name; making its cards staples also takes them out of every count.
      </p>
      <div className="tblbox">
        <table className="tbl">
          <thead>
            <tr>
              <th>Archetype</th>
              <th className="r">Leads</th>
              <th className="r">Lists</th>
              <th className="r">Action</th>
            </tr>
          </thead>
          <tbody>
            {noise.map((n) => {
              const name = n.name ?? hex(n.code)
              return (
                <tr key={n.code}>
                  <td>
                    <span className="who">
                      <Cover size={32} card={n.cover?.card} />
                      <span className="col-s">
                        <Link className="nm" href={`/admin/decks/${n.code}`}>
                          {name}
                        </Link>
                        <span className="cap">
                          Second or third name in versions of {n.leads} different leads
                          {n.leadLists > 0 ? ` · leads ${count(n.leadLists)} lists itself` : ''}
                          {n.staged ? ' · staged as staples' : ''}
                          {n.ignored ? ' · ignored' : ''}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="r ink">{count(n.leads)}</td>
                  <td className="r">{count(n.lists)}</td>
                  <td className="r">
                    {n.canStaple ? (
                      <span className="fx" style={{ justifyContent: 'flex-end', gap: 14, flexWrap: 'nowrap' }}>
                        {n.ignored ? (
                          <RowAction id={`ignore:${n.code}`} pending={pending} label="Stop ignoring" doing="Saving…" onClick={() => unignore(n.code, name)} />
                        ) : (
                          <RowAction id={`ignore:${n.code}`} pending={pending} label="Ignore" doing="Saving…" onClick={() => ignore(n.code, name)} />
                        )}
                        {n.staged ? (
                          <RowAction id={`noise:${n.code}`} pending={pending} label="Undo the staples" doing="Undoing…" danger onClick={() => undo(n.code, name)} />
                        ) : (
                          <RowAction id={`noise:${n.code}`} pending={pending} label="Make its cards staples" doing="Saving…" onClick={() => stage(n.code, name)} />
                        )}
                      </span>
                    ) : (
                      <span className="cap">A Series: adjust it in its editor</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {noise.length === 0 ? (
              <tr>
                <td colSpan={4} className="dim">
                  No archetype joins the versions of five or more leads.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const ChangeList = ({ title, rows, empty }: { title: string; rows: VersionChange[]; empty: string }) => (
  <div className="col" style={{ gap: 8, flex: '1 1 280px' }}>
    <span className="lbl-sm">{title}</span>
    {rows.length ? (
      <ul className="col" style={{ gap: 4 }}>
        {rows.map((r) => (
          <li key={r.codes.join('>')} className="sm">
            <Link className="lnk" href={`/admin/decks/${r.codes[0]}`}>
              {label(r)}
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <span className="cap">{empty}</span>
    )}
  </div>
)

/** What started or stopped naming decks in the last week. */
export const NameChanges = () => {
  const changes = useResource('version-changes', (signal) => getVersionChanges(7, signal))
  return (
    <section className="col" style={{ gap: 16 }}>
      <Rail n="02" title="Name changes" note="Last 7 days · set by the build" />
      {changes.error ? <Failure title="Couldn't read the changes">{panelErrorText(changes.error)}</Failure> : null}
      {changes.data ? (
        <div className="fx" style={{ alignItems: 'flex-start', gap: 32 }}>
          <ChangeList title="New versions" rows={changes.data.added} empty="No new version this week." />
          <ChangeList title="No longer a version" rows={changes.data.removed} empty="No version dropped this week." />
        </div>
      ) : changes.error ? null : (
        <span className="cap">Loading…</span>
      )}
    </section>
  )
}

const LADDERS: { value: RankedLadderId; label: string }[] = [
  { value: 'tcg', label: 'TCG' },
  { value: 'genesys', label: 'Genesys' },
]

/** The season's sets under the minimum, any lead, closest first: what the version share is about to let in. */
export const ClosestToMinimum = ({ seasons }: { seasons: DeckList['seasons'] }) => {
  const [ladder, setLadder] = useState<RankedLadderId>('tcg')
  const season = seasons[ladder]
  const under = useResource(season ? `season-under:${season.id}` : null, (signal) => getSeasonUnder(season!.id, signal))
  const data = under.data
  return (
    <section className="col" style={{ gap: 16 }}>
      <Rail n="03" title="Closest to naming decks" note="Sets under the minimum, any lead" />
      <div className="fx-b">
        <p className="sm" style={{ maxWidth: 640 }}>
          {data ? `A set names decks from ${percent(data.versionShare)} of the season's lists and ${count(data.minLists)} lists.` : ' '} Tune it in Settings · Deck classification.
        </p>
        <Segmented label="Ladder" size="sm" options={LADDERS} value={ladder} onChange={setLadder} />
      </div>
      {under.error ? <Failure title="Couldn't read the sets">{panelErrorText(under.error)}</Failure> : null}
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
            {(data?.sets ?? []).slice(0, 15).map((u) => (
              <tr key={u.codes.join('>')}>
                <td>
                  <Link className="nm" href={`/admin/decks/${u.codes[0]}${ladder === 'genesys' ? '?ladder=genesys' : ''}`}>
                    {label(u)}
                  </Link>
                </td>
                <td className="r">
                  {count(u.lists)} <span className="mut">of {count(data!.minLists)}</span>
                </td>
                <td className="r">
                  {percent(u.seasonShare)} <span className="mut">of {percent(data!.versionShare)}</span>
                </td>
                <td>{label(u.countedAs)}</td>
              </tr>
            ))}
            {data && data.sets.length === 0 ? (
              <tr>
                <td colSpan={4} className="dim">
                  Nothing under the minimum in this season.
                </td>
              </tr>
            ) : null}
            {!season ? (
              <tr>
                <td colSpan={4} className="dim">
                  No {ladder === 'tcg' ? 'TCG' : 'Genesys'} season.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
