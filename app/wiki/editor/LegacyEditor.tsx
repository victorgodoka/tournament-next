'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { WIKI_PAD } from '@omega/wiki'
import { buttonClasses } from '@ui/button'
import type { Article } from '@utils/types'
import { docFromMarkdown, type WikiDoc } from '@utils/wiki-doc'
import { ArticleForm } from '../ArticleForm'
import { DocEditor } from './DocEditor'

/**
 * A Markdown article: the text form as before, plus a way into the block editor. Converting only
 * happens here in the browser; the article becomes a block article when the converted doc is saved.
 * `children` is the page heading, shown above the text form only (the block editor has its own bar).
 */
export const LegacyEditor = ({ article, children }: { article: Article; children?: React.ReactNode }) => {
  const [doc, setDoc] = useState<WikiDoc | null>(null)

  if (doc) return <DocEditor article={{ ...article, doc }} converted />

  return (
    <div className={twMerge('py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
      {children}
      <div className="mb-7 flex max-w-[80ch] flex-wrap items-center gap-3 border border-line bg-ground-soft px-4.5 py-3.5">
        <p className="min-w-0 flex-1 text-ink-dim body-sm">
          This article is plain Markdown. Convert it to blocks to add images, galleries, cards, videos, FAQs and SEO settings.
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
    </div>
  )
}
