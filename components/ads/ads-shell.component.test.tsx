import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NITRO_AD_SLOT_IDS } from '@lib/nitro-ads.const'
import AdsShell from './ads-shell.component'

describe('AdsShell', () => {
  beforeEach(() => {
    window.nitroAds = {
      createAd: vi.fn().mockResolvedValue({}),
      queue: [],
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.nitroAds
  })

  it('renders both advertisement landmarks', () => {
    render(<AdsShell />)

    const adRegions = screen.getAllByRole('complementary', {
      name: /advertisement/i,
    })

    expect(adRegions).toHaveLength(2)
    expect(adRegions[0]).toHaveAttribute('id', NITRO_AD_SLOT_IDS.stickyRail)
    expect(adRegions[1]).toHaveAttribute(
      'id',
      NITRO_AD_SLOT_IDS.floatingOutstream,
    )
  })
})
