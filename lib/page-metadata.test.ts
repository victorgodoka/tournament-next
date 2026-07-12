import { describe, expect, it } from 'vitest'
import { pageMetadata, noIndexMetadata } from './page-metadata'

describe('page-metadata', () => {
  it('builds metadata with a normalized canonical path', () => {
    const metadata = pageMetadata({
      title: 'Leaderboards',
      path: 'leaderboards',
    })

    expect(metadata.alternates?.canonical).toBe('/leaderboards')
    expect(metadata.openGraph?.url).toBe('/leaderboards')
    expect(metadata.title).toBe('Leaderboards')
  })

  it('uses root path for empty paths', () => {
    const metadata = pageMetadata({
      title: 'Home',
      path: '/',
    })

    expect(metadata.alternates?.canonical).toBe('/')
  })

  it('sets noindex robots when requested', () => {
    const metadata = noIndexMetadata('Profile Edit', '/profile/edit')

    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
