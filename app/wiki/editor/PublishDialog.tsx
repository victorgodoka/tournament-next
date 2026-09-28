'use client'

import type { WikiDoc } from '@utils/wiki-doc'
import type { SeoCheck, SeoTarget } from '@utils/wiki-seo'
import { CheckRow, SerpPreview } from './SeoRail'
import { Badge } from './ui'

type PublishDialogProps = {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  doc: WikiDoc
  slug: string
  hubTitle?: string
  crumbs: string[]
  /** Server rules (`validateDoc` and the address): publishing is off while any are left. */
  blockers: string[]
  checks: SeoCheck[]
  busy: boolean
  error: string | null
  onGo: (to: SeoTarget) => void
  onPublish: () => void
}

const Stat = ({ label, value, note, className }: { label: string; value: number; note: string; className: string }) => (
  <div className="bg-surface-100 px-6 py-4.5">
    <p className="text-ink-muted signal-sm">{label}</p>
    <p className={`mt-2 text-[40px] stat ${className}`}>{value}</p>
    <p className="mt-1.5 text-ink-muted caption">{note}</p>
  </div>
)

/** Before it goes live: what the server will refuse, kept apart from what only hurts ranking. */
export const PublishDialog = ({ dialogRef, doc, slug, hubTitle, crumbs, blockers, checks, busy, error, onGo, onPublish }: PublishDialogProps) => {
  const fix = checks.filter((check) => check.level === 'fix')
  const warn = checks.filter((check) => check.level === 'warn')
  const pass = checks.filter((check) => check.level === 'pass')
  const close = () => dialogRef.current?.close()
  const go = (to: SeoTarget) => {
    close()
    onGo(to)
  }
  const indexed = !doc.seo?.noindex

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="publish-title"
      onClick={(event) => event.target === event.currentTarget && close()}
      className="m-auto mt-16 max-h-[calc(100dvh-5rem)] w-[min(760px,calc(100vw-32px))] max-w-none overflow-y-auto bg-transparent p-0 text-ink backdrop:bg-scrim backdrop:backdrop-blur-[10px]"
    >
      <div className="cut notch shadow-lift [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)]">
      <div className="border-b border-line px-8 pt-7 pb-5">
        <p className="flex items-center gap-2 text-ink-muted signal">
          <span aria-hidden className="size-2 bg-gold" />
          Before it goes live
        </p>
        <h2 id="publish-title" className="mt-3 text-ink display-2">
          Publish {doc.title || 'this article'}?
        </h2>
        <p className="mt-2.5 text-ink-dim body">
          It goes live at <span className="text-ink data">/wiki/{slug || '…'}</span>
          {hubTitle ? `, joins the ${hubTitle} hub` : ''}
          {indexed ? ' and the sitemap, and search engines can index it.' : '. It stays out of the sitemap: noindex is on.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
        <Stat label="Blockers" value={blockers.length} note="Server rules · must be 0" className={blockers.length ? 'text-crimson-lift' : 'text-win'} />
        <Stat label="Hurts ranking" value={fix.length} note="Worth fixing now" className={fix.length ? 'text-loss' : 'text-win'} />
        <Stat label="Nice to fix" value={warn.length} note="Fine to publish" className={warn.length ? 'text-gold' : 'text-win'} />
      </div>

      <ul className="flex flex-col px-8 py-2">
        {blockers.map((problem) => (
          <li key={problem} className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5 border-b border-line py-3.5">
            <Badge level="block" />
            <p className="text-ink body-sm">{problem}</p>
          </li>
        ))}
        {[...fix, ...warn].map((check) => (
          <li key={check.id} className="border-b border-line py-3.5">
            <CheckRow check={check} onGo={go} />
          </li>
        ))}
        {pass.length ? (
          <li className="flex items-center gap-3.5 py-3.5">
            <Badge level="pass" className="w-12 shrink-0" />
            <p className="text-ink-dim body-sm">
              {pass.length} more: {pass.map((check) => check.text.toLowerCase()).join(', ')}.
            </p>
          </li>
        ) : null}
      </ul>

      <div className="mx-8 border border-line bg-surface-200 p-4">
        <p className="mb-2 text-ink-muted signal-sm">In search</p>
        <SerpPreview doc={doc} crumbs={crumbs} />
      </div>

      <p aria-live="polite" role={error ? 'alert' : undefined} className="mx-8 mt-3 text-loss body-sm empty:hidden">
        {error ?? ''}
      </p>

      <div className="flex flex-wrap items-center gap-3 px-8 pt-6 pb-7">
        <p className="min-w-0 flex-1 text-ink-muted caption">Publishing stamps the go-live date once. Unpublishing later keeps it.</p>
        <button type="button" onClick={close} className="cut min-h-9.5 cursor-pointer px-4 text-ink signal-strong [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)]">
          Back to editing
        </button>
        <button
          type="button"
          disabled={busy || blockers.length > 0}
          onClick={onPublish}
          className="cut min-h-10 cursor-pointer px-5.5 text-cyan-on signal-strong drop-shadow-[4px_4px_0_var(--color-azure)] [--edge:var(--color-cyan)] [--fill:var(--color-cyan)] hover:translate-0.5 hover:drop-shadow-[2px_2px_0_var(--color-azure)] disabled:cursor-not-allowed disabled:text-ink-muted disabled:drop-shadow-none disabled:[--edge:var(--color-line-mid)] disabled:[--fill:var(--color-surface-100)]"
        >
          {busy ? 'Publishing…' : 'Publish now'}
        </button>
      </div>
      </div>
    </dialog>
  )
}
