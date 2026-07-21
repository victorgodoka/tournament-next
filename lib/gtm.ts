import type { GtmAuthMethod, GtmEventName, GtmEventPayload } from './gtm.types'

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

export function pushGtmEvent<TEvent extends GtmEventName>(
  event: TEvent,
  params?: GtmEventPayload[TEvent],
) {
  if (typeof window === 'undefined') {
    return
  }

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({
    event,
    ...(params ?? {}),
  })
}

export function trackPageView(path: string) {
  if (typeof window === 'undefined') {
    return
  }

  pushGtmEvent('page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
  })
}

export function trackLoginStart(method: GtmAuthMethod = 'discord') {
  pushGtmEvent('login_start', { method })
}

export function trackLogin(method: GtmAuthMethod = 'discord') {
  pushGtmEvent('login', { method })
}

export function trackLoginError(
  errorMessage: string,
  method: GtmAuthMethod = 'discord',
) {
  pushGtmEvent('login_error', {
    method,
    error_message: errorMessage,
  })
}

export function trackLogout() {
  pushGtmEvent('logout')
}

export function trackCtaClick(params: GtmEventPayload['cta_click']) {
  pushGtmEvent('cta_click', params)
}

export function trackOutboundClick(params: GtmEventPayload['outbound_click']) {
  pushGtmEvent('outbound_click', params)
}
