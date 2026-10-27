// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InfographicLinks } from './infographic-links'

const download = vi.hoisted(() => vi.fn())
vi.mock('@utils/download', () => ({ download }))

const props = {
  label: 'Infographic',
  hint: 'Download this section as an image',
  busy: 'Rendering the image…',
  failed: "Couldn't render the image.",
  sizes: { wide: '16:9', tall: '9:16' },
  items: [{ file: 'overview-s1', href: (size: 'wide' | 'tall') => `/statistics/infographic/overview?size=${size}` }],
}

const status = () => screen.queryByRole('status')?.textContent ?? null
const link = (label: string) => screen.getByText(label).closest('a')!

let settle: (res: Partial<Response>) => void
beforeEach(() => {
  download.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Partial<Response>>((resolve) => { settle = resolve })))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('InfographicLinks', () => {
  it('shows the link busy while the PNG renders, then saves it', async () => {
    render(<InfographicLinks {...props} />)
    fireEvent.click(link('16:9'))
    expect(link('16:9').getAttribute('aria-busy')).toBe('true')
    expect(link('9:16').getAttribute('aria-busy')).toBeNull()
    expect(status()).toBe(props.busy)
    expect(fetch).toHaveBeenCalledWith('/statistics/infographic/overview?size=wide')

    const blob = new Blob(['png'], { type: 'image/png' })
    await act(async () => settle({ ok: true, blob: async () => blob }))
    expect(download).toHaveBeenCalledWith(blob, 'overview-s1-16x9.png')
    expect(status()).toBeNull()
    expect(link('16:9').getAttribute('aria-busy')).toBeNull()
  })

  it('says so when the route fails, and lets the next click retry', async () => {
    render(<InfographicLinks {...props} />)
    fireEvent.click(link('9:16'))
    await act(async () => settle({ ok: false, status: 500 }))
    expect(download).not.toHaveBeenCalled()
    expect(status()).toBe(props.failed)

    fireEvent.click(link('9:16'))
    expect(status()).toBe(props.busy)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('leaves a modified click to the browser', () => {
    render(<InfographicLinks {...props} />)
    fireEvent.click(link('16:9'), { ctrlKey: true })
    expect(fetch).not.toHaveBeenCalled()
    expect(status()).toBeNull()
  })
})
