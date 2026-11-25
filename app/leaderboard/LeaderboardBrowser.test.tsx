// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LeaderboardEntry, LeaderboardPage, PastSeason } from '@utils/types'
import { LeaderboardBrowser } from './LeaderboardBrowser'

vi.mock('next-intl', () => ({ useLocale: () => 'en' }))
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: () => ({ user: { id: 'admin', permissions: ['system.manage'] } }) }))

const entry = (rank: number, name: string): LeaderboardEntry => ({
  rank, id: String(rank), name, handle: null, avatar: null, cosmetics: {}, elo: 2000 - rank, tier: 'Omega', wins: 10, loses: 5, draws: 0,
})
const live = (ladder: 'tcg' | 'genesys', name: string): LeaderboardPage => ({
  ladder,
  format: ladder === 'tcg' ? 'TCG' : 'Genesys',
  season: { id: 3, code: `${ladder}-3`, label: 'Season 3', ordinal: 3 },
  syncedAt: '2026-11-01T10:00:00.000Z',
  entries: [entry(1, name)],
  nextCursor: null,
})
const closed: PastSeason = { code: 'tcg-2', label: '09.2026 ROLAD', ordinal: 2, startsAt: '2026-09-22T00:13:53.322Z', endsAt: '2026-10-19T19:21:19.117Z', standings: 2 }

const pages: Record<string, unknown> = {
  'limit=50': { ladder: 'tcg', format: 'TCG', season: closed, entries: [entry(1, 'Frozen one')], nextCursor: '1' },
  'limit=50&cursor=1': { ladder: 'tcg', format: 'TCG', season: closed, entries: [entry(2, 'Frozen two')], nextCursor: null },
}
const fetchMock = vi.fn((url: string) => {
  const page = pages[url.split('?')[1] ?? '']
  return Promise.resolve(new Response(JSON.stringify(page), { status: page ? 200 : 404 }))
})

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const board = () => render(<LeaderboardBrowser initial={{ tcg: live('tcg', 'Live one'), genesys: live('genesys', 'Live two') }} past={{ tcg: [closed], genesys: [] }} />)
const season = (value: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), { target: { value } })

it('reads a closed season from its standings and pages it without the live checks', async () => {
  board()
  expect(screen.getByRole('button', { name: 'Refresh leaderboard' })).toBeTruthy()

  season('tcg-2')
  await screen.findByText('Frozen one')
  expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/ranked\/seasons\/tcg-2\/standings\?limit=50$/)
  expect(screen.getByText('Final results')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Refresh leaderboard' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Show 50 more' }))
  await screen.findByText('Frozen two')
  expect(screen.getByText('Frozen one')).toBeTruthy()
  expect(screen.queryByText('The ladder was re-read')).toBeNull()
})

it('hides the open ladder behind a notice for two hours after the last season closed', () => {
  // The live read is 10:00: a season that opened at 09:00 is still gathering, one from 07:59 is not.
  const opened = (endsAt: string) => render(<LeaderboardBrowser initial={{ tcg: live('tcg', 'Live one'), genesys: live('genesys', 'Live two') }} past={{ tcg: [{ ...closed, endsAt }], genesys: [] }} />)

  opened('2026-11-01T09:00:00.000Z')
  expect(screen.getByText("We're gathering data for Season 3")).toBeTruthy()
  expect(screen.queryByText('Live one')).toBeNull()
  cleanup()

  opened('2026-11-01T07:59:00.000Z')
  expect(screen.getByText('Live one')).toBeTruthy()
})

it('keeps the open season and the choice of each ladder without reading them again', async () => {
  board()
  season('tcg-2')
  await screen.findByText('Frozen one')

  fireEvent.click(screen.getByRole('tab', { name: 'Genesys' }))
  expect(screen.getByText('Live two')).toBeTruthy()
  expect(screen.queryByRole('combobox', { name: 'Season' })).toBeNull()

  fireEvent.click(screen.getByRole('tab', { name: 'TCG' }))
  expect(screen.getByText('Frozen one')).toBeTruthy()

  season('')
  expect(screen.getByText('Live one')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('marks who climbed or dropped since the day started, and nothing for the rest', () => {
  const moved = (rank: number, name: string, rankChange: number | null) => ({ ...entry(rank, name), rankChange, previousRank: rankChange === null ? null : rank + rankChange })
  const page = { ...live('tcg', 'x'), entries: [moved(1, 'A', 2), moved(2, 'B', 0), moved(3, 'C', null), moved(4, 'D', -1), moved(5, 'E', 3)] }
  render(<LeaderboardBrowser initial={{ tcg: page, genesys: live('genesys', 'Live two') }} past={{ tcg: [], genesys: [] }} />)

  expect(screen.getByRole('img', { name: 'Up 2 places today' })).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Down 1 place today' })).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Up 3 places today' })).toBeTruthy()
  expect(screen.getAllByRole('img', { name: /places? today/ })).toHaveLength(3)
})
