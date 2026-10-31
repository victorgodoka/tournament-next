'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { WIKI_CHIP } from './wiki'

type CodeBlockProps = {
  language: string
  code: string
  /** The coloured `<pre>` from `renderDocHtml`. */
  html: React.ReactNode
}

/** The language, a copy button, and the code beside its line numbers. Scrolls inside itself. */
export const CodeBlock = ({ language, code, html }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false)
  const lines = code.split('\n').length

  const copy = () =>
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }, console.error)

  return (
    <div className="border border-line bg-[#0b0e1a]">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-100 py-1.5 pr-1.5 pl-3.5">
        <span className="text-ink-muted signal-sm">{language}</span>
        <button type="button" onClick={copy} className={twMerge(WIKI_CHIP, 'min-h-7 gap-1.5 px-2.5')}>
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex overflow-x-auto font-mono text-[13px]/[21px]">
        <pre aria-hidden className="border-r border-line py-3.5 pr-2 pl-4 text-right text-[#4b5677] select-none">
          {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
        </pre>
        <div className="min-w-0 [&_pre]:my-0 [&_pre]:overflow-visible [&_pre]:border-0 [&_pre]:bg-transparent [&_pre]:px-4">{html}</div>
      </div>
    </div>
  )
}
