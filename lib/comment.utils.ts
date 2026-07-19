import type { Comment } from '../app/decks/decks.types'

/** A comment together with its nested replies, produced by {@link buildCommentTree}. */
export interface CommentNode extends Comment {
  replies: CommentNode[]
}

/**
 * Turns the flat comment list returned by the API into a reply tree.
 * Each comment is linked to its `parent_id`; comments with no parent — or
 * whose parent is missing from the list (orphans) — become top-level roots.
 * Every level is sorted oldest-first.
 */
export function buildCommentTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<number, CommentNode>()
  for (const comment of comments) {
    byId.set(comment.id, { ...comment, replies: [] })
  }

  const roots: CommentNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id != null ? byId.get(node.parent_id) : undefined
    if (parent) {
      parent.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  sortByOldest(roots)
  return roots
}

function sortByOldest(nodes: CommentNode[]): void {
  nodes.sort((a, b) => toTime(a.created_at) - toTime(b.created_at))
  for (const node of nodes) sortByOldest(node.replies)
}

function toTime(iso: string): number {
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? 0 : time
}

/** Accepts either a raw `Comment[]` or a `{ data }` envelope and returns the list. */
export function extractComments(
  payload: { data?: Comment[] } | Comment[] | null | undefined,
): Comment[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload.data) ? payload.data : []
}

/** Discord display name, falling back to the handle, then a neutral default. */
export function getCommentAuthorName(user: Comment['user']): string {
  return user.displayname || user.username || 'Unknown duelist'
}

// Hoisted formatters — constructing Intl objects is comparatively expensive,
// so we build them once at module load rather than per render.
const RELATIVE_TIME = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const ABSOLUTE_TIME = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
]

/** e.g. "3 days ago". Empty string for an unparseable date. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''

  let duration = (time - now) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE_TIME.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return ''
}

/** e.g. "Jul 12, 2026, 4:31 AM" — used for the timestamp tooltip. */
export function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : ABSOLUTE_TIME.format(date)
}
