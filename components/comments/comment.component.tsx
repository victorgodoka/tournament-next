import { discordAvatar } from '@assets/discord.avatar'
import AvatarComponent from '../avatar/avatar.component'
import type { CommentNode } from '@lib/comment.utils'
import {
  formatAbsoluteTime,
  formatRelativeTime,
  getCommentAuthorName,
} from '@lib/comment.utils'
import './comment.styles.css'

/** Deepest level that still gets its own indent + thread line; deeper replies stay flush. */
const MAX_DEPTH = 4

type CommentComponentProps = {
  comment: CommentNode
  /** Nesting level — 0 for a top-level comment. */
  depth?: number
}

const CommentComponent = ({ comment, depth = 0 }: CommentComponentProps) => {
  const { user } = comment
  const authorName = getCommentAuthorName(user)
  const avatarSrc = discordAvatar(user.discord_id, user.avatar ?? '')
  const relativeTime = formatRelativeTime(comment.created_at)
  const isEdited = comment.updated_at !== comment.created_at
  const hasReplies = comment.replies.length > 0
  const repliesFlat = depth + 1 >= MAX_DEPTH

  return (
    <article className="comment">
      <div className="comment__avatar">
        <AvatarComponent src={avatarSrc} alt={authorName} size="md" />
      </div>

      <div className="comment__main">
        <header className="comment__meta">
          <span className="comment__author">{authorName}</span>
          {user.username ? (
            <span className="comment__handle">@{user.username}</span>
          ) : null}
          {relativeTime ? (
            <>
              <span className="comment__separator" aria-hidden="true">
                ·
              </span>
              <time
                className="comment__time"
                dateTime={comment.created_at}
                title={formatAbsoluteTime(comment.created_at)}
              >
                {relativeTime}
              </time>
            </>
          ) : null}
          {isEdited ? <span className="comment__edited">(edited)</span> : null}
        </header>

        <p className="comment__body">{comment.comment}</p>

        {hasReplies ? (
          <div
            className={
              repliesFlat
                ? 'comment__replies comment__replies--flat'
                : 'comment__replies'
            }
          >
            {comment.replies.map((reply) => (
              <CommentComponent key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default CommentComponent
