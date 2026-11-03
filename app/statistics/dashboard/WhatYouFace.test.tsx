import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import type { DeckStat, Meta, Scope, Week } from '@utils/statistics'
import { WhatYouFace } from './WhatYouFace'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

const deck = (key: string, name: string | null, share: number) => ({ key, name, share, games: 500, players: 40 }) as DeckStat
const week = (key: string, n: number, share: number) => ({ key, week: n, firstDay: `2026-10-${12 + n * 7}`, games: 100, share, jump: 0, wrExpected: 0.5 }) as Week

const meta = {
  fit: { builtAt: '2026-11-01T19:42:00.000Z' },
  decks: [deck('1*', 'Snake-Eye', 0.3), deck('1', null, 0.2), deck('1>2', null, 0.1), deck('3*', 'Maliss', 0.25), deck('3', null, 0.25), deck('4*', 'Orcust', 0.05), deck('', null, 0.01)],
  weeks: [week('1', 1, 0.2), week('1', 2, 0.15), week('1>2', 1, 0.05), week('1>2', 2, 0.2), week('3', 1, 0.25), week('3', 2, 0.25)],
} as unknown as Meta

const scope: Scope = { ladder: 'tcg', window: 'season', band: 'all' }

const html = renderToStaticMarkup(
  <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
    <WhatYouFace meta={meta} scope={scope} />
  </NextIntlClientProvider>,
)
const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
/** The wide table's body rows (the header is the first). */
const rows = html.split('role="list"')[0]!.split('role="row"').slice(2)

describe('WhatYouFace', () => {
  it('lists families with a button for their versions, closed', () => {
    expect(text(rows[0]!)).toContain('Snake-Eye')
    expect(text(rows[0]!)).toContain('30.0%')
    expect(text(rows[0]!)).toContain('2 versions')
    expect(rows[0]).toContain('aria-expanded="false"')
    expect(text(rows[1]!)).toContain('Maliss')
    expect(text(rows[1]!)).not.toContain('versions')
  })

  it('leaves out the versions under the format’s minimum meta share', () => {
    const strict = { ...meta, fit: { ...meta.fit, tiers: { minShare: 0.15 } } } as unknown as Meta
    const out = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <WhatYouFace meta={strict} scope={scope} />
      </NextIntlClientProvider>,
    )
    // Snake-Eye: 1 at 20% stays, 1>2 at 10% goes
    expect(text(out.split('role="list"')[0]!.split('role="row"')[2]!)).toContain('1 version')
  })

  it('moves a family by its versions summed, week against week', () => {
    // Snake-Eye: 25% then 35%; Maliss flat
    expect(text(rows[0]!)).toContain('+10.0 pts')
    expect(text(rows[1]!)).toContain('±0.0 pts')
    const rising = text(html).split('Rising')[1]!.split('Falling')[0]!
    expect(rising).toContain('Snake-Eye')
  })

  it('links a family to its most played version, or to its own key without one', () => {
    expect(rows[0]).toContain('href="/statistics/archetypes/1?')
    expect(rows[1]).toContain('href="/statistics/archetypes/3?')
    expect(text(rows[2]!)).toContain('Orcust')
    expect(rows[2]).toContain('href="/statistics/archetypes/4*?')
  })
})
