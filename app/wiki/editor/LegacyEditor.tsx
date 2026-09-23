'use client'

import { useState } from 'react'
import { buttonClasses } from '@ui/button'
import type { Article } from '@utils/types'
import { docFromMarkdown, type WikiDoc } from '@utils/wiki-doc'
import { ArticleForm } from '../ArticleForm'
import { DocEditor } from './DocEditor'

/**
 * A Markdown article: the text form as before, plus a way into the block editor. Converting only
 * happens here in the browser; the article becomes a block article when the converted doc is saved.
 */
export const LegacyEditor = ({ article }: { article: Article }) => {
  const [doc, setDoc] = useState<WikiDoc | null>(null)

  if (doc) return <DocEditor article={{ ...article, doc }} converted />

  return (
    <>
      <div className="mb-7 flex max-w-[80ch] flex-wrap items-center gap-3 border border-line bg-ground-soft px-4.5 py-3.5">
        <p className="min-w-0 flex-1 text-ink-dim body-sm">
          This article is plain Markdown. Convert it to blocks to add images, galleries, cards, videos and an infobox.
        </p>
        <button
          type="button"
          onClick={() => setDoc(docFromMarkdown(article.title, article.body))}
          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
        >
          Convert to blocks
        </button>
      </div>
      <ArticleForm article={article} />
    </>
  )
}
