import { describe, expect, it } from 'vitest'
import { createComment, render, screen } from '@test/test-utils'
import CommentComponent from './comment.component'
import { buildCommentTree } from '@lib/comment.utils'

describe('CommentComponent', () => {
  it('renders the Discord display name, handle and body', () => {
    const [comment] = buildCommentTree([createComment()])
    render(<CommentComponent comment={comment!} />)

    expect(screen.getByText('Test Duelist')).toBeInTheDocument()
    expect(screen.getByText('@duelist')).toBeInTheDocument()
    expect(screen.getByText('Great deck!')).toBeInTheDocument()
  })

  it('falls back to the username when there is no display name', () => {
    const [comment] = buildCommentTree([
      createComment({
        user: {
          discord_id: 'user-2',
          username: 'handleonly',
          avatar: null,
          displayname: null,
        },
      }),
    ])
    render(<CommentComponent comment={comment!} />)

    expect(screen.getByText('handleonly')).toBeInTheDocument()
  })

  it('nests replies chained via parent_id', () => {
    const [root] = buildCommentTree([
      createComment({ id: 1, comment: 'Parent comment', parent_id: null }),
      createComment({
        id: 2,
        comment: 'Reply comment',
        parent_id: 1,
        user: {
          discord_id: 'user-2',
          username: 'replier',
          avatar: null,
          displayname: 'The Replier',
        },
      }),
    ])
    render(<CommentComponent comment={root!} />)

    // Both the parent and its threaded reply render from a single top-level node.
    expect(screen.getByText('Parent comment')).toBeInTheDocument()
    expect(screen.getByText('Reply comment')).toBeInTheDocument()
    expect(screen.getByText('The Replier')).toBeInTheDocument()
  })

  it('marks a comment as edited when updated after creation', () => {
    const [comment] = buildCommentTree([
      createComment({
        created_at: '2026-07-12T04:31:03.000Z',
        updated_at: '2026-07-13T04:31:03.000Z',
      }),
    ])
    render(<CommentComponent comment={comment!} />)

    expect(screen.getByText('(edited)')).toBeInTheDocument()
  })
})

describe('buildCommentTree', () => {
  it('groups replies under their parent and sorts each level oldest-first', () => {
    const tree = buildCommentTree([
      createComment({ id: 2, parent_id: null, created_at: '2026-07-12T10:00:00.000Z' }),
      createComment({ id: 1, parent_id: null, created_at: '2026-07-12T09:00:00.000Z' }),
      createComment({ id: 3, parent_id: 1, created_at: '2026-07-12T09:30:00.000Z' }),
    ])

    expect(tree.map((node) => node.id)).toEqual([1, 2])
    expect(tree[0]!.replies.map((node) => node.id)).toEqual([3])
    expect(tree[1]!.replies).toEqual([])
  })

  it('promotes orphaned replies (missing parent) to top level', () => {
    const tree = buildCommentTree([
      createComment({ id: 5, parent_id: 999 }),
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0]!.id).toBe(5)
  })
})
