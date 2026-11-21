'use client'

import { useParams } from 'next/navigation'
import { useResource } from '@hooks/index'
import { getSeries, panelErrorText } from '@utils/panel'
import { Failure } from '../../shared'
import { SeriesEditor } from '../SeriesEditor'

const EditSeriesPage = () => {
  const id = Number(useParams<{ id: string }>().id)
  const series = useResource(`series:${id}`, (signal) => getSeries(id, signal))
  if (series.error) return <Failure title="Couldn't read the Series">{panelErrorText(series.error)}</Failure>
  return series.data ? <SeriesEditor key={series.data.id} series={series.data} /> : <p className="sm">Loading…</p>
}

export default EditSeriesPage
