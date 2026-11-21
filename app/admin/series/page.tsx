'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@ui/button'
import { FilterChip } from '@ui/chip'
import { Dialog } from '@ui/dialog'
import { Icon } from '@ui/icon'
import { useResource } from '@hooks/index'
import { dayLabel } from '@utils/format'
import { deleteSeries, listSeries, panelErrorText, type Series } from '@utils/panel'
import { CardThumb, Cover, Failure, Head, hex, TWO_STEPS, useToast } from '../shared'

type Only = 'all' | 'setcode' | 'new' | 'filter'

const FILTERS: Record<Only, (s: Series) => boolean> = {
  all: () => true,
  setcode: (s) => s.archetype !== null,
  new: (s) => s.archetype === null,
  filter: (s) => s.filters.length > 0,
}

const SeriesPage = () => {
  const series = useResource('series', listSeries)
  const [text, setText] = useState('')
  const [only, setOnly] = useState<Only>('all')
  const [deleting, setDeleting] = useState<Series | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const all = series.data ?? []
  const needle = text.trim().toLowerCase()
  const matches = (s: Series) =>
    !needle ||
    s.name.toLowerCase().includes(needle) ||
    String(s.code) === needle ||
    hex(s.code).toLowerCase() === needle ||
    [...s.cards, ...s.mentions].some((c) => (c.name ?? '').toLowerCase().includes(needle) || String(c.id) === needle)
  const inScope = all.filter(matches)
  const rows = inScope.filter(FILTERS[only])

  const remove = () => {
    if (!deleting) return
    const gone = deleting
    setBusy(true)
    deleteSeries(gone.id).then(
      () => {
        setBusy(false)
        setDeleting(null)
        toast({ tone: 'ok', title: `${gone.name} deleted`, body: `Its decks fall back to their other names. ${TWO_STEPS}` })
        series.reload()
      },
      (e) => {
        setBusy(false)
        setDeleting(null)
        toast({ tone: 'bad', title: `${gone.name} was not deleted`, body: panelErrorText(e) })
      },
    )
  }

  return (
    <>
      <Head
        eyebrow={`Decks · ${all.length} Series`}
        title="Series"
        lead="An archetype the card database does not have, or a setcode that gains cards. Built from child setcodes, single cards, mentions and filters."
        end={
          <>
            <Button variant="secondary" href="/admin/filters">
              Filters
            </Button>
            <Button href="/admin/series/new">New Series</Button>
          </>
        }
      />
      {series.error ? <Failure title="Couldn't read the list">{panelErrorText(series.error)}</Failure> : null}

      <section className="col" style={{ gap: 16 }}>
        <div className="fx-b">
          <label className="fld" style={{ flex: '1 1 280px', maxWidth: 420 }}>
            <span className="lbl-sm">Find a Series</span>
            <span className="cut inpw">
              <Icon name="search" size={16} />
              <input className="inp" type="search" placeholder="Name, setcode or a member card" value={text} onChange={(e) => setText(e.target.value)} />
            </span>
          </label>
          <div className="fx">
            {(
              [
                ['all', 'All'],
                ['setcode', 'Becomes a setcode'],
                ['new', 'New archetype'],
                ['filter', 'Uses a filter'],
              ] as [Only, string][]
            ).map(([key, label]) => (
              <FilterChip key={key} pressed={only === key} label={label} count={inScope.filter(FILTERS[key]).length} onClick={() => setOnly(key)} />
            ))}
          </div>
        </div>
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Series</th>
                <th>Kind</th>
                <th>Members</th>
                <th className="r">Setcodes</th>
                <th className="r">Cards</th>
                <th className="r">Mentions</th>
                <th className="r">Filters</th>
                <th className="r">Only as child</th>
                <th>Updated</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                // a card can be both picked and a mention: show it once
                const shown = [...new Map([...s.cards, ...s.mentions].map((c) => [c.id, c])).values()].slice(0, 4)
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="who">
                        <Cover card={s.cover?.id ?? s.mentions[0]?.id ?? s.cards[0]?.id} />
                        <span className="col-s">
                          <Link className="nm" href={`/admin/series/${s.id}`}>
                            {s.name}
                          </Link>
                          <span className="cap mono">{hex(s.code)}</span>
                        </span>
                      </span>
                    </td>
                    <td className="dim">{s.archetype ? `becomes ${s.archetype.name ?? hex(s.archetype.code)}` : 'new'}</td>
                    <td>
                      <span className="fx" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        {shown.map((c) => (
                          <CardThumb key={c.id} id={c.id} name={c.name} size={28} />
                        ))}
                        {shown.length === 0 ? <span className="mono mut">by setcode</span> : null}
                      </span>
                    </td>
                    <td className="r">{s.archetypes.length}</td>
                    <td className="r">{s.cards.length}</td>
                    <td className="r">{s.mentions.length}</td>
                    <td className="r">{s.filters.length}</td>
                    <td className="r">{s.archetypes.filter((a) => a.only).length + s.cards.filter((c) => c.only).length}</td>
                    <td className="dim">{dayLabel(s.updatedAt)}</td>
                    <td className="r">
                      <span className="fx" style={{ justifyContent: 'flex-end', gap: 14, flexWrap: 'nowrap' }}>
                        <Link className="act" href={`/admin/series/${s.id}`}>
                          Edit
                        </Link>
                        <button type="button" className="act dz" onClick={() => setDeleting(s)}>
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="dim">
                    {series.data ? (all.length ? 'No Series matches.' : 'No Series yet.') : 'Loading…'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'this Series'}?`}
        description="Its decks fall back to their other names on the next read, and in /statistics after the next build. This can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete Series'}
            </Button>
          </>
        }
      >
        {deleting ? (
          <p className="sm">
            {deleting.archetypes.length} child setcodes, {deleting.cards.length} cards, {deleting.mentions.length} mentions and {deleting.filters.length} filters stop counting for it. The filters themselves are kept.
          </p>
        ) : null}
      </Dialog>
    </>
  )
}

export default SeriesPage
