import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { toSeriesInput, type Series } from '@utils/panel'
import { excludesOf, payloadOf, SeriesForm, stateOf } from './SeriesForm'

const series: Series = {
  id: 3,
  code: 277,
  name: 'Adventure',
  description: 'Quest cards',
  archetype: { code: 277, name: 'Sky Striker' },
  archetypes: [{ code: 4, name: 'Blue-Eyes' }],
  cards: [{ id: 14558127, name: 'Ash Blossom', kind: 'monster' }],
  mentions: [{ id: 12345, name: 'Adventurer Token', kind: 'monster' }],
  updatedAt: '2026-11-02T12:00:00.000Z',
}

describe('toSeriesInput', () => {
  it('maps objects to numbers and leaves code, id and updatedAt out', () => {
    expect(toSeriesInput(series)).toEqual({ name: 'Adventure', description: 'Quest cards', archetype: 277, archetypes: [4], cards: [14558127], mentions: [12345] })
    expect(toSeriesInput({ ...series, archetype: null }).archetype).toBeNull()
  })
})

describe('SeriesForm', () => {
  const html = renderToStaticMarkup(<SeriesForm series={series} saving={false} error={null} onSave={() => {}} onCancel={() => {}} />)

  it('shows the series as removable chips', () => {
    for (const text of ['Adventure', 'Quest cards', 'Sky Striker', 'Blue-Eyes', 'Ash Blossom', 'Adventurer Token']) expect(html).toContain(text)
    for (const name of ['Sky Striker', 'Blue-Eyes', 'Ash Blossom', 'Adventurer Token']) expect(html).toContain(`aria-label="Remove ${name}"`)
  })

  it('sends an unchanged form as toSeriesInput', () => {
    expect(payloadOf(stateOf(series))).toEqual(toSeriesInput(series))
  })

  it('trims the name and sends a new Series empty', () => {
    expect(payloadOf({ ...stateOf(undefined), name: '  Hero  ' })).toEqual({ name: 'Hero', description: '', archetype: null, archetypes: [], cards: [], mentions: [] })
  })

  it('keeps the setcode pickers from offering what the other holds', () => {
    const state = { ...stateOf(undefined), archetype: { id: 0x115, label: 'A' }, archetypes: [{ id: 0x200, label: 'B' }] }
    expect(excludesOf(state)).toEqual({ archetype: [0x200], archetypes: [0x200, 0x115] })
    expect(excludesOf(stateOf(undefined))).toEqual({ archetype: [], archetypes: [] })
  })

  it('passes the API error text to the alert', () => {
    const out = renderToStaticMarkup(<SeriesForm saving={false} error="name is already used" onSave={() => {}} onCancel={() => {}} />)
    expect(out).toContain('name is already used')
  })
})
