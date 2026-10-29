'use client'

import { useId } from 'react'
import { twMerge } from 'tailwind-merge'
import { outline, toAnchor, type WikiDoc } from '@utils/wiki-doc'
import { SNIPPET_CHARS, TITLE_PX, clip, hasKeyword, plainText, searchDescription, searchTitle, titlePixels, type SeoCheck, type SeoTarget } from '@utils/wiki-seo'
import { Badge, FieldHead, Frame, Help, INPUT, Pill } from './ui'

/** Where the focus keyword shows up in the header and the first paragraph. */
const keywordSpots = (doc: WikiDoc, slug: string, keyword: string) => {
  const first = doc.blocks.find((block) => block.type === 'text')
  return [
    { label: 'Title', found: hasKeyword(doc.title, keyword) },
    { label: 'Summary', found: hasKeyword(searchDescription(doc), keyword) },
    { label: 'Address', found: !!keyword && slug.includes(toAnchor(keyword)) },
    { label: '1st paragraph', found: first?.type === 'text' && hasKeyword(plainText(first.md), keyword) },
    { label: 'H2', found: outline(doc).some((heading) => heading.level === 2 && hasKeyword(heading.text, keyword)) },
  ]
}

/** The Google result, approximated. `crumbs` is the breadcrumb path after the site. */
export const SerpPreview = ({ doc, crumbs, narrow, faq }: { doc: WikiDoc; crumbs: string[]; narrow?: boolean; faq?: boolean }) => {
  const questions = faq ? doc.blocks.flatMap((block) => (block.type === 'faq' ? block.items.map((item) => item.q).filter(Boolean) : [])).slice(0, 3) : []
  return (
    <div className={twMerge('bg-ink p-4 font-[arial,sans-serif] text-[#202124]', narrow && 'mx-auto max-w-90')}>
      <p className="text-[12px] leading-4.5 text-[#4d5156]">{['ygoomega', 'wiki', ...crumbs].join(' › ')}</p>
      <p className={twMerge('mt-1 text-[#1a0dab]', narrow ? 'text-[16px] leading-5.5' : 'text-[18px] leading-5.75')}>{clip(searchTitle(doc), 70)}</p>
      <p className="mt-1 text-[13px] leading-5 text-[#4d5156]">{clip(searchDescription(doc)) || 'No description yet: search picks a sentence from the page.'}</p>
      {questions.length ? (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[#dadce0] pt-2">
          {questions.map((question) => (
            <p key={question} className="text-[13px] leading-4.5">
              {question} <span className="text-[#4d5156]">⌄</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** One to-do row: badge, text, and the link to where it gets fixed. */
export const CheckRow = ({ check, onGo, compact }: { check: SeoCheck; onGo: (to: SeoTarget) => void; compact?: boolean }) => (
  <div className={twMerge('grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5', compact && 'items-center')}>
    <Badge level={check.level} />
    <div className="min-w-0">
      <p className={twMerge('body-sm', check.level === 'pass' ? 'text-ink-dim' : 'text-ink')}>{check.text}</p>
      {check.go && !compact ? (
        <button type="button" onClick={() => onGo(check.go!.to)} className="mt-1.5 cursor-pointer text-cyan signal-sm hover:text-ink">
          {check.go.label}
        </button>
      ) : null}
    </div>
  </div>
)

type SeoRailProps = {
  doc: WikiDoc
  slug: string
  crumbs: string[]
  checks: SeoCheck[]
  score: number
  onKeyword: (keyword: string) => void
  onGo: (to: SeoTarget) => void
}

/** The rail's default tab: score, focus keyword, the result preview and what to fix. */
export const SeoRail = ({ doc, slug, crumbs, checks, score, onKeyword, onGo }: SeoRailProps) => {
  const id = useId()
  const keyword = doc.seo?.keyword ?? ''
  const pass = checks.filter((check) => check.level === 'pass')
  const warn = checks.filter((check) => check.level === 'warn')
  const fix = checks.filter((check) => check.level === 'fix')
  const todo = [...fix, ...warn]
  const titlePx = titlePixels(searchTitle(doc))
  const description = searchDescription(doc)

  return (
    <div className="flex flex-col">
      <div className="border-b border-line p-5">
        <p className="flex items-center gap-2 text-ink-muted signal">
          <span aria-hidden className={twMerge('size-2', fix.length ? 'bg-loss' : warn.length ? 'bg-gold' : 'bg-win')} />
          Search readiness
        </p>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-[56px] text-ink stat-lg">{score}</span>
          <span className="text-ink-muted stat">/100</span>
        </p>
        <div aria-hidden className="mt-3.5 flex h-2 gap-0.5">
          <span className="rounded-xs bg-win" style={{ flexGrow: pass.length }} />
          <span className="rounded-xs bg-gold" style={{ flexGrow: warn.length }} />
          <span className="rounded-xs bg-loss" style={{ flexGrow: fix.length }} />
        </div>
        <p className="mt-2.5 flex gap-4 signal-sm">
          <span className="text-win">{pass.length} pass</span>
          <span className="text-gold">{warn.length} warn</span>
          <span className="text-loss">{fix.length} fix</span>
        </p>
        <p className="mt-3 text-ink-dim body-sm">
          {fix.length
            ? `Publishable. ${fix.length === 1 ? 'One issue hurts' : `${fix.length} issues hurt`} how the page ranks or looks when shared.`
            : warn.length
              ? 'Publishable. A few things are worth a look.'
              : 'Ready for search.'}
        </p>
      </div>

      <div className="border-b border-line p-5">
        <FieldHead htmlFor={id} label="Focus keyword" />
        <Frame>
          <input id={id} value={keyword} maxLength={60} placeholder="e.g. sky striker" onChange={(event) => onKeyword(event.target.value)} className={twMerge(INPUT, 'body')} />
        </Frame>
        <Help>The search you want this page to answer. Only one article should own it.</Help>
        {keyword.trim() ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {keywordSpots(doc, slug, keyword).map((spot) => (
              <Pill key={spot.label} tone={spot.found ? 'cyan' : 'warn'}>
                {spot.label} {spot.found ? '✓' : '✕'}
              </Pill>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-b border-line p-5">
        <p className="text-ink-muted signal">Search result preview</p>
        <div className="mt-3">
          <SerpPreview doc={doc} crumbs={crumbs} />
        </div>
        <div className="mt-2 flex justify-between gap-3 signal-sm">
          <span className={titlePx > TITLE_PX ? 'text-gold' : 'text-win'}>
            Title {titlePx} / {TITLE_PX} px
          </span>
          <span className={description.length > SNIPPET_CHARS ? 'text-gold' : 'text-win'}>
            {description.length > SNIPPET_CHARS ? `Description cut at ${SNIPPET_CHARS}` : `Description ${description.length} chars`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 p-5">
        <p className="text-ink-muted signal">To do</p>
        {todo.length ? todo.map((check) => <CheckRow key={check.id} check={check} onGo={onGo} />) : <p className="text-ink-dim body-sm">Nothing left to fix.</p>}

        {pass.length ? (
          <details className="border-t border-line pt-3">
            <summary className="cursor-pointer text-win signal-strong">{pass.length} passed</summary>
            <ul className="mt-2.5 list-disc pl-4.5 text-ink-dim body-sm">
              {pass.map((check) => (
                <li key={check.id}>{check.text}</li>
              ))}
            </ul>
          </details>
        ) : null}

        <button
          type="button"
          onClick={() => onGo('seo')}
          className="cut mt-1 flex min-h-10 cursor-pointer items-center justify-center text-cyan signal-strong [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)] hover:text-ink"
        >
          Open SEO settings →
        </button>
      </div>
    </div>
  )
}
