import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LineChart } from './chart.component'

const paths = (html: string) => [...html.matchAll(/<path d="([^"]*)" fill="none"/g)].map((m) => m[1]!)

describe('LineChart', () => {
  it('breaks the line at a null point instead of bridging it or dropping to zero', () => {
    const html = renderToStaticMarkup(<LineChart labels={['1', '2', '3', '4']} series={[{ name: 'a', data: [0.5, null, 0.6, 0.55] }]} area={false} />)
    const [d] = paths(html)
    expect(d!.match(/M/g)).toHaveLength(2)
    expect(d!.match(/L/g)).toHaveLength(1)
    // The y range comes from the real points only: 0 never enters the axis.
    expect(html).not.toContain('>0<')
  })

  it('draws an unbroken line as before', () => {
    const html = renderToStaticMarkup(<LineChart labels={['1', '2', '3']} series={[{ name: 'a', data: [0.5, 0.6, 0.55] }]} />)
    const [d] = paths(html)
    expect(d!.match(/M/g)).toHaveLength(1)
    expect(d!.match(/L/g)).toHaveLength(2)
  })
})
