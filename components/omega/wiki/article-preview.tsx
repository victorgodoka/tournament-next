import Image from 'next/image'
import type { WikiArticlePreview } from '@utils/wiki-article-preview'
import { NEW_TAB, WIKI_TILE } from './wiki'

export const ArticlePreview = ({ slug, article }: { slug: string; article?: WikiArticlePreview | null }) => (
  <a href={`/wiki/${article?.slug ?? slug}`} {...NEW_TAB} className={`${WIKI_TILE} clear-both my-5 flex items-center gap-4 p-3 text-ink hover:text-ink sm:gap-5 sm:p-4`}>
    {article?.cover ? <span className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden bg-surface-200 sm:w-36">
      <Image src={article.cover.src} alt={article.cover.alt || article.title} fill unoptimized={article.cover.src.startsWith('https://res.cloudinary.com/')} sizes="144px" className="object-cover" />
    </span> : null}
    <span className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-cyan signal-sm">Wiki article ↗</span>
      <span className="text-xl/[1.1] display-3 sm:text-2xl">{article?.title ?? slug}</span>
      {article?.summary ? <span className="line-clamp-3 text-ink-dim body-sm">{article.summary}</span> : !article ? <span className="text-ink-muted body-sm">Preview unavailable</span> : null}
    </span>
  </a>
)
