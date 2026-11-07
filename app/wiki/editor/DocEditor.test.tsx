// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocEditor } from './DocEditor'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: () => ({ user: null }) }))
afterEach(cleanup)

describe('editor block rail', () => {
  it('shares the rail tabs, offers both new blocks and inserts an article preview', () => {
    render(<DocEditor />)
    const tabs = screen.getByRole('tablist', { name: 'Article blocks' })
    expect(within(tabs).getByRole('tab', { name: 'Outline' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('button', { name: /Statistics Deck Deck covers/ })).toBeNull()
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Add block' }))
    const panel = document.getElementById('doc-blocks-panel-add')!
    expect(within(panel).getByRole('button', { name: /Statistics Deck/ })).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: /Article Preview/ }))
    expect(screen.getByLabelText('Article slug')).toBeTruthy()
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Outline' }))
    expect(document.getElementById('doc-blocks-panel-add')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Outline' }).textContent).toContain('Article Preview')
  })
})
