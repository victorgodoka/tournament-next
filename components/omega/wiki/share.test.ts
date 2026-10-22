import { describe, expect, it } from 'vitest'
import { shareLinks } from './share'

describe('shareLinks', () => {
  const links = shareLinks('https://site.gg/wiki/a-b?x=1', 'Blue-Eyes & friends')

  it('offers X, Facebook, Reddit and WhatsApp, in that order', () => {
    expect(links.map((link) => link.id)).toEqual(['x', 'facebook', 'reddit', 'whatsapp'])
  })

  it('encodes the address and the title', () => {
    expect(links[0]!.href).toBe('https://x.com/intent/post?url=https%3A%2F%2Fsite.gg%2Fwiki%2Fa-b%3Fx%3D1&text=Blue-Eyes%20%26%20friends')
    expect(links[1]!.href).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fsite.gg%2Fwiki%2Fa-b%3Fx%3D1')
    expect(links[2]!.href).toBe('https://www.reddit.com/submit?url=https%3A%2F%2Fsite.gg%2Fwiki%2Fa-b%3Fx%3D1&title=Blue-Eyes%20%26%20friends')
    expect(links[3]!.href).toBe('https://wa.me/?text=Blue-Eyes%20%26%20friends%20https%3A%2F%2Fsite.gg%2Fwiki%2Fa-b%3Fx%3D1')
  })
})
