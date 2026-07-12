import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as nitroAds from '@lib/nitro-ads'
import { useNitroAdsNavigation } from './use-nitro-ads-navigation'

const pathnameState = vi.hoisted(() => ({ value: '/home' }))
const searchParamsState = vi.hoisted(() => ({ value: '' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useNitroAdsNavigation', () => {
  beforeEach(() => {
    pathnameState.value = '/home'
    searchParamsState.value = ''
    vi.spyOn(nitroAds, 'refreshNitroAdsOnNavigate').mockImplementation(() => {})
  })

  it('refreshes ads when the pathname changes', () => {
    const { rerender } = renderHook(() => useNitroAdsNavigation())

    expect(nitroAds.refreshNitroAdsOnNavigate).toHaveBeenCalledTimes(1)

    act(() => {
      pathnameState.value = '/tournaments'
      rerender()
    })

    expect(nitroAds.refreshNitroAdsOnNavigate).toHaveBeenCalledTimes(2)
  })

  it('refreshes ads when search params change', () => {
    const { rerender } = renderHook(() => useNitroAdsNavigation())

    act(() => {
      searchParamsState.value = 'page=2'
      rerender()
    })

    expect(nitroAds.refreshNitroAdsOnNavigate).toHaveBeenCalledTimes(2)
  })
})
