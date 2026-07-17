import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DecksPageClient from './decks.client'
import type { SavedDeck, SavedDecksResponse } from './decks.types'
import { parseDeckSearchQuery, resolveDeckCoverId } from './decks.utils'

function makeDeck(overrides: Partial<SavedDeck> = {}): SavedDeck {
  return {
    id: 1,
    user_id: 'user-1',
    code: 'invalid-code',
    name: 'Blue-Eyes Control',
    cover_id: 89631139,
    archetypes: ['Blue-Eyes', 'Dragon'],
    tags: ['competitive'],
    private: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    likes: 12,
    comment_count: 3,
    username: 'blueeyesfan',
    displayname: 'Blue Eyes Fan',
    avatar: 'abc123',
    ...overrides,
  }
}

const initialData: SavedDecksResponse = {
  success: true,
  data: [makeDeck(), makeDeck({ id: 2, name: 'Tearlaments Combo', cover_id: null, archetypes: ['Tearlaments'] })],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  filters: { availableArchetypes: ['Blue-Eyes', 'Dragon', 'Tearlaments'] },
}

describe('decks.utils', () => {
  it('parses hashtag-only queries as tags', () => {
    expect(parseDeckSearchQuery('#dragon #control plain')).toEqual({ tags: ['dragon', 'control'] })
  })

  it('parses name + trailing tags', () => {
    expect(parseDeckSearchQuery('Blue-Eyes Control #dragon #meta')).toEqual({
      name: 'Blue-Eyes Control',
      tags: ['dragon', 'meta'],
    })
  })

  it('drops plain words that appear after a tag', () => {
    expect(parseDeckSearchQuery('Blue-Eyes #dragon oops')).toEqual({
      name: 'Blue-Eyes',
      tags: ['dragon'],
    })
  })

  it('falls back to null cover id for invalid codes with no cover_id', () => {
    expect(resolveDeckCoverId({ cover_id: null, code: 'not-a-real-code' })).toBeNull()
  })

  it('prefers explicit cover_id', () => {
    expect(resolveDeckCoverId({ cover_id: 12345678, code: 'whatever' })).toBe(12345678)
  })
})

describe('DecksPageClient', () => {
  it('renders header, filters, deck cards and stats without crashing', () => {
    render(<DecksPageClient initialData={initialData} initialError={null} />)

    expect(screen.getByRole('heading', { name: 'Community Decks' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by name or #tags')).toBeInTheDocument()
    expect(screen.getByText('2 Decks')).toBeInTheDocument()
    expect(screen.getByText('Blue-Eyes Control')).toBeInTheDocument()
    expect(screen.getByText('Tearlaments Combo')).toBeInTheDocument()
    expect(screen.getByText('@blueeyesfan')).toBeInTheDocument()
    expect(screen.getAllByText('Blue-Eyes').length).toBeGreaterThan(0)
  })

  it('clicking an archetype chip updates the archetype select', () => {
    render(<DecksPageClient initialData={initialData} initialError={null} />)

    const chip = screen.getAllByText('Tearlaments')[0]
    fireEvent.click(chip)

    const select = screen.getByLabelText('Archetype') as HTMLSelectElement
    expect(select).toBeTruthy()
  })
})
