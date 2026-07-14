import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as historyApi from './history.api'
import {
  createTournament,
  createTournamentsListData,
  render,
  screen,
  userEvent,
} from '../../test/test-utils'
import HistoryPageClient from './history-page.client'

vi.mock('./history.api', () => ({
  getTournaments: vi.fn(),
}))

describe('HistoryPageClient', () => {
  beforeEach(() => {
    vi.mocked(historyApi.getTournaments).mockReset()
  })

  it('shows the error state with retry action', async () => {
    const user = userEvent.setup()
    vi.mocked(historyApi.getTournaments).mockResolvedValue({
      ok: true,
      data: { success: true, message: '', data: createTournamentsListData() },
    })

    render(<HistoryPageClient initialData={null} initialError="Failed to load." />)

    expect(
      screen.getByRole('heading', { name: /tournament history unavailable/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Failed to load.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(historyApi.getTournaments).toHaveBeenCalledTimes(1)
  })

  it('shows an empty state when there are no tournaments', () => {
    const data = createTournamentsListData({ tournaments: [] })

    render(<HistoryPageClient initialData={data} initialError={null} />)

    expect(screen.getByText(/no tournaments found/i)).toBeInTheDocument()
  })

  it('renders tournament cards with title, rounds, date, banlist, and status', () => {
    const data = createTournamentsListData({
      tournaments: [
        createTournament({ id: 42, phases: 5, banlist: 'Edison', endtime: null }),
      ],
      pagination: { currentPage: 1, totalPages: 1, totalTournaments: 1, limit: 12 },
    })

    render(<HistoryPageClient initialData={data} initialError={null} />)

    const link = screen.getByRole('link', { name: /tournament #42/i })
    expect(link).toHaveAttribute('href', '/tournament/42')
    expect(screen.getByText('5 Rounds')).toBeInTheDocument()
    expect(screen.getByText('Edison')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('loads the next page when paginating', async () => {
    const user = userEvent.setup()
    const initialData = createTournamentsListData({
      tournaments: [createTournament({ id: 2 })],
      pagination: { currentPage: 1, totalPages: 2, totalTournaments: 20, limit: 12 },
    })
    const nextData = createTournamentsListData({
      tournaments: [createTournament({ id: 1 })],
      pagination: { currentPage: 2, totalPages: 2, totalTournaments: 20, limit: 12 },
    })
    vi.mocked(historyApi.getTournaments).mockResolvedValue({
      ok: true,
      data: { success: true, message: '', data: nextData },
    })

    render(<HistoryPageClient initialData={initialData} initialError={null} />)

    expect(screen.getByRole('link', { name: /tournament #2/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(historyApi.getTournaments).toHaveBeenCalledWith({ page: 2, limit: 12 })
    expect(await screen.findByRole('link', { name: /tournament #1/i })).toBeInTheDocument()
  })
})
