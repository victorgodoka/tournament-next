'use client'

import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { deleteCombo, getCombo, listMyCombos, type ComboSummary, type SharedCombo } from '@utils/combos'
import { TOUCH } from './toolbar'

type MyCombosProps = {
  open: boolean
  onClose(): void
  /** The combo as the server holds it now: the simulator decides whether and how it loads, and closes the list when it does. */
  onOpen(combo: SharedCombo): void
  /** A combo was deleted: a session tied to it lets go. */
  onDeleted(id: string): void
}

/** The signed-in user's saved combos (`GET /combos/mine`), to open or delete. */
export const MyCombos = ({ open, onClose, onOpen, onDeleted }: MyCombosProps) => {
  const t = useTranslations('Simulator')
  return (
    <Dialog open={open} onClose={onClose} title={t('myCombos.title')}>
      <ComboList onOpen={onOpen} onDeleted={onDeleted} />
    </Dialog>
  )
}

type Page = { combos: ComboSummary[]; cursor: string | null; status: 'loading' | 'idle' | 'failed' }

/** No cursor: the first page, replacing the list. */
const fetchPage = (setPage: React.Dispatch<React.SetStateAction<Page>>, cursor?: string) =>
  listMyCombos(cursor).then(
    (r) => setPage((prev) => ({ combos: cursor ? [...prev.combos, ...r.combos] : r.combos, cursor: r.nextCursor, status: 'idle' })),
    () => setPage((prev) => ({ ...prev, status: 'failed' })),
  )

/**
 * Mounted each time the dialog opens (the dialog renders nothing closed), so every opening reads a fresh first page.
 * Delete confirms in its row: a second `<dialog>` in here would close this one when it closes, since React hands a
 * `close` to the `onClose` of every dialog above it.
 */
const ComboList = ({ onOpen, onDeleted }: Pick<MyCombosProps, 'onOpen' | 'onDeleted'>) => {
  const t = useTranslations('Simulator')
  const format = useFormatter()
  const now = useNow()
  const [page, setPage] = useState<Page>({ combos: [], cursor: null, status: 'loading' })
  /** The combo being fetched to open, the row asking to confirm its delete, and a delete on its way. */
  const [opening, setOpening] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** Why the last Open or Delete did not happen: the combo is gone, or the server did not answer. */
  const [problem, setProblem] = useState<'gone' | 'openFailed' | 'deleteFailed' | null>(null)
  const list = useRef<HTMLUListElement>(null)
  /** False once the dialog closes: a combo that arrives after that must not replace a session the player went on with. */
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    fetchPage(setPage)
    return () => {
      mounted.current = false
    }
  }, [])

  const more = () => {
    setPage((prev) => ({ ...prev, status: 'loading' }))
    // A failed first page has no cursor: retry it.
    fetchPage(setPage, page.cursor ?? undefined)
  }
  const drop = (id: string) => setPage((prev) => ({ ...prev, combos: prev.combos.filter((c) => c.id !== id) }))

  /** An open or a delete is on its way: Open and Delete wait, so a delete never lands on a session that has since opened another combo. */
  const busy = opening !== null || deleting

  const load = async (id: string) => {
    if (busy) return
    setOpening(id)
    setProblem(null)
    try {
      const combo = await getCombo(id)
      if (!mounted.current) return
      if (combo) return onOpen(combo)
      setProblem('gone')
      drop(id)
    } catch {
      if (mounted.current) setProblem('openFailed')
    } finally {
      if (mounted.current) setOpening(null)
    }
  }

  const remove = (id: string) => {
    setDeleting(true)
    setProblem(null)
    deleteCombo(id).then(
      () => {
        setDeleting(false)
        setConfirm(null)
        drop(id)
        // The button that was focused goes away with the row: the list takes the focus instead.
        list.current?.focus()
        onDeleted(id)
      },
      () => {
        setDeleting(false)
        setProblem('deleteFailed')
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {problem ? <Alert tone={problem === 'gone' ? 'warn' : 'negative'} edged title={t(`myCombos.${problem}`)} /> : null}

      {/* Always mounted: it takes the focus after a delete, even of the last row. */}
      <ul ref={list} tabIndex={-1} aria-label={t('myCombos.title')} className="flex flex-col outline-none">
        {page.combos.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-b-0">
            {confirm === c.id ? (
              <>
                <p className="min-w-0 flex-1 basis-60 text-ink body">{t('myCombos.deleteBody', { name: c.title })}</p>
                <Button size="sm" variant="secondary" autoFocus onClick={() => setConfirm(null)} className={TOUCH}>
                  {t('myCombos.cancel')}
                </Button>
                <Button size="sm" variant="danger" aria-disabled={busy || undefined} onClick={() => !busy && remove(c.id)} className={TOUCH}>
                  {t('myCombos.delete')}
                </Button>
              </>
            ) : (
              <>
                <span className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
                  <span className="truncate text-ink body-strong">{c.title}</span>
                  <span className="truncate text-ink-muted signal-sm">
                    {[c.deckName, t('myCombos.steps', { count: c.steps }), format.relativeTime(new Date(c.updatedAt), now)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-disabled={busy || undefined}
                  onClick={() => void load(c.id)}
                  aria-label={t('myCombos.openNamed', { name: c.title })}
                  className={TOUCH}
                >
                  {t('myCombos.open')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-disabled={busy || undefined}
                  onClick={() => {
                    if (busy) return
                    setProblem(null)
                    setConfirm(c.id)
                  }}
                  aria-label={t('myCombos.deleteNamed', { name: c.title })}
                  className={TOUCH}
                >
                  {t('myCombos.delete')}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {!page.combos.length && page.status === 'idle' ? <p className="text-ink-muted body">{t('myCombos.empty')}</p> : null}

      {page.status === 'loading' ? (
        <p role="status" className="text-ink-muted body">{t('myCombos.loading')}</p>
      ) : page.status === 'failed' ? (
        <Alert tone="negative" edged title={t('myCombos.failed')} action={<Button variant="secondary" size="sm" onClick={more} className={TOUCH}>{t('retry')}</Button>} />
      ) : page.cursor ? (
        <Button variant="secondary" onClick={more} className={twMerge('self-center', TOUCH)}>
          {t('myCombos.more')}
        </Button>
      ) : null}
    </div>
  )
}
