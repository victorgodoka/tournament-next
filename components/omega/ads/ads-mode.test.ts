import { describe, expect, it } from 'vitest'
import type { AuthUser } from '@utils/auth'
import { adsMode, isVideoPage, promoVisible } from './ads-mode'

const base: Omit<AuthUser, 'isVip'> = {
  id: '1',
  status: 'ACTIVE',
  role: 'USER',
  permissions: [],
  profile: { username: null, avatarUrl: null },
  createdAt: '2026-10-20T00:00:00.000Z',
  cosmetics: {},
}
const anon = null
const free: AuthUser = { ...base, isVip: false }
const vip: AuthUser = { ...base, isVip: true }
/** An /auth/me from before the server knew `isVip`. */
const legacy = base as unknown as AuthUser

describe('adsMode', () => {
  it.each([
    [undefined, '/decks', 'none'], [vip, '/decks', 'none'], [legacy, '/decks', 'none'], [anon, '/', 'none'], [free, '/', 'none'],
    [anon, '/decks', 'all'], [free, '/wiki/some-article', 'all'], [anon, '/wiki/newbie-guide', 'all'], [anon, '/simulator/c/abc', 'all'],
    [anon, '/simulator/c/abc/render', 'none'], [anon, '/admin', 'none'], [anon, '/admin/', 'none'], [anon, '/admin/shop/prices', 'none'],
    [anon, '/login', 'none'], [free, '/messenger', 'none'], [free, '/profile/edit', 'none'], [free, '/shop', 'none'],
    [free, '/battlepass', 'none'], [free, '/inventory', 'none'], [free, '/wiki/new', 'none'], [free, '/wiki/panel', 'none'],
    [free, '/wiki/example', 'none'], [free, '/wiki/foo/edit', 'none'], [free, '/wiki/foo/history', 'none'],
    [anon, '/deck-builder', 'rail'], [anon, '/deck-builder/abc', 'rail'], [anon, '/calculator', 'rail'], [anon, '/simulator', 'rail'],
  ] as const)('%o on %s is %s', (user, pathname, mode) => {
    expect(adsMode(user, pathname)).toBe(mode)
  })
})

describe('promoVisible', () => {
  it.each([
    [undefined, false], [anon, true], [free, true], [vip, false], [legacy, false],
  ] as const)('%o is %s', (user, visible) => {
    expect(promoVisible(user)).toBe(visible)
  })
})

describe('isVideoPage', () => {
  it.each([
    ['/wiki/foo', true], ['/wiki/card/123', true], ['/statistics', true], ['/profile/1/statistics', true],
    ['/wiki', false], ['/decks', false], ['/profile/1', false],
  ] as const)('%s is %s', (pathname, video) => {
    expect(isVideoPage(pathname)).toBe(video)
  })
})
