'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { useAuth } from '@hooks/index'
import { CARD_ART_URL } from '@utils/const'
import { deleteDeck, listMyDecks, type DeckSummary } from '@utils/decks'
import { setReturnTo } from '@utils/return-to'

const TOUCH = 'max-lg:min-h-11'

type MyDecksProps = {
  open: boolean
  onClose(): void
  /** The deck open in the editor. */
  currentId: string | null
  /** Starts an empty deck. */
  onNew(): void
  /** Whether New would throw away an unsaved new deck: it asks first. Read on click. */
  newDiscards(): boolean
  onDeleted(id: string): void
  /** Deleting this deck turns the open one into the unsaved new deck over another one: the confirm says so. Read on click. */
  deleteReplacesNew(id: string): boolean
}

/** The signed-in user's saved decks (`GET /decks/mine`); signed out, a sign-in prompt that comes back here. */
export const MyDecks = (p: MyDecksProps) => {
  const t = useTranslations('DeckEditor')
  const { user } = useAuth()
  const [confirmNew, setConfirmNew] = useState(false)

  const startNew = () => {
    setConfirmNew(false)
    p.onClose()
    p.onNew()
  }

  return (
    <>
      <Dialog
        open={p.open}
        onClose={p.onClose}
        title={t('myDecks.title')}
        footer={
          user ? (
            <Button variant="secondary" onClick={() => (p.newDiscards() ? setConfirmNew(true) : startNew())} className={twMerge('ml-auto', TOUCH)}>
              {t('myDecks.new')}
            </Button>
          ) : null
        }
      >
        {user === undefined ? (
          <p role="status" className="text-ink-muted body">{t('myDecks.loading')}</p>
        ) : user ? (
          <DeckList currentId={p.currentId} onClose={p.onClose} onDeleted={p.onDeleted} deleteReplacesNew={p.deleteReplacesNew} />
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-ink body">{t('myDecks.signedOut')}</p>
            <Link href="/login" onClick={() => setReturnTo(location.pathname + location.search)} className={twMerge(buttonClasses(), TOUCH)}>
              {t('myDecks.signIn')}
            </Link>
          </div>
        )}
      </Dialog>

      <Dialog
        size="sm"
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title={t('myDecks.newTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmNew(false)} className={TOUCH}>
              {t('myDecks.cancel')}
            </Button>
            <Button variant="danger" onClick={startNew} className={TOUCH}>
              {t('myDecks.newConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-ink body">{t('myDecks.newBody')}</p>
      </Dialog>
    </>
  )
}

type Page = { decks: DeckSummary[]; cursor: string | null; status: 'loading' | 'idle' | 'failed' }

/** No cursor: the first page, replacing the list. */
const fetchPage = (setPage: React.Dispatch<React.SetStateAction<Page>>, cursor?: string) =>
  listMyDecks(cursor).then(
    (r) => setPage((prev) => ({ decks: cursor ? [...prev.decks, ...r.decks] : r.decks, cursor: r.nextCursor, status: 'idle' })),
    (error) => {
      console.error(error)
      setPage((prev) => ({ ...prev, status: 'failed' }))
    },
  )

/** Mounted each time the dialog opens, so every opening reads a fresh first page. */
const DeckList = ({ currentId, onClose, onDeleted, deleteReplacesNew }: Pick<MyDecksProps, 'currentId' | 'onClose' | 'onDeleted' | 'deleteReplacesNew'>) => {
  const t = useTranslations('DeckEditor')
  const format = useFormatter()
  const now = useNow()
  const router = useRouter()
  const [page, setPage] = useState<Page>({ decks: [], cursor: null, status: 'loading' })
  const [confirm, setConfirm] = useState<{ deck: DeckSummary; replacesNew: boolean } | null>(null)
  const [deleting, setDeleting] = useState<'idle' | 'busy' | 'failed'>('idle')
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    fetchPage(setPage)
  }, [])

  const more = () => {
    setPage((prev) => ({ ...prev, status: 'loading' }))
    // A failed first page has no cursor: retry it.
    fetchPage(setPage, page.cursor ?? undefined)
  }

  const open = (id: string) => {
    onClose()
    if (id !== currentId) router.push(`/deck-builder/${id}`)
  }

  const remove = (deck: DeckSummary) => {
    setDeleting('busy')
    deleteDeck(deck.id).then(
      () => {
        // The row with the focus-return target goes away: the list takes focus instead.
        flushSync(() => {
          setConfirm(null)
          setDeleting('idle')
          setPage((prev) => ({ ...prev, decks: prev.decks.filter((d) => d.id !== deck.id) }))
        })
        list.current?.focus()
        onDeleted(deck.id)
      },
      (error) => {
        console.error(error)
        setDeleting('failed')
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Always mounted: it takes the focus after a delete, even of the last row. */}
      <ul ref={list} tabIndex={-1} aria-label={t('myDecks.title')} className="flex flex-col outline-none">
        {page.decks.map((d) => {
          const art = d.label?.artCardId ?? d.coverCardId
          return (
            <li key={d.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
              <span className="relative aspect-[4/3] w-16 shrink-0 bg-surface-300">
                {art ? <Image src={CARD_ART_URL(art)} alt="" fill sizes="64px" className="object-cover" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-ink body-strong">{d.name}</span>
                <span className="truncate text-ink-muted signal-sm">
                  {[d.label?.name, t('tray.counts', d.counts), t(`myDecks.visibility.${d.visibility}`), format.relativeTime(new Date(d.updatedAt), now)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Button size="sm" variant="secondary" onClick={() => open(d.id)} aria-label={t('myDecks.openNamed', { name: d.name })} className={TOUCH}>
                {t('myDecks.open')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDeleting('idle')
                  setConfirm({ deck: d, replacesNew: deleteReplacesNew(d.id) })
                }}
                aria-label={t('myDecks.deleteNamed', { name: d.name })}
                className={TOUCH}
              >
                {t('myDecks.delete')}
              </Button>
            </li>
          )
        })}
      </ul>
      {!page.decks.length && page.status === 'idle' ? <p className="text-ink-muted body">{t('myDecks.empty')}</p> : null}

      {page.status === 'loading' ? (
        <p role="status" className="text-ink-muted body">{t('myDecks.loading')}</p>
      ) : page.status === 'failed' ? (
        <Alert tone="negative" edged title={t('myDecks.failed')} action={<Button variant="secondary" size="sm" onClick={more} className={TOUCH}>{t('retry')}</Button>} />
      ) : page.cursor ? (
        <Button variant="secondary" onClick={more} className={twMerge('self-center', TOUCH)}>
          {t('myDecks.more')}
        </Button>
      ) : null}

      <Dialog
        size="sm"
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t('myDecks.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} className={TOUCH}>
              {t('myDecks.cancel')}
            </Button>
            <Button variant="danger" aria-disabled={deleting === 'busy' || undefined} onClick={() => confirm && deleting !== 'busy' && remove(confirm.deck)} className={TOUCH}>
              {t('myDecks.delete')}
            </Button>
          </>
        }
      >
        <p className="text-ink body">{t('myDecks.deleteBody', { name: confirm?.deck.name ?? '' })}</p>
        {confirm?.replacesNew ? <Alert tone="warn" edged title={t('myDecks.deleteReplacesNew')} /> : null}
        {deleting === 'failed' ? <Alert tone="negative" edged title={t('myDecks.deleteFailed')} /> : null}
      </Dialog>
    </div>
  )
}
