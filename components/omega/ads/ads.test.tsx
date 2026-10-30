// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@utils/auth'
import { createNitroPlacement, removeNitroHost } from '@utils/nitro-ads'
import {
  ANCHOR_AD_OPTIONS,
  ANCHOR_MOBILE_AD_OPTIONS,
  NITRO_AD_SLOT_IDS,
  RAIL_LEFT_AD_OPTIONS,
  RAIL_RIGHT_AD_OPTIONS,
  RAIL_RIGHT_DOCK_AD_OPTIONS,
} from '@utils/nitro-ads.const'
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

  it('keeps a signed-in reader\'s right rail clear of the messenger dock, and the anchor on phones', async () => {
    await show(free, '/decks')
    expect(created().sort()).toEqual([...ALL].sort())
    expect(optionsOf(NITRO_AD_SLOT_IDS.railRight)).toEqual({ ...RAIL_RIGHT_DOCK_AD_OPTIONS, sizes: [[160, 600]] })
    expect(optionsOf(NITRO_AD_SLOT_IDS.anchor)).toBe(ANCHOR_MOBILE_AD_OPTIONS)
  })

  it('keeps rails to 160x600 unless the body leaves a 300px rail its 310px', async () => {
    await show(null, '/decks')
    expect(optionsOf(NITRO_AD_SLOT_IDS.railLeft)).toEqual({ ...RAIL_LEFT_AD_OPTIONS, sizes: [[160, 600]] })
    cleanup()
    vi.clearAllMocks()

    Object.defineProperty(document.body, 'clientWidth', { configurable: true, value: 1903 })
    try {
      await show(null, '/decks')
      expect(optionsOf(NITRO_AD_SLOT_IDS.railRight)).toBe(RAIL_RIGHT_AD_OPTIONS)
    } finally {
      delete (document.body as { clientWidth?: number }).clientWidth
    }
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
    // Nitro has no removeAd: taking its body-level host out is what actually clears the screen.
    expect(vi.mocked(removeNitroHost).mock.calls.map(([id]) => id).sort()).toEqual([...ALL].sort())
  })
})
