import { describe, expect, it, vi } from 'vitest'
import {
  createDuel,
  createRound,
  createTournament,
  createTournamentDetail,
  createTournamentUser,
  mockRouter,
  pathnameState,
  render,
  screen,
  userEvent,
  within,
} from '../../test/test-utils'
import TournamentPageClient from './tournament-page.client'

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => pathnameState.value,
}))

const createUsers = () => [
  createTournamentUser({
    user_id: 'user-1',
    username: 'duelist1',
    displayname: 'Duelist One',
    stats: { wins: 3, loses: 1, draws: 0, rating: 99 },
  }),
  createTournamentUser({
    user_id: 'user-2',
    username: 'duelist2',
    displayname: 'Duelist Two',
    stats: { wins: 1, loses: 3, draws: 0, rating: 50 },
  }),
]

const createLiveDetail = () =>
  createTournamentDetail({
    tournament: createTournament({ id: 7, settings: 53, banlist: 'Edison', endtime: null }),
    users: createUsers(),
    rounds: [
      createRound({
        id: 1,
        phase: 1,
        duels: [
          createDuel({ duelist1: 'user-1', duelist2: 'user-2', winner: 'user-1', result: 1 }),
        ],
      }),
      createRound({
        id: 2,
        phase: 2,
        duels: [
          createDuel({ room_id: 2, duelist1: 'user-1', duelist2: 'user-2', winner: null }),
        ],
      }),
    ],
  })

const createFinishedDetail = () =>
  createTournamentDetail({
    tournament: createTournament({ id: 7, settings: 53, banlist: 'Edison' }),
    users: createUsers(),
    rounds: [
      createRound({
        id: 1,
        phase: 1,
        duels: [
          createDuel({ duelist1: 'user-1', duelist2: 'user-2', winner: 'user-2', result: 0 }),
        ],
      }),
    ],
  })

describe('TournamentPageClient', () => {
  it('shows the error page when the tournament fails to load', () => {
    render(<TournamentPageClient detail={null} error="Invalid tournament ID." />)

    expect(
      screen.getByRole('heading', { name: /tournament unavailable/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Invalid tournament ID.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /tournament history/i }),
    ).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('renders tournament info with status, schedule, and rule badges', () => {
    render(<TournamentPageClient detail={createFinishedDetail()} error={null} />)

    expect(
      screen.getByRole('heading', { name: 'Tournament #7' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Started')).toBeInTheDocument()
    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.getByText('Edison')).toBeInTheDocument()
    expect(screen.getByText('TCG')).toBeInTheDocument()
    expect(screen.getByText('Master Rule 5')).toBeInTheDocument()
  })

  it('marks a tournament without an end time as live', () => {
    render(<TournamentPageClient detail={createLiveDetail()} error={null} />)

    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0)
  })

  it('renders the players count and overflow avatar', () => {
    const detail = createLiveDetail()
    detail.users = Array.from({ length: 10 }, (_, index) =>
      createTournamentUser({
        user_id: `user-${index}`,
        username: `player${index}`,
        displayname: `Player ${index}`,
      }),
    )

    render(<TournamentPageClient detail={detail} error={null} />)

    const players = screen.getByRole('region', { name: /players/i })
    expect(within(players).getByText('10')).toBeInTheDocument()
    expect(within(players).getByText('+3')).toBeInTheDocument()
    expect(within(players).getAllByAltText(/player \d/i)).toHaveLength(7)
  })

  it('disables Topcut and Data tabs while the tournament is live', () => {
    render(<TournamentPageClient detail={createLiveDetail()} error={null} />)

    expect(
      screen.getByRole('tab', { name: 'Topcut & Decklists' }),
    ).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Data & Graphics' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Brackets' })).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'Table' })).toBeEnabled()
  })

  it('enables all tabs once the tournament is finished', async () => {
    const user = userEvent.setup()
    render(<TournamentPageClient detail={createFinishedDetail()} error={null} />)

    const topcutTab = screen.getByRole('tab', { name: 'Topcut & Decklists' })
    const dataTab = screen.getByRole('tab', { name: 'Data & Graphics' })
    expect(topcutTab).toBeEnabled()
    expect(dataTab).toBeEnabled()

    await user.click(topcutTab)
    expect(screen.getByText(/top cut hasn't been decided/i)).toBeInTheDocument()

    await user.click(dataTab)
    expect(screen.getByText(/no metagame data/i)).toBeInTheDocument()
  })

  it('shows the hard-refresh button only while the tournament is ongoing', () => {
    const { unmount } = render(
      <TournamentPageClient detail={createLiveDetail()} error={null} />,
    )
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()

    unmount()

    render(<TournamentPageClient detail={createFinishedDetail()} error={null} />)
    expect(
      screen.queryByRole('button', { name: /refresh/i }),
    ).not.toBeInTheDocument()
  })

  it('lists rounds newest first with only the latest open', () => {
    render(<TournamentPageClient detail={createLiveDetail()} error={null} />)

    const labels = screen.getAllByText(/^Round \d+$/)
    expect(labels.map((label) => label.textContent)).toEqual([
      'Round 2',
      'Round 1',
    ])
    expect(labels[0].closest('details')).toHaveAttribute('open')
    expect(labels[1].closest('details')).not.toHaveAttribute('open')
  })

  it('shows an ongoing badge for duels without a winner', () => {
    render(<TournamentPageClient detail={createLiveDetail()} error={null} />)

    const openRound = screen.getByText('Round 2').closest('details') as HTMLElement
    expect(within(openRound).getByText('In progress')).toBeInTheDocument()
    expect(within(openRound).queryByText('Winner')).not.toBeInTheDocument()
  })

  it('says explicitly who won and who lost a finished duel', () => {
    render(<TournamentPageClient detail={createFinishedDetail()} error={null} />)

    expect(screen.getByText('Winner').parentElement).toHaveTextContent(
      'Duelist Two',
    )
    expect(screen.getByText('Defeated').parentElement).toHaveTextContent(
      'Duelist One',
    )
  })

  it('renders the standings table with records, win rate, rating, and tiebreaker', async () => {
    const user = userEvent.setup()
    render(<TournamentPageClient detail={createFinishedDetail()} error={null} />)

    await user.click(screen.getByRole('tab', { name: 'Table' }))

    expect(screen.getByRole('columnheader', { name: 'Player' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'W-L-D' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'W/R' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Rating' })).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Tiebreaker' }),
    ).toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Duelist One')).toBeInTheDocument()
    expect(within(rows[1]).getByText('75.00%')).toBeInTheDocument()
    expect(within(rows[1]).getByText('99')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Duelist Two')).toBeInTheDocument()
    expect(within(rows[2]).getByText('25.00%')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /duelist one/i })).toHaveAttribute(
      'href',
      '/profile/user-1',
    )
  })

  it('moves between enabled tabs with arrow keys, skipping disabled tabs', async () => {
    const user = userEvent.setup()
    render(<TournamentPageClient detail={createLiveDetail()} error={null} />)

    await user.click(screen.getByRole('tab', { name: 'Brackets' }))
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Table' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Brackets' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
