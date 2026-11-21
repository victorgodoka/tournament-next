import { clearCover, getSeries, setCover, toSeriesInput, updateSeries } from '@utils/panel'

/** Pins (or clears, with `null`) the cover a deck shows as a lead: a setcode has its own route, a Series keeps it on the Series. */
export const writeCover = (deck: { code: number; seriesId: number | null }, card: number | null): Promise<unknown> => {
  if (deck.seriesId === null) return card === null ? clearCover(deck.code) : setCover(deck.code, card)
  const id = deck.seriesId
  return getSeries(id).then((series) => updateSeries(id, { ...toSeriesInput(series), cover: card }))
}
