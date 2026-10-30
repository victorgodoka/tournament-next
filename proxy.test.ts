import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { expect, test, vi } from 'vitest'
import { allow, config, proxy } from './proxy'

// What the Next runtime leaves on the global before `next/server` loads.
await vi.hoisted(async () => {
  Object.assign(globalThis, { AsyncLocalStorage: (await import('node:async_hooks')).AsyncLocalStorage })
})

const visit = (path: string, ip: string, agent = 'Mozilla/5.0') =>
  proxy(new NextRequest(`https://omega.duelistsunite.org${path}`, { headers: { 'user-agent': agent, 'cf-connecting-ip': ip } }))

test('allows 20 requests per minute per ip, then resets', () => {
  const t = 1_000_000
  for (let i = 0; i < 20; i++) expect(allow('1.1.1.1', t)).toBe(true)
  expect(allow('1.1.1.1', t + 1)).toBe(false)
  expect(allow('2.2.2.2', t + 1)).toBe(true)
  expect(allow('1.1.1.1', t + 60_000)).toBe(true)
})

test('runs on card pages and profiles, but not on their prefetches', () => {
  const runsOn = (path: string, headers = {}) => unstable_doesMiddlewareMatch({ config, url: path, headers })
  expect(runsOn('/wiki/card/72270339')).toBe(true)
  expect(runsOn('/profile/1')).toBe(true)
  expect(runsOn('/wiki/card/72270339', { 'next-router-prefetch': '1' })).toBe(false)
  expect(runsOn('/wiki/yu-gi-oh-formats')).toBe(false)
})

test('refuses scrapers on card pages', () => {
  expect(visit('/wiki/card/72270339', '3.3.3.3', 'GPTBot/1.2').status).toBe(403)
})

test('never rate limits a card page: a search engine reads many of them from one address', () => {
  for (let i = 0; i < 30; i++) expect(visit('/wiki/card/72270339', '4.4.4.4').status).toBe(200)
})

test('still rate limits profiles', () => {
  for (let i = 0; i < 20; i++) expect(visit('/profile/1', '5.5.5.5').status).toBe(200)
  expect(visit('/profile/1', '5.5.5.5').status).toBe(429)
})
