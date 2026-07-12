import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDiscordOAuthUrl,
  cleanupOAuthParams,
  createOAuthState,
  getOAuthParams,
  hasOAuthParams,
  isDiscordTokenValid,
  persistDiscordToken,
} from './discord-oauth'

describe('discord-oauth', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-oauth-state',
    })
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('buildDiscordOAuthUrl', () => {
    it('adds a state parameter to the authorize URL', () => {
      const url = buildDiscordOAuthUrl(
        'https://discord.com/oauth2/authorize?client_id=123',
      )

      expect(url).toContain('state=test-oauth-state')
      expect(sessionStorage.getItem('discord_oauth_state')).toBe('test-oauth-state')
    })

    it('returns an empty string when authorize URL is missing', () => {
      expect(buildDiscordOAuthUrl('')).toBe('')
    })
  })

  describe('createOAuthState', () => {
    it('stores and returns a unique state value', () => {
      expect(createOAuthState()).toBe('test-oauth-state')
      expect(sessionStorage.getItem('discord_oauth_state')).toBe('test-oauth-state')
    })
  })

  describe('getOAuthParams and hasOAuthParams', () => {
    it('reads transient OAuth params from localStorage', () => {
      localStorage.setItem('access_token', 'token')
      localStorage.setItem('token_type', 'Bearer')
      localStorage.setItem('expires_in', '3600')

      expect(getOAuthParams()).toEqual({
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresIn: '3600',
      })
      expect(hasOAuthParams()).toBe(true)
    })

    it('returns false when params are incomplete', () => {
      localStorage.setItem('access_token', 'token')
      expect(hasOAuthParams()).toBe(false)
    })
  })

  describe('cleanupOAuthParams', () => {
    it('removes transient OAuth params', () => {
      localStorage.setItem('access_token', 'token')
      localStorage.setItem('token_type', 'Bearer')
      localStorage.setItem('expires_in', '3600')

      cleanupOAuthParams()

      expect(hasOAuthParams()).toBe(false)
    })
  })

  describe('persistDiscordToken and isDiscordTokenValid', () => {
    it('persists a token with expiration metadata', () => {
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

      persistDiscordToken({
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresIn: '3600',
      })

      expect(isDiscordTokenValid()).toBe(true)
    })

    it('returns false for expired tokens', () => {
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

      persistDiscordToken({
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresIn: '1',
      })

      vi.setSystemTime(new Date('2025-06-15T12:05:00Z'))

      expect(isDiscordTokenValid()).toBe(false)
    })
  })
})
