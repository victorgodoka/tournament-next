import { describe, expect, it } from 'vitest'
import {
  createDuel,
  createRound,
  createTournamentDetail,
  createTournamentUser,
  render,
  screen,
  within,
} from '../../test/test-utils'
import TournamentTable from './tournament-table.component'

// A and B play both rounds; C plays round 1 then drops out of round 2.
const createDetailWithDrop = () =>
  createTournamentDetail({
    users: [
      createTournamentUser({ user_id: 'A', username: 'ann', displayname: 'Ann' }),
      createTournamentUser({ user_id: 'B', username: 'bo', displayname: 'Bo' }),
      createTournamentUser({
        user_id: 'C',
        username: 'cy',
        displayname: 'Cy',
        stats: { wins: 2, loses: 0, draws: 0, rating: 1100 },
      }),
    ],
    rounds: [
      createRound({
        id: 1,
        phase: 1,
        bye: 'B',
        duels: [createDuel({ duelist1: 'A', duelist2: 'C', result: 0 })],
      }),
      createRound({
        id: 2,
        phase: 2,
        bye: 'B',
        duels: [createDuel({ duelist1: 'A', duelist2: 'B', result: 0 })],
      }),
    ],
  })

describe('TournamentTable drop indicator', () => {
  it('marks the dropped player and counts the missed round as a loss', () => {
    render(<TournamentTable detail={createDetailWithDrop()} />)

    const droppedRow = screen.getByText('Cy').closest('tr') as HTMLElement
    const dropped = within(droppedRow)

    expect(dropped.getByText('Dropped')).toBeInTheDocument()
    // Original record was 2-0-0; the missed round is added as a loss.
    // Scoped to the desktop column — the same record also renders in the
    // mobile cluster (CSS-only responsive split, both exist in jsdom).
    expect(
      dropped.getByText('1', {
        selector: '.tournament-table__record.omega-hide-md-down .tournament-table__record-losses',
      }),
    ).toBeInTheDocument()
    expect(
      dropped.getAllByTitle(/includes 1 drop round/i),
    ).toHaveLength(2)
  })

  it('does not mark players who played (or byed) every round', () => {
    render(<TournamentTable detail={createDetailWithDrop()} />)

    const activeRow = screen.getByText('Ann').closest('tr') as HTMLElement
    expect(within(activeRow).queryByText('Dropped')).toBeNull()

    const byeRow = screen.getByText('Bo').closest('tr') as HTMLElement
    expect(within(byeRow).queryByText('Dropped')).toBeNull()

    // Exactly one player dropped.
    expect(screen.getAllByText('Dropped')).toHaveLength(1)
  })
})
