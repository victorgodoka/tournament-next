import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import type { DeckStat, Meta, Scope } from '@utils/statistics'
import { BestLine, WhatToPlay } from './WhatToPlay'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

const deck = (key: string, name: string, wrExpected: number, tier: DeckStat['tier'], share = 0.1) =>
  ({ key, name, wrExpected, wrLo: wrExpected - 0.01, wrHi: wrExpected + 0.01, tier, share, games: 500, players: 40 }) as DeckStat

const meta = (window: Meta['window'], sweptThrough: string) =>
  ({
    window,
    season: { startsAt: '2026-10-19T03:00:00.000Z', sweptThrough },
    fit: { games: 1234, firstEffect: 0.118 },
    decks: [deck('1', 'Low', 0.48, null), deck('2', 'High', 0.56, 1), deck('2*', 'High', 0.57, 1), deck('', 'Unknown', 0.6, null), deck('3', 'Mid', 0.52, 3)],
    weeks: [{ firstDay: '2026-10-19' }],
  }) as unknown as Meta

const scope: Scope = { ladder: 'tcg', window: 'season', band: 'all' }

const render = (data: Meta, callout?: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <WhatToPlay meta={data} scope={scope} callout={callout} />
    </NextIntlClientProvider>,
  )
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('WhatToPlay', () => {
  it('sorts by the expected rate and leaves out lead rows and the unknown deck', () => {
    const out = text(render(meta('season', '2026-10-31')))
    expect(out.indexOf('High')).toBeLessThan(out.indexOf('Mid'))
    expect(out.indexOf('Mid')).toBeLessThan(out.indexOf('Low'))
    expect(out).not.toContain('Unknown')
    expect(out.match(/High/g)).toHaveLength(1)
  })

  it('shows a deck under the floors without a badge', () => {
    const out = text(render(meta('season', '2026-10-31')))
    expect(out).toContain('Low')
    expect(out).toContain('T1')
    expect(out).not.toContain('Tnull')
  })

  it('says how many games and days the window really has', () => {
    const out = text(render(meta('last7', '2026-10-20')))
    expect(out).toContain('1,234 games over 2 days')
    expect(out).toContain('Going first is worth +2.9 points in game 1')
  })

  it('names the best deck against the most played', () => {
    expect(text(render(meta('season', '2026-10-31'), <BestLine deck={deck('3', 'Mid', 0.52, 3)} rate={0.5512} scope={scope} />))).toContain('Best against the 5 most played: Mid, 55.1%')
  })
})
