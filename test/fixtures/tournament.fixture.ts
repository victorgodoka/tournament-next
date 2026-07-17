import type {
  Duel,
  Round,
  TopcutData,
  Tournament,
  TournamentDetail,
  TournamentUser,
} from '../../app/tournament/tournament.types'
import type { TournamentsListResponse } from '../../app/history/history.types'

export function createTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 1,
    phases: 4,
    players: 32,
    banlist: 'TCG 18.05.2026',
    settings: 53,
    refteam: '',
    refuntil: '',
    starttime: '2026-07-14T18:00:00Z',
    endtime: '2026-07-14T21:00:00Z',
    extrarules: '',
    ...overrides,
  }
}

export function createTournamentsListData(
  overrides: Partial<TournamentsListResponse['data']> = {},
): TournamentsListResponse['data'] {
  return {
    tournaments: [
      createTournament({ id: 2, endtime: null }),
      createTournament({ id: 1 }),
    ],
    pagination: {
      currentPage: 1,
      totalPages: 3,
      totalTournaments: 50,
      limit: 12,
    },
    ...overrides,
  }
}

export function createTournamentUser(
  overrides: Partial<TournamentUser> = {},
): TournamentUser {
  return {
    user_id: 'user-1',
    username: 'duelist1',
    displayname: 'Duelist One',
    avatar: 'avatar-hash',
    stats: {
      wins: 3,
      loses: 1,
      draws: 0,
      rating: 1200,
    },
    ...overrides,
  }
}

export function createDuel(overrides: Partial<Duel> = {}): Duel {
  return {
    room_id: 1,
    duelist1: 'user-1',
    duelist2: 'user-2',
    winner: null,
    result: 0,
    results: { game1: 0, game2: 0, game3: 0 },
    reasons: { game1: 0, game2: 0, game3: 0 },
    first: 0,
    end: '',
    usage: '',
    ...overrides,
  }
}

export function createRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1,
    tournament_id: 1,
    phase: 1,
    bye: '',
    starttime: '2026-07-14T18:00:00Z',
    duels: [createDuel()],
    ...overrides,
  }
}

export function createTournamentDetail(
  overrides: Partial<TournamentDetail> = {},
): TournamentDetail {
  return {
    tournament: createTournament(),
    rounds: [createRound()],
    users: [
      createTournamentUser({ user_id: 'user-1', username: 'duelist1' }),
      createTournamentUser({ user_id: 'user-2', username: 'duelist2' }),
    ],
    topcutPlayers: [],
    ...overrides,
  }
}

export function createTopcutData(overrides: Partial<TopcutData> = {}): TopcutData {
  return {
    totalPlayers: 8,
    uniqueDecks: 2,
    decks: [
      {
        primaryArchetype: 'Fiendsmith Phantasm',
        qty: 5,
        archetypes: [
          { name: 'Fiendsmith', count: 9, percentage: 22, ids: [1, 2] },
          { name: 'Sacred Beast', count: 12, percentage: 30, ids: [3] },
        ],
      },
      {
        primaryArchetype: 'Ryzeal',
        qty: 3,
        archetypes: [{ name: 'Ryzeal', count: 15, percentage: 38, ids: [4] }],
      },
    ],
    ...overrides,
  }
}
