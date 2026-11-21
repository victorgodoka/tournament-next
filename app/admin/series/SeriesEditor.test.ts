import { describe, expect, it } from 'vitest'
import { toSeriesInput, type Series } from '@utils/panel'
import { payloadOf, stateOf } from './SeriesEditor'

const series: Series = {
  id: 3,
  code: 277,
  name: 'Adventure',
  description: 'Quest cards',
  archetype: { code: 277, name: 'Sky Striker' },
  archetypes: [{ code: 4, name: 'Blue-Eyes', only: false }],
  cards: [{ id: 14558127, name: 'Ash Blossom', kind: 'monster', only: true }],
  mentions: [{ id: 12345, name: 'Adventurer Token', kind: 'monster' }],
  filters: [{ id: 2, name: 'LIGHT Fiend' }],
  cover: { id: 46986414, name: 'Dark Magician', kind: 'monster' },
  updatedAt: '2026-11-02T12:00:00.000Z',
}

describe('Series editor payload', () => {
  it('maps a Series to the eight fields the API accepts, Only as child kept', () => {
    expect(toSeriesInput(series)).toEqual({
      name: 'Adventure',
      description: 'Quest cards',
      archetype: 277,
      archetypes: [{ code: 4, only: false }],
      cards: [{ id: 14558127, only: true }],
      mentions: [12345],
      filters: [2],
      cover: 46986414,
    })
  })

  it('sends an unchanged form as toSeriesInput', () => {
    expect(payloadOf(stateOf(series))).toEqual(toSeriesInput(series))
  })

  it('trims the name and sends a new Series empty', () => {
    expect(payloadOf({ ...stateOf(undefined), name: '  Hero  ' })).toEqual({ name: 'Hero', description: '', archetype: null, archetypes: [], cards: [], mentions: [], filters: [], cover: null })
  })

  it('drops the setcode when the kind goes back to a new archetype', () => {
    expect(payloadOf({ ...stateOf(series), kind: 'new' }).archetype).toBeNull()
  })
})
