'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@contexts/auth/auth.context'
import { LocalTime } from '@omega/profile/local-time'
import { buttonClasses } from '@ui/button'
import { can, deleteComment, postComment, socialError } from '@utils/articles'
import type { AuthUser } from '@utils/auth'
import { setReturnTo } from '@utils/return-to'
import type { WikiComment } from '@utils/types'
import { ARTICLE_DATE_TIME, Byline, userName, type BylineUser } from './article'

const MAX = 2000
const LINK_BUTTON = 'cursor-pointer text-ink-muted signal-sm hover:text-cyan disabled:cursor-wait'
const DANGER_LINK = 'cursor-pointer text-loss signal-sm hover:underline disabled:cursor-wait'

/** A wiki comment, or a deck's: the same shape, the author without cosmetics. */
export type Comment = Omit<WikiComment, 'author'> & { author: BylineUser | null }
export type Thread = Comment & { replies: Comment[] }

/** Where the comments live: the wiki's social routes, or a deck's. */
export type CommentsApi = {
  post: (body: string, parentId?: string) => Promise<Comment>
  remove: (id: string) => Promise<void>
  /** Who may delete anyone's comment besides its author (courtesy only: the API decides). */
  canModerate: (user: AuthUser) => boolean
}

/** An article's comments: editors moderate. */
export const forArticle = (slug: string): CommentsApi => ({
  post: (body, parentId) => (parentId ? postComment(slug, body, parentId) : postComment(slug, body)),
  remove: (id) => deleteComment(slug, id),
  canModerate: (user) => can(user, 'wiki.write'),
})

type ComposerProps = {
  label: string
  submit: string
  send: (body: string) => Promise<Comment>
  onSent: (comment: Comment) => void
  onCancel?: () => void
}

/** One textarea and its Post. Nothing is optimistic: the comment shows when the API answers. */
const Composer = ({ label, submit, send, onSent, onCancel }: ComposerProps) => {
  const id = useId()
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // State lands after a render; a second click in the same tick still sees `pending` false.
  const busy = useRef(false)

  const post = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = text.trim()
    if (busy.current || !body) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      onSent(await send(body))
      setText('')
    } catch (cause) {
      console.error(cause)
      setError(socialError(cause))
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <form onSubmit={post} className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX}
        rows={3}
        placeholder={label}
        className="min-h-20 w-full resize-y border border-surface-400 bg-surface-200 px-3 py-2.5 text-ink body placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !text.trim()} className={buttonClasses({ variant: 'primary', size: 'mono' })}>
          {pending ? 'Posting…' : submit}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClasses({ variant: 'ghost', size: 'mono' })}>
            Cancel
          </button>
        ) : null}
        <span className="ml-auto text-ink-muted mono-data">
          {text.length}/{MAX}
        </span>
      </div>
      <p aria-live="polite" className="text-loss body-sm">
        {error ?? ''}
      </p>
    </form>
  )
}

type ItemProps = {
  comment: Comment
  user: AuthUser | null | undefined
  canModerate: CommentsApi['canModerate']
  onDelete: () => Promise<void>
}

const Item = ({ comment, user, canModerate, onDelete }: ItemProps) => {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (comment.deleted) return <p className="py-1 text-ink-muted italic body-sm">Comment deleted</p>

  // Courtesy only: the API checks the author or the moderator on every delete.
  const deletable = !!user && (comment.author?.id === user.id || canModerate(user))

  const remove = async () => {
    setPending(true)
    setError(null)
    try {
      await onDelete()
    } catch (cause) {
      console.error(cause)
      setError(socialError(cause))
      setPending(false)
      setConfirming(false)
    }
  }

  return (
    <article className="flex flex-col gap-1.5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted body-sm">
        <Byline user={comment.author} className="text-ink body-strong" />
        <span className="mono-data">
          <LocalTime iso={comment.createdAt} options={ARTICLE_DATE_TIME} />
        </span>
        {deletable ? (
          <span className="ml-auto flex items-center gap-3">
            {confirming ? (
              <>
                <button type="button" onClick={remove} disabled={pending} className={DANGER_LINK}>
                  {pending ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={LINK_BUTTON}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className={LINK_BUTTON}>
                Delete
              </button>
            )}
          </span>
        ) : null}
      </header>
      {/* Text, never HTML: line breaks kept, a long URL wraps instead of widening the page. */}
      <p className="whitespace-pre-line text-ink-dim body [overflow-wrap:anywhere]">{comment.body}</p>
      {error ? (
        <p role="alert" className="text-loss body-sm">
          {error}
        </p>
      ) : null}
    </article>
  )
}

/** A deleted thread stays only while a reply is left under it, as the API serves it. */
const withoutComment = (threads: Thread[], target: Comment): Thread[] =>
  threads.flatMap((thread) => {
    if (thread.id === target.id) {
      return thread.replies.length ? [{ ...thread, deleted: true, author: null, body: '' }] : []
    }
    if (thread.id !== target.parentId) return [thread]
    const replies = thread.replies.filter((reply) => reply.id !== target.id)
    return thread.deleted && !replies.length ? [] : [{ ...thread, replies }]
  })

type CommentsProps = CommentsApi & {
  /** `null`: the social API didn't answer. */
  initial: Thread[] | null
}

/** Threads newest first, one level of replies. Signed-in duelists post; authors and moderators delete. */
export const Comments = ({ initial, post, remove: removeComment, canModerate }: CommentsProps) => {
  const { user } = useAuth()
  const [threads, setThreads] = useState(initial ?? [])
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const remove = (target: Comment) => async () => {
    await removeComment(target.id)
    setThreads((current) => withoutComment(current, target))
  }

  return (
    <section id="comments" aria-labelledby="comments-head" className="mt-12 scroll-mt-24 border-t border-line pt-8">
      <h2 id="comments-head" className="text-ink display-6">
        Comments
      </h2>

      {initial === null ? (
        <p className="mt-4 text-ink-muted body-sm">Comments couldn&apos;t load. Reload the page in a moment.</p>
      ) : (
        <>
          <div className="mt-5">
            {user === null ? (
              <p className="text-ink-dim body-sm">
                <Link
                  href="/login"
                  onClick={() => setReturnTo(`${location.pathname}#comments`)}
                  className="text-cyan underline-offset-4 hover:text-ink hover:underline"
                >
                  Sign in to comment
                </Link>{' '}
                with your Omega account.
              </p>
            ) : user ? (
              <Composer
                label="Write a comment"
                submit="Post"
                send={(body) => post(body)}
                onSent={(comment) => setThreads((current) => [{ ...comment, replies: [] }, ...current])}
              />
            ) : null}
          </div>

          {threads.length ? (
            <ol className="mt-8 flex flex-col gap-6">
              {threads.map((thread) => (
                <li key={thread.id} className="flex flex-col gap-3 border-b border-line pb-6 last:border-b-0">
                  <Item comment={thread} user={user} canModerate={canModerate} onDelete={remove(thread)} />

                  {thread.replies.length ? (
                    <ol className="ml-4 flex flex-col gap-4 border-l border-line pl-4 sm:ml-6">
                      {thread.replies.map((reply) => (
                        <li key={reply.id}>
                          <Item comment={reply} user={user} canModerate={canModerate} onDelete={remove(reply)} />
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {user && !thread.deleted ? (
                    replyTo === thread.id ? (
                      <div className="ml-4 border-l border-line pl-4 sm:ml-6">
                        <Composer
                          label={`Reply to ${userName(thread.author)}`}
                          submit="Post reply"
                          send={(body) => post(body, thread.id)}
                          onSent={(reply) => {
                            setThreads((current) =>
                              current.map((t) => (t.id === thread.id ? { ...t, replies: [...t.replies, reply] } : t)),
                            )
                            setReplyTo(null)
                          }}
                          onCancel={() => setReplyTo(null)}
                        />
                      </div>
                    ) : (
                      <button type="button" onClick={() => setReplyTo(thread.id)} className={`self-start ${LINK_BUTTON}`}>
                        Reply
                      </button>
                    )
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-6 text-ink-muted body-sm">No comments yet.</p>
          )}
        </>
      )}
    </section>
  )
}
