'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@ui/button'
import { useResource } from '@hooks/index'
import { dayLabel } from '@utils/format'
import { deleteFilter, listFilterCards, listFilters, panelErrorText, type CardFilter } from '@utils/panel'
import { CardThumb, count, Failure, Head, useToast } from '../shared'
import { rulePills } from './rules'

const STRIP = 10

/** One saved filter: its count, its rules as pills and a strip of what it matches. */
const FilterCard = ({ filter, onDelete, busy }: { filter: CardFilter; onDelete: () => void; busy: boolean }) => {
  const cards = useResource(`filter-cards:${filter.id}:${filter.updatedAt}`, (signal) => listFilterCards(filter.id, 0, signal))
  const counting = (cards.data?.cards ?? []).filter((c) => !c.excluded)
  const used = filter.series.length > 0
  return (
    <article className="cut notch c-md pnl" style={{ gap: 14 }}>
      <div className="fx-b" style={{ alignItems: 'flex-start' }}>
        <div className="col-s">
          <h2 className="t3">{filter.name}</h2>
          <span className="cap">Updated {dayLabel(filter.updatedAt)}</span>
        </div>
        <span className="fig-s">{cards.data ? count(cards.data.count) : '—'}</span>
      </div>
      <div className="fx" style={{ gap: 6 }}>
        {rulePills(filter.rules).map((pill, i) => (
          <span key={`${i}:${pill}`} className="pill on">
            {pill}
          </span>
        ))}
      </div>
      <div className="fx" style={{ gap: 4 }}>
        {counting.slice(0, STRIP).map((c) => (
          <CardThumb key={c.id} id={c.id} name={c.name} size={28} />
        ))}
        {cards.data && cards.data.count > STRIP ? (
          <span className="mono mut" style={{ paddingLeft: 6 }}>
            +{count(cards.data.count - STRIP)}
          </span>
        ) : null}
      </div>
      <hr className="hr" />
      <div className="fx-b">
        <span className="cap">
          {cards.data ? `${count(cards.data.match)} match · ${count(cards.data.excluded)} excluded · ` : ''}
          {used ? `Used by ${filter.series.map((s) => s.name).join(', ')}` : 'Not used yet'}
        </span>
        <span className="fx" style={{ gap: 14 }}>
          <Link className="act" href={`/admin/filters/${filter.id}`}>
            Edit
          </Link>
          <button type="button" className="act dz" disabled={busy || used} title={used ? `Detach it from ${filter.series.map((s) => s.name).join(', ')} first` : undefined} onClick={onDelete}>
            Delete
          </button>
        </span>
      </div>
    </article>
  )
}

const FiltersPage = () => {
  const filters = useResource('filters', listFilters)
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const remove = (filter: CardFilter) => {
    if (!window.confirm(`Delete the filter "${filter.name}"? This can't be undone.`)) return
    setBusy(true)
    deleteFilter(filter.id).then(
      () => {
        setBusy(false)
        toast({ tone: 'ok', title: `${filter.name} deleted` })
        filters.reload()
      },
      (e) => {
        setBusy(false)
        toast({ tone: 'bad', title: `${filter.name} was not deleted`, body: panelErrorText(e) })
      },
    )
  }

  return (
    <>
      <Head
        eyebrow={`Decks · ${filters.data?.length ?? 0} filters`}
        title="Filters"
        lead="A saved card search a Series can attach. Every card it matches counts for that Series, minus the cards excluded by hand. A filter never names a deck."
        end={<Button href="/admin/filters/new">New filter</Button>}
      />
      {filters.error ? <Failure title="Couldn't read the filters">{panelErrorText(filters.error)}</Failure> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {(filters.data ?? []).map((filter) => (
          <FilterCard key={filter.id} filter={filter} busy={busy} onDelete={() => remove(filter)} />
        ))}
      </div>
      {filters.data?.length === 0 ? <p className="sm">No filter yet. Build the first one to widen a Series to every card it matches.</p> : null}
      <p className="cap">A filter is read again with every card database update, so a new card that matches joins by itself. A filter used by a Series can&apos;t be deleted.</p>
    </>
  )
}

export default FiltersPage
