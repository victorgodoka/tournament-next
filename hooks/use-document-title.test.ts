import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDocumentTitle } from './use-document-title'

describe('useDocumentTitle', () => {
  it('sets the document title with the site name', () => {
    document.title = 'Previous Title'

    const { unmount } = renderHook(() => useDocumentTitle('Leaderboards'))

    expect(document.title).toBe('Leaderboards | YGO Omega')

    unmount()

    expect(document.title).toBe('Previous Title')
  })

  it('uses only the site name when title is empty', () => {
    document.title = 'Previous Title'

    const { unmount } = renderHook(() => useDocumentTitle(''))

    expect(document.title).toBe('YGO Omega')

    unmount()
  })
})
