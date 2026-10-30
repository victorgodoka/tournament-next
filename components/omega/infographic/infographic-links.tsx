'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@hooks/index'
import { can } from '@utils/articles'
import { download } from '@utils/download'
import type { Size } from './infographic'

/** `hrefs` are plain strings: PlayerStatistics builds them on the server, and a function cannot cross into a client component. */
type Item = { label?: string; hrefs: Record<Size, string>; file: string }

type InfographicLinksProps = {
  /** "Infographic" */
  label: string
  /** "Download this section as an image": the links' title. */
  hint: string
  /** "Rendering…": shown while the PNG is drawn. */
  busy: string
  /** "Couldn't render the image": shown after a failed fetch, until the next click. */
  failed: string
  sizes: Record<Size, string>
  items: Item[]
  className?: string
}

const LINK ='inline-flex min-h-8 items-center gap-1.5 border border-line px-2.5 text-ink-dim signal-sm transition-colors hover:border-cyan hover:text-cyan aria-busy:border-cyan aria-busy:text-cyan'

/**
 * "Infographic: 16:9 · 9:16", once per item: links to the PNG routes. A click fetches the PNG and saves it,
 * so the seconds Satori takes show as a spinner on the link instead of nothing; the `href` and `download`
 * stay for a middle click or a copied link. Admins only (`system.manage`): each render costs the server
 * a second of CPU and a burst of memory, so the public does not get a button for it.
 */
export const InfographicLinks = ({ label, hint, busy, failed, sizes, items, className }: InfographicLinksProps) => {
  const [state, setState] = useState<{ href: string; status: 'busy' | 'failed' } | null>(null)
  const { user } = useAuth()
  if (!can(user, 'system.manage')) return null

  const save = async (e: React.MouseEvent, href: string, file: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (state?.status === 'busy') return
    setState({ href, status: 'busy' })
    try {
      const res = await fetch(href)
      if (!res.ok) throw new Error(`${res.status} ${href}`)
      download(await res.blob(), file)
      setState(null)
    } catch (error) {
      console.error(error)
      setState({ href, status: 'failed' })
    }
  }

  return (
    <div className={twMerge('flex flex-wrap items-center gap-2', className)}>
      <span className="text-ink-muted signal-sm">{label}</span>
      {items.map((item) => (
        <span key={item.file} className="flex items-center gap-1">
          {item.label ? <span className="mr-1 text-ink-dim signal-sm">{item.label}</span> : null}
          {(['wide', 'tall'] as const).map((size) => {
            const href = item.hrefs[size]
            const file = `${item.file}-${size === 'wide' ? '16x9' : '9x16'}.png`
            const isBusy = state?.status === 'busy' && state.href === href
            return (
              <a key={size} href={href} download={file} title={hint} aria-busy={isBusy || undefined} onClick={(e) => save(e, href, file)} className={LINK}>
                {isBusy ? <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-cyan border-t-transparent" /> : null}
                {sizes[size]}
              </a>
            )
          })}
        </span>
      ))}
      {state ? (
        <span role="status" className={twMerge('signal-sm', state.status === 'busy' ? 'text-ink-dim' : 'text-loss')}>
          {state.status === 'busy' ? busy : failed}
        </span>
      ) : null}
    </div>
  )
}
