import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDiscordOAuthUrl,
  completeDiscordLogin,
  createOAuthState,
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
    vi.restoreAllMocks()
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

  describe('completeDiscordLogin', () => {
    it('posts the login input and returns the Discord identity on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          user: { id: '1', username: 'duelist', avatar: null, global_name: 'Duelist' },
        }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await completeDiscordLogin({ code: 'auth-code' })

      expect(fetchMock).toHaveBeenCalledWith('/api/auth/discord/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'auth-code' }),
      }))
      expect(result).toEqual({
        ok: true,
        user: { id: '1', username: 'duelist', avatar: null, global_name: 'Duelist' },
      })
    })

    it('never sends a raw Discord access token in the request body for the code flow', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, user: { id: '1' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      await completeDiscordLogin({ code: 'auth-code' })

      const [, init] = fetchMock.mock.calls[0]!
      expect((init as RequestInit).body).not.toContain('accessToken')
    })

    it('surfaces the server error message on failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, message: 'Invalid code.' }),
      }))

      const result = await completeDiscordLogin({ code: 'bad-code' })

      expect(result).toEqual({ ok: false, message: 'Invalid code.' })
    })

    it('returns a generic message on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      const result = await completeDiscordLogin({ code: 'auth-code' })

      expect(result).toEqual({ ok: false, message: 'Network error during Discord sign-in.' })
    })
  })
})
