import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import type { DeckStat, Meta, Scope, TierRules } from '@utils/statistics'
import { WhatToPlay } from './WhatToPlay'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

const deck = (key: string, name: string, wrExpected: number, tier: DeckStat['tier'], share = 0.1, players = 40) =>
  ({ key, name, wrExpected, wrLo: wrExpected - 0.01, wrHi: wrExpected + 0.01, tier, share, games: 500, players }) as DeckStat

const TIERS: TierRules = { t1Gap: 0.0075, t2Gap: 0.0125, t3Gap: 0.025, minShare: 0.005, minPlayers: 10 }
const meta = (tiers: TierRules | null) =>
  ({
    window: 'season',
    season: { startsAt: '2026-10-19T03:00:00.000Z', sweptThrough: '2026-10-31' },
    fit: { games: 48216, firstEffect: 0.118, builtAt: '2026-11-01T19:42:00.000Z', tiers },
    decks: [
      deck('1', 'Low', 0.48, null),
      deck('2', 'High', 0.56, 1),
      deck('2*', 'High', 0.57, 1),
      deck('', 'Unknown', 0.6, null),
      deck('3', 'Mid', 0.52, 3),
      deck('4', 'Rare', 0.59, null, 0.003, 9),
    ],
    weeks: [],
  }) as unknown as Meta

const scope: Scope = { ladder: 'tcg', window: 'season', band: 'all' }

const render = (data: Meta) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <WhatToPlay meta={data} scope={scope} />
    </NextIntlClientProvider>,
  )
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
/** The wide table only: the phone list repeats every name. */
const table = (html: string) => text(html.split('role="list"')[0]!)

describe('WhatToPlay', () => {
  it('sorts by the expected rate and leaves out lead rows and the unknown deck', () => {
    const out = table(render(meta(TIERS)))
    expect(out.indexOf('High')).toBeLessThan(out.indexOf('Mid'))
    expect(out.indexOf('Mid')).toBeLessThan(out.indexOf('Low'))
    expect(out).not.toContain('Unknown')
    expect(out.match(/High/g)).toHaveLength(1)
  })

  it('sets the decks under the floors apart, after the ranked ones, folded until asked for', () => {
    const html = render(meta(TIERS))
    const out = table(html)
    expect(out.indexOf('Untiered · 1')).toBeGreaterThan(out.indexOf('Low'))
    expect(html).toContain('aria-expanded="false"')
    expect(out).not.toContain('Rare')
    expect(out).toContain('No tier')
    expect(text(render(meta(TIERS)))).toContain('3 + 1')
  })

  it('reads the tier marks from the build, and without them sets nothing apart', () => {
    const card = text(render(meta(TIERS)))
    expect(card).toContain('plus the next deck if it trails by 0.75 points or less')
    expect(card).toContain('More than 2.5 points behind')
    expect(card).toContain('A deck needs 0.5% of the meta and 10 duelists')
    expect(card).toContain('Reading the bars')
    // a build of the old absolute marks: the floors still set decks apart, the card explains the default gaps
    const old = text(render(meta({ t1: 0.55, minShare: 0.005, minPlayers: 10 } as unknown as TierRules)))
    expect(old).toContain('plus the next deck if it trails by 0.75 points or less')
    expect(old).not.toContain('NaN')
    expect(old).toContain('Untiered')
    const out = table(render(meta(null)))
    expect(out).not.toContain('Untiered')
    expect(out.indexOf('Rare')).toBeLessThan(out.indexOf('High'))
  })

  it('says how many games the model holds and what going first is worth', () => {
    const out = text(render(meta(TIERS)))
    expect(out).toContain('48 216 games · Updated')
    expect(out).toContain('+2.9 pts')
  })
})
