import type { PlayerStats } from '../../app/leaderboards/leaderboards.types'

export function createPlayerStats(
  overrides: Partial<PlayerStats> = {},
): PlayerStats {
  return {
    id: 'player-1',
    username: 'duelist1',
    displayname: 'Duelist One',
    avatar: 'avatar-hash',
    wins: 50,
    loses: 20,
    draws: 5,
    rating: 1200,
    winstreak: 3,
    losestreak: 0,
    games: 75,
    ot: '0',
    ...overrides,
  }
}

export function createLeaderboardData() {
  return {
    TCG: [
      createPlayerStats({
        id: 'tcg-1',
        displayname: 'TCG Champion',
        username: 'tcg_champ',
        rating: 2100,
      }),
      createPlayerStats({
        id: 'tcg-2',
        displayname: 'TCG Runner',
        username: 'tcg_runner',
        rating: 1800,
      }),
    ],
    Genesys: [
      createPlayerStats({
        id: 'genesys-1',
        displayname: 'Genesys Champion',
        username: 'genesys_champ',
        rating: 2000,
      }),
    ],
  }
}
