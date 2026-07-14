import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CcpaOptOutLink from './ads.ccpa-link.component'

afterEach(() => {
  delete window.__uspapi
})

describe('CcpaOptOutLink', () => {
  it('renders the data-ccpa-link marker NitroPay scans for', () => {
    const { container } = render(<CcpaOptOutLink />)

    expect(container.querySelector('[data-ccpa-link="1"]')).toBeInTheDocument()
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
