import type { Comment, ConvertedDeck } from '../../app/decks/decks.types'
import type { MatchHistory, SavedDeck } from '../../app/decks/decks.types'
import type { Card } from '../../lib/cards.types'

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
    liked: false,
    username: 'duelist',
    displayname: 'Test Duelist',
    avatar: 'abc',
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

export function createComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    deck_id: 42,
    user_id: 'user-1',
    comment: 'Great deck!',
    parent_id: null,
    created_at: '2026-07-12T04:31:03.000Z',
    updated_at: '2026-07-12T04:31:03.000Z',
    user: {
      discord_id: 'user-1',
      username: 'duelist',
      avatar: null,
      displayname: 'Test Duelist',
    },
    ...overrides,
  }
}

export function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 14558127,
    name_en: 'Ash Blossom & Joyous Spring',
    sets: [],
    type_primary: 'Monster',
    type_tags: [],
    genre_tags: [],
    category_tags: [],
    ...overrides,
  }
}

export function createConvertedDeck(
  overrides: Partial<ConvertedDeck> = {},
): ConvertedDeck {
  const ash = createCard()
  const maxx = createCard({ id: 23434538, name_en: 'Maxx "C"' })
  const prosperity = createCard({
    id: 84211599,
    name_en: 'Pot of Prosperity',
    type_primary: 'Spell',
  })
  const impermanence = createCard({
    id: 10045474,
    name_en: 'Infinite Impermanence',
    type_primary: 'Trap',
  })
  const accesscode = createCard({
    id: 86066372,
    name_en: 'Accesscode Talker',
    // Extra-deck monsters report the broad "Monster" type; the subtype lives in tags.
    type_primary: 'Monster',
    type_tags: ['Monster', 'Effect', 'Link'],
  })

  const uniqueCardsData = [ash, maxx, prosperity, impermanence, accesscode]

  return {
    code: 'DECKCODE',
    primaryArchetype: 'Tenpai',
    primaryArchetypeWeighted: 'Tenpai',
    primaryArchetypes: ['Tenpai'],
    category: 'Meta',
    archetypes: [],
    totalCards: 8,
    mainDeckSize: 7,
    sideDeckSize: 1,
    uniqueCards: uniqueCardsData.map((card) => card.id),
    fullDeck: {
      main: [
        ash.id,
        ash.id,
        ash.id,
        maxx.id,
        prosperity.id,
        prosperity.id,
        impermanence.id,
        accesscode.id,
      ],
      side: [ash.id],
    },
    uniqueCardsData,
    ...overrides,
  }
}
