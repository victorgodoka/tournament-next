import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../messages/en.json'
import type { Scope } from '@utils/statistics'
import { Pickers } from './Pickers'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {} }) }))

const scope: Scope = { ladder: 'tcg', window: 'season', band: 'aggregate' }
const bands = [{ band: 'aggregate', games: 1234 }, { band: 'all', games: 5678 }, { band: 'Gold', games: 900 }]

describe('Pickers', () => {
  it('lists the aggregate band first, named by its floor, then all ratings and the tiers, by games', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Pickers scope={scope} seasons={[]} bands={bands} aggregateFloor="Gold" />
      </NextIntlClientProvider>,
    )
    const labels = [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1])
    expect(labels).toEqual(['Gold and up · 1,234 games', 'All ratings · 5,678 games', 'Gold · 900 games'])
  })
})
