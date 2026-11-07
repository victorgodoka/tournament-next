'use client'

import { useEffect, useId, useState } from 'react'
import { ArticlePreview } from '@omega/wiki/article-preview'
import { isArticleSlug, loadArticlePreview, type WikiArticlePreview } from '@utils/wiki-article-preview'
import { ArticlePicker } from './ArticlePicker'
import { FieldHead, Frame, Help, INPUT } from './ui'

export const ArticlePreviewFields = ({ slug, onChange }: { slug: string; onChange: (slug: string) => void }) => {
  const id = useId()
  const [answer, setAnswer] = useState<{ slug: string; article: WikiArticlePreview | null } | null>(null)
  useEffect(() => {
    if (!isArticleSlug(slug)) return
    let active = true
    const timer = setTimeout(() => {
      loadArticlePreview(slug).then((article) => { if (active) setAnswer({ slug, article }) })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [slug])
  return (
    <div className="flex flex-col gap-4">
      <ArticlePicker label="Search articles by name" exclude={[]} publishedOnly onPick={(article) => onChange(article.slug)} />
      <div>
        <FieldHead htmlFor={id} label="Article slug" />
        <Frame><input id={id} value={slug} onChange={(event) => onChange(event.target.value.trim())} placeholder="article-slug" className={INPUT} /></Frame>
        <Help>Paste the article slug, or search by name above. In text blocks, put [article=article-slug] in plain text, outside bold, italics, tables and headings.</Help>
      </div>
      {isArticleSlug(slug) ? answer?.slug === slug ? <ArticlePreview slug={slug} article={answer.article} /> : <p role="status" className="text-ink-muted body-sm">Loading article preview…</p> : null}
    </div>
  )
}
