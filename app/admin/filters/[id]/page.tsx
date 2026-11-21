'use client'

import { useParams } from 'next/navigation'
import { useResource } from '@hooks/index'
import { getFilter, panelErrorText } from '@utils/panel'
import { Failure } from '../../shared'
import { FilterForm } from '../FilterForm'

const EditFilterPage = () => {
  const id = Number(useParams<{ id: string }>().id)
  const filter = useResource(`filter:${id}`, (signal) => getFilter(id, signal))
  if (filter.error) return <Failure title="Couldn't read the filter">{panelErrorText(filter.error)}</Failure>
  // keyed by the save, so the form starts from what the server kept
  return filter.data ? <FilterForm key={filter.data.updatedAt} filter={filter.data} /> : <p className="sm">Loading…</p>
}

export default EditFilterPage
