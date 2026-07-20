import { describe, expect, it } from 'vitest'
import {
  normalizeSavedDeck,
  parsePlayerDecksResponse,
  parseSavedDecks,
  validateDeckEditorValues,
} from './decks.validation'
import { createSavedDeck } from '../../test/fixtures/deck.fixture'

describe('decks.validation', () => {
  describe('normalizeSavedDeck', () => {
    it('normalizes a valid saved deck', () => {
      const deck = createSavedDeck()

      expect(normalizeSavedDeck(deck)).toEqual(deck)
    })

    it('returns null for invalid deck payloads', () => {
      expect(normalizeSavedDeck({ id: 'not-a-number' })).toBeNull()
    })

    it('defaults optional fields', () => {
      const result = normalizeSavedDeck({ id: 1, name: 'Test Deck' })

      expect(result).toMatchObject({
        id: 1,
        name: 'Test Deck',
        archetypes: [],
        tags: [],
        private: false,
      })
    })
  })

  describe('parseSavedDecks', () => {
    it('parses a raw array of decks', () => {
      const deck = createSavedDeck()
      expect(parseSavedDecks([deck])).toEqual([deck])
    })

    it('parses decks from a data wrapper', () => {
      const deck = createSavedDeck()
      expect(parseSavedDecks({ data: [deck] })).toEqual([deck])
    })

    it('parses decks from a decks wrapper', () => {
      const deck = createSavedDeck()
      expect(parseSavedDecks({ decks: [deck] })).toEqual([deck])
    })

    it('returns null for unsupported shapes', () => {
      expect(parseSavedDecks({ unexpected: true })).toBeNull()
    })
  })

  describe('parsePlayerDecksResponse', () => {
    it('returns the body when it already has tcg and genesys', () => {
      const body = {
        tcg: { decks: [], matchHistory: [], pagination: {} },
        genesys: { decks: [], matchHistory: [], pagination: {} },
      }

      expect(parsePlayerDecksResponse(body)).toBe(body)
    })

    it('unwraps nested data payloads', () => {
      const body = {
        tcg: { decks: [], matchHistory: [], pagination: {} },
        genesys: { decks: [], matchHistory: [], pagination: {} },
      }

      expect(parsePlayerDecksResponse({ data: body })).toBe(body)
    })

    it('returns null for invalid payloads', () => {
      expect(parsePlayerDecksResponse({ success: true })).toBeNull()
    })
  })

  describe('validateDeckEditorValues', () => {
    it('accepts a valid name and code', () => {
      expect(validateDeckEditorValues({ name: 'Blue-Eyes', code: 'x'.repeat(10) })).toEqual({})
    })

    it('rejects an empty name and a short code', () => {
      const errors = validateDeckEditorValues({ name: '  ', code: 'short' })

      expect(errors.name).toBeTruthy()
      expect(errors.code).toBeTruthy()
    })

    it('rejects names over the 24-character limit', () => {
      expect(validateDeckEditorValues({ name: 'x'.repeat(25), code: 'x'.repeat(10) }).name).toBeTruthy()
    })
  })
})
