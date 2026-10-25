// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@utils/auth'
import { WikiApiError, deleteComment, postComment } from '@utils/articles'
import type { WikiComment, WikiThread, WikiUser } from '@utils/types'
import { Comments, forArticle } from './comments'

vi.mock('next/image', () => ({ default: () => null }))
// The real one needs next-intl's provider.
vi.mock('@omega/profile/local-time', () => ({ LocalTime: ({ iso }: { iso: string }) => iso }))
vi.mock('@utils/articles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@utils/articles')>()),
  postComment: vi.fn(),
  deleteComment: vi.fn(async () => undefined),
}))
let auth: { user: AuthUser | null | undefined } = { user: null }
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: () => auth }))

const person = (id: string, username: string): WikiUser => ({ id, username, avatarUrl: null, cosmetics: {} })
const signedIn = (id: string, permissions: AuthUser['permissions'] = []): AuthUser => ({
  id,
  status: 'ACTIVE',
  role: 'USER',
  permissions,
  profile: { username: `user ${id}`, avatarUrl: null },
  createdAt: '2026-10-01T00:00:00.000Z',
  cosmetics: {},
  isVip: false,
})
const comment = (id: string, author: WikiUser | null, body: string, extra: Partial<WikiComment> = {}): WikiComment => ({
  id,
  parentId: null,
  author,
  body,
  createdAt: '2026-10-21T12:00:00.000Z',
  deleted: false,
  ...extra,
})
const thread = (c: WikiComment, replies: WikiComment[] = []): WikiThread => ({ ...c, replies })

const ana = person('1', 'ana')
const bo = person('2', 'bo')

beforeEach(() => {
  vi.mocked(postComment).mockReset()
  vi.mocked(deleteComment).mockClear()
})
afterEach(cleanup)

describe('Comments', () => {
  it('says so when the comments could not load', () => {
    render(<Comments {...forArticle('guide')} initial={null} />)
    expect(screen.getByText("Comments couldn't load. Reload the page in a moment.")).toBeTruthy()
  })

  it('asks a signed-out reader to sign in instead of showing a composer', () => {
    auth = { user: null }
    render(<Comments {...forArticle('guide')} initial={[]} />)
    expect(screen.getByRole('link', { name: 'Sign in to comment' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('posts once on a double click, then lists the comment', async () => {
    auth = { user: signedIn('1') }
    let answer!: (value: WikiComment) => void
    vi.mocked(postComment).mockReturnValue(new Promise((resolve) => (answer = resolve)))
    render(<Comments {...forArticle('guide')} initial={[]} />)

    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: '  hi  ' } })
    const post = screen.getByRole('button', { name: 'Post' })
    fireEvent.click(post)
    fireEvent.click(post)
    answer(comment('9', ana, 'hi'))

    await waitFor(() => expect(screen.getByText('hi')).toBeTruthy())
    expect(postComment).toHaveBeenCalledTimes(1)
    expect(postComment).toHaveBeenCalledWith('guide', 'hi')
  })

  it('shows HTML and Markdown as the literal text', () => {
    auth = { user: null }
    const { container } = render(<Comments {...forArticle('guide')} initial={[thread(comment('1', ana, '<b>x</b>\n**y**'))]} />)
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>x</b>\n**y**')
  })

  it('keeps a deleted thread that still has a reply', () => {
    auth = { user: null }
    render(<Comments {...forArticle('guide')} initial={[thread(comment('1', null, '', { deleted: true }), [comment('2', bo, 'still here', { parentId: '1' })])]} />)
    expect(screen.getByText('Comment deleted')).toBeTruthy()
    expect(screen.getByText('still here')).toBeTruthy()
  })

  it('offers Delete to the author and to an editor, not to anyone else', () => {
    const initial = [thread(comment('1', ana, 'mine'))]
    auth = { user: signedIn('1') }
    render(<Comments {...forArticle('guide')} initial={initial} />)
    expect(screen.queryAllByRole('button', { name: 'Delete' })).toHaveLength(1)

    cleanup()
    auth = { user: signedIn('3', ['wiki.write']) }
    render(<Comments {...forArticle('guide')} initial={initial} />)
    expect(screen.queryAllByRole('button', { name: 'Delete' })).toHaveLength(1)

    cleanup()
    auth = { user: signedIn('3') }
    render(<Comments {...forArticle('guide')} initial={initial} />)
    expect(screen.queryAllByRole('button', { name: 'Delete' })).toHaveLength(0)
  })

  it('shows the API rule when a reply is refused', async () => {
    auth = { user: signedIn('2') }
    vi.mocked(postComment).mockRejectedValue(new WikiApiError(400, 'BAD_REQUEST', 'that comment was deleted'))
    render(<Comments {...forArticle('guide')} initial={[thread(comment('1', ana, 'question'))]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    fireEvent.change(screen.getByLabelText('Reply to ana'), { target: { value: 'answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))

    await waitFor(() => expect(screen.getByText('that comment was deleted')).toBeTruthy())
    expect(postComment).toHaveBeenCalledWith('guide', 'answer', '1')
  })
})
