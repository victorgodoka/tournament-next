import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  pushGtmEvent,
  trackCtaClick,
  trackLogin,
  trackLoginError,
  trackLoginStart,
  trackLogout,
  trackOutboundClick,
  trackPageView,
} from './gtm'

describe('gtm', () => {
  beforeEach(() => {
    window.dataLayer = []
    document.title = 'YGO Omega | Duelists Unite'
  })

  afterEach(() => {
    delete window.dataLayer
    vi.unstubAllGlobals()
  })

  it('pushes named events to the dataLayer', () => {
    pushGtmEvent('logout')

    expect(window.dataLayer).toEqual([{ event: 'logout' }])
  })

  it('tracks page views with path, location, and title', () => {
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'https://next.duelistsunite.org',
    })

    trackPageView('/leaderboards')

    expect(window.dataLayer).toEqual([
      {
        event: 'page_view',
        page_path: '/leaderboards',
        page_location: 'https://next.duelistsunite.org/leaderboards',
        page_title: 'YGO Omega | Duelists Unite',
      },
    ])
  })

  it('tracks the Discord login funnel', () => {
    trackLoginStart()
    trackLogin()
    trackLoginError('Invalid code')
    trackLogout()

    expect(window.dataLayer).toEqual([
      { event: 'login_start', method: 'discord' },
      { event: 'login', method: 'discord' },
      { event: 'login_error', method: 'discord', error_message: 'Invalid code' },
      { event: 'logout' },
    ])
  })

  it('tracks CTA and outbound clicks', () => {
    trackCtaClick({
      cta_name: 'Live Tournament',
      cta_location: 'home_hero',
      link_url: '/tournament/live',
    })

    trackOutboundClick({
      link_url: 'https://discord.gg/duelistsunite',
      link_text: 'Discord',
      link_location: 'footer',
    })

    expect(window.dataLayer).toEqual([
      {
        event: 'cta_click',
        cta_name: 'Live Tournament',
        cta_location: 'home_hero',
        link_url: '/tournament/live',
      },
      {
        event: 'outbound_click',
        link_url: 'https://discord.gg/duelistsunite',
        link_text: 'Discord',
        link_location: 'footer',
      },
    ])
  })
})
