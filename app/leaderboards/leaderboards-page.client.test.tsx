import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as leaderboardsApi from './leaderboards.api'
import {
  createLeaderboardData,
  render,
  screen,
  userEvent,
} from '../../test/test-utils'
import LeaderboardsPageClient from './leaderboards-page.client'

vi.mock('./leaderboards.api', () => ({
  getLeaderboard: vi.fn(),
}))

describe('LeaderboardsPageClient', () => {
  beforeEach(() => {
    vi.mocked(leaderboardsApi.getLeaderboard).mockReset()
  })

  it('shows the error state with retry action', async () => {
    const user = userEvent.setup()
    vi.mocked(leaderboardsApi.getLeaderboard).mockResolvedValue({
      ok: true,
      data: createLeaderboardData(),
    })

    render(
      <LeaderboardsPageClient
        data={null}
        error="Failed to load leaderboard."
        initialMode="TCG"
      />,
    )

    expect(
      screen.getByRole('heading', { name: /leaderboard unavailable/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Failed to load leaderboard.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(leaderboardsApi.getLeaderboard).toHaveBeenCalledTimes(1)
  })

  it('shows an empty state when a mode has no players', () => {
    const data = createLeaderboardData()
    data.TCG = []

    render(<LeaderboardsPageClient data={data} error={null} initialMode="TCG" />)

    expect(screen.getByText(/no ranked players yet for tcg/i)).toBeInTheDocument()
  })

  it('renders leaderboard rows and switches modes', async () => {
    const user = userEvent.setup()
    const data = createLeaderboardData()

    render(<LeaderboardsPageClient data={data} error={null} initialMode="TCG" />)

    expect(screen.getByText('TCG Champion')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /tcg champion/i })).toHaveAttribute(
      'href',
      '/profile/tcg-1',
    )

    await user.click(screen.getByRole('tab', { name: 'Genesys' }))

    expect(screen.getByText('Genesys Champion')).toBeInTheDocument()
    expect(screen.queryByText('TCG Champion')).not.toBeInTheDocument()
  })
})
