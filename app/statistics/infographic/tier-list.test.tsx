import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeckStat, Meta } from '@utils/statistics'
import { getDeck, getMeta } from '@utils/statistics'
import { GET } from './[section]/route'

vi.mock('@utils/statistics', async (original) => ({
  ...await original<typeof import('@utils/statistics')>(),
  getMeta: vi.fn(),
  getDeck: vi.fn(),
}))

vi.mock('@omega/infographic/infographic', () => ({
  C: { tier: {}, line: '#222', surface: '#111', win: '#0f0', loss: '#f00' },
  F: {}, mono: {}, col: { display: 'flex', flexDirection: 'column' }, row: { display: 'flex' },
  Art: ({ src, subSrc, size }: { src?: string; subSrc?: string; size: number }) => createElement('div', { 'data-art': src, 'data-secondary': subSrc, 'data-size': size }),
  Label: ({ children }: { children: string }) => createElement('span', null, children),
  Empty: () => null, Chip: () => null, Kpi: () => null, Panel: () => null,
  busy: () => new Response(null, { status: 503 }),
  pct: (v: number) => `${v * 100}%`, num: String,
  sizeOf: (q: URLSearchParams) => q.get('size') === 'tall' ? 'tall' : 'wide',
  translator: async () => ({ t: (key: string) => key, locale: 'en' }),
  loadImages: async (ids: number[]) => new Map(ids.map((id) => [id, `art-${id}`])),
  render: async ({ body }: { body: React.ReactNode }) => new Response(renderToStaticMarkup(body)),
}))

const deck = (key: string, name: string, tier: DeckStat['tier'], face: number): DeckStat => ({ key, name, tier, face, share: 0.01, wrExpected: 0.6 } as DeckStat)
const mixed = deck('1>2', 'Angelechy / Dark Time Wizard', 1, 101)
const fourth = Array.from({ length: 12 }, (_, i) => deck(`t4-${i}`, `Tier four deck ${i}`, 4, 200 + i))
const setup = (decks: DeckStat[]) => {
  vi.mocked(getMeta).mockResolvedValue({ ok: true, data: {
    decks, weeks: [], season: { ladder: 'tcg', label: 'Season', sweptThrough: null }, fit: { games: 100, players: 20 },
  } as unknown as Meta })
  vi.mocked(getDeck).mockImplementation(async (key) => ({ ok: true, data: {
    deck: decks.find((d) => d.key === key)!, cards: [], sampleDeck: null, matchups: [], weeks: [], byBand: [], against: [],
  } }))
}
const draw = async (size: string) => (await GET(new Request(`http://localhost/statistics/infographic/tier-list?size=${size}`), { params: Promise.resolve({ section: 'tier-list' }) })).text()

afterEach(() => vi.clearAllMocks())

describe('tier list infographic', () => {
  it.each(['wide', 'tall'])('shows both archetypes and at most nine T4 decks in %s', async (size) => {
    setup([mixed, deck('1', 'Angelechy', null, 11), deck('2*', 'Dark Time Wizard', null, 22), ...fourth])
    const html = await draw(size)
    expect(html).toContain('Angelechy')
    expect(html).toContain('Dark Time Wizard')
    expect(html).not.toContain('text-overflow:ellipsis')
    expect(html).toContain('font-size:18px')
    expect(html).toContain('data-art="art-11" data-secondary="art-22"')
    for (let i = 0; i < 9; i++) expect(html).toContain(`Tier four deck ${i}<`)
    for (let i = 9; i < 12; i++) expect(html).not.toContain(`Tier four deck ${i}<`)
    expect(html).toContain('+3')
    expect(html).toContain('others')
    expect(html).toContain(`data-size="${size === 'wide' ? 64 : 100}"`)
  })

  it('keeps a mixed deck’s cover when its primary archetype has no face', async () => {
    setup([mixed, deck('2', 'Dark Time Wizard', null, 22)])
    expect(await draw('wide')).toContain('data-art="art-101" data-secondary="art-22"')
  })

  it('shows all small T4 lists without an empty Others box', async () => {
    setup(fourth.slice(0, 3))
    const html = await draw('tall')
    expect(html).toContain('Tier four deck 2')
    expect(html).not.toContain('others')
  })
})
