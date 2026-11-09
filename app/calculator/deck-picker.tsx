'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Dialog } from '@ui/dialog'
import { TextArea } from '@ui/field'
import { readDeck } from '@app/deck-builder/deck-io'
import { useAuth } from '@contexts/auth/auth.context'
import { rolesFromTags } from '@utils/combo/roles'
import type { Build } from '@utils/combo/types'
import { CARD_ART_URL } from '@utils/const'
import { DeckCodeError, type CardMap } from '@utils/deck/types'
import { getDeck, listMyDecks, type DeckSummary } from '@utils/decks'
import { setReturnTo } from '@utils/return-to'
import type { Saved } from './calculator.reducer'

const TOUCH = 'max-lg:min-h-11'
/** A .ydk is a few KB; anything far bigger isn't one. */
const MAX_IMPORT_BYTES = 64 * 1024

type Tab = 'mine' | 'paste' | 'file'
const TABS: Tab[] = ['mine', 'paste', 'file']

type DeckPickerProps = {
  open: boolean
  onClose(): void
  /** Card lookups, so Omega codes split main from extra and saved tags map to canonical ids. */
  lookup(ids: number[]): Promise<CardMap>
  onPick(build: Build, saved: Saved | null): void
}

/** My decks, a pasted code, or a .ydk file: any of them becomes the build. */
export const DeckPicker = (p: DeckPickerProps) => {
  const t = useTranslations('Calculator')
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('mine')
  const [text, setText] = useState('')
  const [error, setError] = useState<'invalid' | 'tooBig' | 'failed' | null>(null)
  const [busy, setBusy] = useState(false)

  const importText = async (raw: string, name = '') => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { deck } = await readDeck(raw, p.lookup)
      p.onPick({ name, deck, roles: new Map(), format: null, deckId: null }, null)
      setText('')
      p.onClose()
    } catch (e) {
      if (!(e instanceof DeckCodeError)) console.error(e)
      setError('invalid')
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) return setError('tooBig')
    await importText(await file.text(), file.name.replace(/\.ydk$/i, ''))
  }

  const openSaved = async (id: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const saved = await getDeck(id)
      if (!saved) return setError('failed')
      const deck = { main: saved.main, extra: saved.extra, side: saved.side }
      const known = await p.lookup([...saved.main, ...saved.extra, ...saved.side]).catch(() => new Map())
      p.onPick({ name: saved.name, deck, roles: rolesFromTags(saved.tags, known), format: saved.format, deckId: saved.id }, { revision: saved.revision, ownerId: saved.ownerId })
      p.onClose()
    } catch (e) {
      console.error(e)
      setError('failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={p.open} onClose={p.onClose} title={t('picker.title')}>
      <div className="flex flex-col gap-4">
        <Segmented label={t('picker.title')} value={tab} onChange={setTab} options={TABS.map((value) => ({ value, label: t(`picker.${value}`) }))} />

        {tab === 'mine' ? (
          user === undefined ? (
            <p role="status" className="text-ink-muted body">{t('picker.loading')}</p>
          ) : user ? (
            <DeckList busy={busy} onOpen={(id) => void openSaved(id)} />
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p className="text-ink body">{t('picker.signedOut')}</p>
              <Link href="/login" onClick={() => setReturnTo(location.pathname + location.search)} className={twMerge(buttonClasses(), TOUCH)}>
                {t('picker.signIn')}
              </Link>
            </div>
          )
        ) : tab === 'paste' ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (text.trim()) void importText(text)
            }}
          >
            <TextArea name="code" mono rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('picker.placeholder')} aria-label={t('picker.paste')} />
            <Button type="submit" size="sm" aria-disabled={busy || undefined} className={twMerge('self-start', TOUCH)}>
              {t('picker.import')}
            </Button>
          </form>
        ) : (
          <label className={twMerge(buttonClasses({ variant: 'secondary' }), 'cursor-pointer self-start has-focus-visible:shadow-focus-ring', TOUCH)}>
            {t('picker.chooseFile')}
            <input
              type="file"
              accept=".ydk,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = '' // the same file again still fires
                if (file) void importFile(file)
              }}
            />
          </label>
        )}

        {error ? <Alert tone="negative" edged title={t(`picker.${error}`)} /> : null}
      </div>
    </Dialog>
  )
}

type Page = { decks: DeckSummary[]; cursor: string | null; status: 'loading' | 'idle' | 'failed' }

/** The signed-in user's saved decks, a page at a time; mounted fresh with the tab so each opening reads anew. */
const DeckList = ({ busy, onOpen }: { busy: boolean; onOpen(id: string): void }) => {
  const t = useTranslations('Calculator')
  const format = useFormatter()
  const now = useNow()
  const [page, setPage] = useState<Page>({ decks: [], cursor: null, status: 'loading' })

  const fetchPage = (cursor?: string) =>
    listMyDecks(cursor).then(
      (r) => setPage((prev) => ({ decks: cursor ? [...prev.decks, ...r.decks] : r.decks, cursor: r.nextCursor, status: 'idle' })),
      (error) => {
        console.error(error)
        setPage((prev) => ({ ...prev, status: 'failed' }))
      },
    )

  // The first page, once, when the tab mounts.
  useEffect(() => {
    void fetchPage()
  }, [])

  const more = () => {
    setPage((prev) => ({ ...prev, status: 'loading' }))
    void fetchPage(page.cursor ?? undefined)
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={t('picker.mine')} className="flex flex-col">
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
                  {[d.label?.name, t('picker.counts', d.counts), format.relativeTime(new Date(d.updatedAt), now)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Button size="sm" variant="secondary" aria-disabled={busy || undefined} onClick={() => onOpen(d.id)} aria-label={t('picker.openNamed', { name: d.name })} className={TOUCH}>
                {t('picker.open')}
              </Button>
            </li>
          )
        })}
      </ul>
      {!page.decks.length && page.status === 'idle' ? <p className="text-ink-muted body">{t('picker.empty')}</p> : null}
      {page.status === 'loading' ? (
        <p role="status" className="text-ink-muted body">{t('picker.loading')}</p>
      ) : page.status === 'failed' ? (
        <Alert
          tone="negative"
          edged
          title={t('picker.failed')}
          action={
            <Button variant="secondary" size="sm" onClick={more} className={TOUCH}>
              {t('retry')}
            </Button>
          }
        />
      ) : page.cursor ? (
        <Button variant="secondary" onClick={more} className={twMerge('self-center', TOUCH)}>
          {t('picker.more')}
        </Button>
      ) : null}
    </div>
  )
}
