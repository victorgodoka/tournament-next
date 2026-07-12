import type { MatchHistory, SavedDeck } from '../../app/decks/decks.types'

export function createSavedDeck(overrides: Partial<SavedDeck> = {}): SavedDeck {
  return {
    id: 42,
    user_id: 'user-1',
    code: 'DECKCODE',
    name: 'Blue-Eyes Control',
    cover_id: 89631139,
    archetypes: ['Blue-Eyes', 'Dragon'],
    tags: ['competitive'],
    private: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    ...overrides,
  }
}

export function createMatchHistory(
  overrides: Partial<MatchHistory> = {},
): MatchHistory {
  return {
    duelist: {
      id: 'user-1',
      deck: [{ archetype: 'Blue-Eyes', ids: [89631139], qtd: 1 }],
      discord: {
        username: 'duelist',
        avatar: 'abc',
        displayname: 'Test Duelist',
      },
    },
    opponent: {
      id: 'user-2',
      deck: [{ archetype: 'Dark Magician', ids: [46986414], qtd: 1 }],
      discord: {
        username: 'opponent',
        avatar: 'def',
        displayname: 'Opponent Player',
      },
    },
    winner: 'user-1',
    isWinner: true,
    isDraw: false,
    start: '2025-06-01T14:00:00Z',
    end: '2025-06-01T14:25:00Z',
    ...overrides,
  }
}
