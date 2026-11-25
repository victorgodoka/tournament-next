import { MediaCard } from '@omega-hub/ds'
import type { WikiArticlePreview } from '@utils/wiki-article-preview'
import { coverUrl } from './article'

/** An `[article=slug]` card inside a post: opens the other article in a new tab. */
export const ArticlePreview = ({ slug, article }: { slug: string; article?: WikiArticlePreview | null }) => (
  <MediaCard
    href={`/wiki/${article?.slug ?? slug}`}
    target="_blank"
    layout="row"
    size="sm"
    ratio="4 / 3"
    accent="cyan"
    image={coverUrl(article?.cover, 176)}
    imageAlt={article?.cover?.alt || ''}
    className="clear-both my-5"
    eyebrow={<span className="text-cyan">Wiki article ↗</span>}
    title={article?.title ?? slug}
    titleAs="span"
  >
    {article?.summary ? article.summary : !article ? <span className="text-ink-muted">Preview unavailable</span> : null}
  </MediaCard>
)
