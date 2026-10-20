// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsentManagementLink } from './consent-link'

afterEach(() => {
  cleanup()
  delete window.__cmp
})

describe('ConsentManagementLink', () => {
  it('renders the ncmp-consent-link container NitroPay injects into', () => {
    const { container } = render(<ConsentManagementLink />)

    expect(container.querySelector('#ncmp-consent-link')).toBeTruthy()
  })

  it('re-triggers the consent link injection on mount when __cmp is available', () => {
    const cmp = vi.fn()
    window.__cmp = cmp

    render(<ConsentManagementLink />)

    expect(cmp).toHaveBeenCalledWith('addConsentLink')
  })

  it('does not throw when __cmp is unavailable', () => {
    expect(() => render(<ConsentManagementLink />)).not.toThrow()
  })
})
