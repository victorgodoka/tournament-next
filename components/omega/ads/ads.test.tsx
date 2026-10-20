// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@utils/auth'
import { createNitroPlacement, removeNitroHost, removeNitroPlacement } from '@utils/nitro-ads'
import { ANCHOR_AD_OPTIONS, ANCHOR_MOBILE_AD_OPTIONS, NITRO_AD_SLOT_IDS } from '@utils/nitro-ads.const'
import { Ads } from './ads'

const auth: { user: AuthUser | null | undefined } = { user: undefined }
let pathname = '/decks'

vi.mock('next/script', () => ({ default: ({ id }: { id: string }) => <script data-testid={id} /> }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))
vi.mock('@utils/nitro-ads', () => ({
  createNitroPlacement: vi.fn(async () => ({})),
  removeNitroPlacement: vi.fn(),
  removeNitroHost: vi.fn(),
}))

const base: Omit<AuthUser, 'isVip'> = {
  id: '1',
  status: 'ACTIVE',
  role: 'USER',
  permissions: [],
  profile: { username: null, avatarUrl: null },
  createdAt: '2026-10-20T00:00:00.000Z',
  cosmetics: {},
}
const free: AuthUser = { ...base, isVip: false }
const vip: AuthUser = { ...base, isVip: true }
const ALL = Object.values(NITRO_AD_SLOT_IDS)

const created = () => vi.mocked(createNitroPlacement).mock.calls.map(([id]) => id)
const optionsOf = (id: string) => vi.mocked(createNitroPlacement).mock.calls.find(([slot]) => slot === id)?.[1]

const show = async (user: AuthUser | null | undefined, path: string) => {
  auth.user = user
  pathname = path
  const view = render(<Ads />)
  await act(() => vi.runAllTimersAsync())
  return view
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('Ads', () => {
  it('renders nothing while auth is loading', async () => {
    const { container } = await show(undefined, '/decks')
    expect(container.innerHTML).toBe('')
    expect(createNitroPlacement).not.toHaveBeenCalled()
  })

  it('renders nothing for a VIP', async () => {
    const { container } = await show(vip, '/decks')
    expect(container.innerHTML).toBe('')
    expect(createNitroPlacement).not.toHaveBeenCalled()
  })

  it('gives a signed-out reader the script and all five slots, with the anchor at every width', async () => {
    await show(null, '/decks')
    expect(screen.getByTestId('nitro-ads-stub')).toBeTruthy()
    expect(screen.getByTestId('nitro-ads-loader')).toBeTruthy()
    expect(created().sort()).toEqual([...ALL].sort())
    expect(optionsOf(NITRO_AD_SLOT_IDS.anchor)).toBe(ANCHOR_AD_OPTIONS)
  })

  it('keeps a signed-in reader off the right side, where the messenger dock lives', async () => {
    await show(free, '/decks')
    expect(created()).not.toContain(NITRO_AD_SLOT_IDS.railRight)
    expect(created()).toHaveLength(4)
    expect(optionsOf(NITRO_AD_SLOT_IDS.anchor)).toBe(ANCHOR_MOBILE_AD_OPTIONS)
  })

  it('drops the floating player on a page with an in-content video', async () => {
    await show(null, '/wiki/foo')
    expect(created()).not.toContain(NITRO_AD_SLOT_IDS.floating)
  })

  it('gives tool pages the left rail only', async () => {
    await show(null, '/deck-builder')
    expect(created()).toEqual([NITRO_AD_SLOT_IDS.railLeft])
  })

  it('removes every placement when the reader moves to a page without ads', async () => {
    const { container, rerender } = await show(null, '/decks')
    pathname = '/admin'
    rerender(<Ads />)
    expect(container.innerHTML).toBe('')
    expect(vi.mocked(removeNitroPlacement).mock.calls.map(([id]) => id).sort()).toEqual([...ALL].sort())
    // Nitro has no removeAd: taking its body-level host out is what actually clears the screen.
    expect(vi.mocked(removeNitroHost).mock.calls.map(([id]) => id).sort()).toEqual([...ALL].sort())
  })
})
