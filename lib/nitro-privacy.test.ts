import { afterEach, describe, expect, it, vi } from 'vitest'
import { refreshCcpaOptOutLink, refreshConsentManagementLink } from './nitro-privacy'

afterEach(() => {
  delete window.__uspapi
  delete window.__cmp
})

describe('refreshCcpaOptOutLink', () => {
  it('calls __uspapi to re-add the opt-out link when available', () => {
    const uspapi = vi.fn()
    window.__uspapi = uspapi

    refreshCcpaOptOutLink()

    expect(uspapi).toHaveBeenCalledWith('addLink', 1)
  })

  it('does not throw when __uspapi is unavailable', () => {
    expect(() => refreshCcpaOptOutLink()).not.toThrow()
  })
})

describe('refreshConsentManagementLink', () => {
  it('calls __cmp to re-add the consent link when available', () => {
    const cmp = vi.fn()
    window.__cmp = cmp

    refreshConsentManagementLink()

    expect(cmp).toHaveBeenCalledWith('addConsentLink')
  })

  it('does not throw when __cmp is unavailable', () => {
    expect(() => refreshConsentManagementLink()).not.toThrow()
  })
})
