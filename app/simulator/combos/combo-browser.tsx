'use client'

import Link from 'next/link'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { listPublicCombos, type PublicCombo } from '@utils/combos'

type Page = { combos: PublicCombo[]; cursor: string | null; status: 'loading' | 'idle' | 'failed' }

/** No cursor: the first page, replacing the list. */
const fetchPage = (setPage: React.Dispatch<React.SetStateAction<Page>>, cursor?: string) =>
  listPublicCombos(cursor).then(
    (r) => setPage((prev) => ({ combos: cursor ? [...prev.combos, ...r.combos] : r.combos, cursor: r.nextCursor, status: 'idle' })),
    () => setPage((prev) => ({ ...prev, status: 'failed' })),
  )

/** Every published combo, newest first (`GET /combos/public`). A row opens its replay. */
export const ComboBrowser = () => {
  const t = useTranslations('Simulator')
  const format = useFormatter()
  const now = useNow()
  const [page, setPage] = useState<Page>({ combos: [], cursor: null, status: 'loading' })

  useEffect(() => {
    void fetchPage(setPage)
  }, [])

  const more = () => {
    setPage((prev) => ({ ...prev, status: 'loading' }))
    // A failed first page has no cursor: retry it.
    void fetchPage(setPage, page.cursor ?? undefined)
  }

  return (
    <div className="flex flex-col gap-6">
      {page.combos.length ? (
        <ul aria-label={t('browse.title')} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {page.combos.map((c) => (
            <li key={c.id}>
              <Link href={`/simulator/c/${c.id}`} className="flex h-full flex-col gap-1 border border-line bg-surface-100 p-4 hover:border-cyan focus-visible:border-cyan">
                <span className="truncate text-ink body-strong">{c.title}</span>
                <span className="truncate text-ink-dim body-sm">{[c.deckName, c.owner.name && t('player.by', { name: c.owner.name })].filter(Boolean).join(' · ')}</span>
                <span className="truncate text-ink-muted signal-sm">{[t('myCombos.steps', { count: c.steps }), format.relativeTime(new Date(c.updatedAt), now)].join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {!page.combos.length && page.status === 'idle' ? <p className="text-ink-muted body">{t('browse.empty')}</p> : null}

      {page.status === 'loading' ? (
        <p role="status" className="text-ink-muted body">{t('myCombos.loading')}</p>
      ) : page.status === 'failed' ? (
        <Alert tone="negative" edged title={t('browse.failed')} action={<Button variant="secondary" size="sm" onClick={more}>{t('retry')}</Button>} />
      ) : page.cursor ? (
        <Button variant="secondary" onClick={more} className="self-center">
          {t('myCombos.more')}
        </Button>
      ) : null}
    </div>
  )
}
