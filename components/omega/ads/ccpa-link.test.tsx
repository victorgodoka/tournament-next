// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CcpaOptOutLink } from './ccpa-link'

afterEach(() => {
  cleanup()
  delete window.__uspapi
})

describe('CcpaOptOutLink', () => {
  it('renders the data-ccpa-link marker NitroPay scans for', () => {
    const { container } = render(<CcpaOptOutLink />)

    expect(container.querySelector('[data-ccpa-link="1"]')).toBeTruthy()
  })

  it('re-triggers the opt-out link injection on mount when __uspapi is available', () => {
    const uspapi = vi.fn()
    window.__uspapi = uspapi

    render(<CcpaOptOutLink />)

    expect(uspapi).toHaveBeenCalledWith('addLink', 1)
  })

  it('does not throw when __uspapi is unavailable', () => {
    expect(() => render(<CcpaOptOutLink />)).not.toThrow()
  })
})
