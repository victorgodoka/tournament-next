import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import type { DeckStat, Meta, Scope, Week } from '@utils/statistics'
import { WhatYouFace } from './WhatYouFace'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

const deck = (key: string, name: string | null, share: number) => ({ key, name, share, games: 500, players: 40 }) as DeckStat
const week = (key: string, n: number, share: number) => ({ key, week: n, firstDay: `2026-10-${12 + n * 7}`, games: 100, share, jump: 0 }) as Week

const meta = {
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
const rows = html.split('role="row"').slice(1)

describe('WhatYouFace', () => {
  it('lists families with their builds folded under the row', () => {
    expect(text(rows[0]!)).toContain('Snake-Eye')
    expect(text(rows[0]!)).toContain('30.0%')
    expect(text(rows[0]!)).toContain('2 builds')
    expect(text(rows[1]!)).toContain('Maliss')
    expect(text(rows[1]!)).not.toContain('build')
    expect(rows[0]).toContain('<details')
  })

  it('moves by family, not by plain key', () => {
    const rising = text(html).split('Rising')[1]!.split('Falling')[0]!
    expect(rising).toContain('Snake-Eye')
    expect(rising).not.toMatch(/\b1\b/)
  })

  it('links a family to its most played build, or to its own key without one', () => {
    expect(rows[0]).toContain('href="/statistics/archetypes/1?')
    expect(rows[1]).toContain('href="/statistics/archetypes/3?')
    expect(text(rows[2]!)).toContain('Orcust')
    expect(rows[2]).toContain('href="/statistics/archetypes/4*?')
  })
})
