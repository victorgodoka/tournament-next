import { ApiResult } from "@lib/api-result";
import CommentComponent from "./comment.component";
import type { Comment, SavedDeckComments } from '@app/decks/decks.types'
import { buildCommentTree, extractComments } from "@lib/comment.utils";

const CommentsComponent = ({ commentsResult }: { commentsResult: ApiResult<SavedDeckComments> }) => {
  if (!commentsResult || !commentsResult.ok) return;
  const comments = extractComments(commentsResult.data)
  const commentTree = buildCommentTree(comments)

  return <section className="comments omega-surface" aria-labelledby="comments-heading">
    <h2 id="comments-heading" className="comments__title">
      Comments
      <span className="comments__count">{comments.length}</span>
    </h2>

    {
      commentTree.length > 0 ? (
        <div className="comments__list">
          {commentTree.map((comment) => (
            <CommentComponent key={comment.id} comment={comment} />
          ))}
        </div>
      ) : (
        <p className="comments__empty">
          No comments yet — be the first to share your thoughts.
        </p>
      )
    }
  </section>
}

export default CommentsComponent;