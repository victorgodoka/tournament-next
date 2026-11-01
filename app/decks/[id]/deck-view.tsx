'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@ui/icon'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@contexts/auth/auth.context'
import { LocalTime } from '@omega/profile/local-time'
import { ARTICLE_DATE } from '@omega/wiki/article'
import { Comments } from '@omega/wiki/comments'
import { Alert } from '@ui/alert'
import { Avatar } from '@ui/avatar'
import { Button, buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip'
import { Eyebrow } from '@ui/eyebrow'
import { SectionHead } from '@ui/section-head'
import { socialError } from '@utils/articles'
import { cardsByIds } from '@utils/cards'
import { CARD_ART_URL } from '@utils/const'
import { toYdke } from '@utils/deck/codecs/ydke'
import type { CardMap, Zone } from '@utils/deck/types'
import { deleteDeckComment, likeDeck, postDeckComment, seasonName, unlikeDeck, type DeckSocial, type SavedDeck } from '@utils/decks'
import { cardLoader } from '@utils/image-loader'
import { setReturnTo } from '@utils/return-to'
import { getBanlists, type Banlist } from '@utils/wiki'
import { BusyDialog } from '@app/deck-builder/busy-dialog'
import { CardTile } from '@app/deck-builder/card-tile'
import { EXPORTS, MENU } from '@app/deck-builder/toolbar'
import { useDeckExport } from '@app/deck-builder/use-export'

const ZONES: Zone[] = ['main', 'extra', 'side']
const EXPORT_ID = 'deck-export'
const TOUCH = 'max-lg:min-h-11'
const GRID = { main: 'grid-cols-5 sm:grid-cols-8 lg:grid-cols-10', extra: 'grid-cols-5 sm:grid-cols-8 lg:grid-cols-10', side: 'grid-cols-5 sm:grid-cols-8 lg:grid-cols-10' }
const SIZES = '(min-width: 1024px) 10vw, (min-width: 640px) 12vw, 20vw'
const COMPACT = new Intl.NumberFormat('en', { notation: 'compact' })

/** Copies collapsed into one tile, in deck order. */
const grouped = (ids: readonly number[]) => {
  const counts = new Map<number, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts]
}

type Props = {
  deck: SavedDeck
  /** `null`: the social API didn't answer; the like hides, the comments say so. */
  social: DeckSocial | null
}

/**
 * A saved deck's own page: who built it and when, its cards, the editor's exports, a like and the
 * conversation. The owner edits it in the Deck Builder; anyone else opens a copy there.
 */
export const DeckView = ({ deck, social }: Props) => {
  const t = useTranslations('DeckEditor')
  const router = useRouter()
  const { user } = useAuth()
  const zones = useMemo(() => ({ main: deck.main, extra: deck.extra, side: deck.side }), [deck])
  const allIds = useMemo(() => [...deck.main, ...deck.extra, ...deck.side], [deck])
  const [cards, setCards] = useState<CardMap | null>(null)
  const [cardsFailed, setCardsFailed] = useState(false)
  const [banlists, setBanlists] = useState<Banlist[]>([])
  // No format saved: the TCG list, as the editor shows it.
  const banlist = banlists.find((b) => (deck.format === null ? b.format === 'tcg' : b.id === deck.format)) ?? null
  const owner = deck.owner.name ?? t('browse.unknownOwner')
  const isOwner = !!user && user.id === deck.ownerId
  const { exportAs, warmStory, toast, setToast, busy } = useDeckExport({
    deck: zones,
    cards: cards ?? new Map(),
    name: deck.name,
    banlist,
    deckId: deck.id,
    author: deck.owner.name,
  })

  useEffect(() => {
    getBanlists().then(setBanlists)
  }, [])

  useEffect(() => {
    let live = true
    cardsByIds(allIds).then(
      (map) => live && setCards(map),
      (error) => {
        console.error(error)
        if (live) setCardsFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [allIds])

  const art = deck.coverCardId ?? deck.label?.artCardId
  const formatName = banlists.find((b) => b.id === deck.format)?.name
  // The season is the banlist of its time; without one, the list the editor validated against.
  const meta = [deck.label?.name, deck.season ? seasonName(deck.season) : formatName, t('tray.counts', { main: deck.main.length, extra: deck.extra.length, side: deck.side.length }), t('page.revision', { revision: deck.revision })]
  /** A copy for anyone but the owner: the editor reads `?d=` and says so. */
  const copyHref = `/deck-builder?${new URLSearchParams({ d: toYdke(zones), name: deck.name, copy: '' })}`

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-6 border-b border-line pb-6 md:flex-row md:items-start">
        <span className="relative aspect-[16/9] w-full shrink-0 bg-surface-300 md:w-80">
          {art ? <Image loader={cardLoader} src={CARD_ART_URL(art)} alt="" fill priority sizes="(min-width: 768px) 320px, 100vw" className="object-cover" /> : null}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Eyebrow>{t('page.eyebrow')}</Eyebrow>
          <h1 className="text-ink display-2 [overflow-wrap:anywhere]">{deck.name}</h1>
          <p className="text-ink-muted signal-sm">{meta.filter(Boolean).join(' · ')}</p>
          <div className="flex flex-wrap gap-1.5">
            {deck.visibility !== 'public' ? <Chip tone="cyan">{t(`myDecks.visibility.${deck.visibility}`)}</Chip> : null}
            {deck.generated ? <Chip tone="amber">{t('browse.generatedChip')}</Chip> : null}
            {deck.deckTags.map((tag) => (
              <Chip key={tag} tone={tag === 'competitive' ? 'gold' : tag === 'rogue' ? 'indigo' : 'neutral'}>
                {t(`deckTags.${tag}`)}
              </Chip>
            ))}
          </div>
          <Link href={`/profile/${deck.owner.id}/my-decks`} className="flex items-center gap-3 self-start text-ink hover:text-cyan">
            <Avatar name={owner} src={deck.owner.avatarUrl} size="sm" />
            <span className="body-strong">{deck.generated ? t('page.generatedBy', { name: owner }) : t('page.by', { name: owner })}</span>
          </Link>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-ink-muted body-sm">
            <div className="flex gap-2">
              <dt>{t('page.created')}</dt>
              <dd className="text-ink-dim mono-data">
                <LocalTime iso={deck.createdAt} options={ARTICLE_DATE} />
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>{t('page.updated')}</dt>
              <dd className="text-ink-dim mono-data">
                <LocalTime iso={deck.updatedAt} options={ARTICLE_DATE} />
              </dd>
            </div>
          </dl>
          {deck.description ? <p className="text-ink-dim body [overflow-wrap:anywhere]">{deck.description}</p> : null}
          {deck.links.length ? (
            <ul aria-label={t('browse.links')} className="flex flex-wrap gap-x-3 gap-y-1">
              {deck.links.map((href) => (
                <li key={href} className="min-w-0">
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="block max-w-72 truncate text-cyan body-sm hover:underline">
                    {href.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <LikeButton deckId={deck.id} initial={social} />

        <Button variant="secondary" size="mono" popoverTarget={EXPORT_ID} aria-disabled={!cards || undefined} className={TOUCH}>
          {t('page.export')}
        </Button>
        <div
          id={EXPORT_ID}
          popover="auto"
          role="dialog"
          aria-label={t('page.export')}
          className={MENU}
          onToggle={(e) => {
            if (e.newState === 'open') warmStory()
          }}
        >
          <ul className="flex flex-col">
            {EXPORTS.map((kind) => (
              // Share on phones and tablets only: a desktop share sheet rarely takes a file.
              <li key={kind} className={kind === 'share' ? 'hidden pointer-coarse:block' : undefined}>
                <button
                  type="button"
                  popoverTarget={EXPORT_ID}
                  popoverTargetAction="hide"
                  onClick={() => cards && void exportAs(kind)}
                  className={twMerge('w-full cursor-pointer px-3 py-2 text-left body-sm hover:bg-surface-300', TOUCH)}
                >
                  {t(`io.as.${kind}`)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {isOwner ? (
          <Link href={`/deck-builder/${deck.id}`} className={twMerge(buttonClasses({ variant: 'primary', size: 'mono' }), TOUCH)}>
            {t('page.edit')}
          </Link>
        ) : (
          <Link href={copyHref} className={twMerge(buttonClasses({ variant: 'primary', size: 'mono' }), TOUCH)}>
            {t('page.copy')}
          </Link>
        )}
      </div>

      {cardsFailed ? <Alert tone="negative" edged title={t('page.cardsFailed')} /> : null}

      {ZONES.filter((zone) => zones[zone].length).map((zone) => (
        <section key={zone} aria-labelledby={`zone-${zone}`} className="flex flex-col gap-3">
          <SectionHead id={`zone-${zone}`} compact end={<span className="text-ink-muted mono-data">{zones[zone].length}</span>}>
            {t(`zones.${zone}`)}
          </SectionHead>
          <ul className={twMerge('grid gap-1.5', GRID[zone])}>
            {grouped(zones[zone]).map(([id, count]) => {
              const card = cards?.get(id)
              return (
                <li key={id} data-card={id}>
                  <CardTile
                    id={id}
                    card={card}
                    count={count}
                    sizes={SIZES}
                    label={t('page.openCard', { name: card?.name ?? String(id) })}
                    onClick={() => router.push(`/wiki/card/${id}`)}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <Comments
        initial={social?.comments ?? null}
        post={(body, parentId) => postDeckComment(deck.id, body, parentId)}
        remove={(id) => deleteDeckComment(deck.id, id)}
        canModerate={(u) => u.id === deck.ownerId}
      />

      {toast ? (
        <div className="fixed inset-x-4 top-[calc(var(--header-h,64px)+12px)] z-(--z-toast) mx-auto max-w-120 drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          <Alert tone={toast.tone} edged title={toast.text} action={<Button variant="ghost" size="sm" onClick={() => setToast(null)} className={TOUCH}>{t('dismiss')}</Button>} />
        </div>
      ) : null}
      <BusyDialog label={busy && t(`io.${busy}`)} />
    </div>
  )
}

/** The heart and its count. Signed out it goes to sign-in and comes back here. Hidden when the social API didn't answer. */
const LikeButton = ({ deckId, initial }: { deckId: string; initial: DeckSocial | null }) => {
  const t = useTranslations('DeckEditor.page')
  const { user } = useAuth()
  const [like, setLike] = useState({ likes: initial?.likes ?? 0, liked: initial?.liked ?? false })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!initial) return null

  const toggle = async () => {
    const before = like
    setPending(true)
    setError(null)
    try {
      setLike(await (before.liked ? unlikeDeck(deckId) : likeDeck(deckId)))
    } catch (cause) {
      console.error(cause)
      setLike(before)
      setError(socialError(cause))
    } finally {
      setPending(false)
    }
  }

  const label = (
    <>
      <Icon name={like.liked ? 'heart' : 'heartOutline'} className={twMerge(like.liked && 'text-crimson-lift')} />
      <span className="mono-data">{COMPACT.format(like.likes)}</span>
    </>
  )
  const title = `${like.liked ? t('unlike') : t('like')} (${t('likeCount', { count: like.likes })})`

  return (
    <>
      {user === null ? (
        <Link href="/login" onClick={() => setReturnTo(location.pathname)} aria-label={t('signInToLike')} className={twMerge(buttonClasses({ variant: 'secondary', size: 'mono' }), TOUCH)}>
          {label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={pending || user === undefined}
          aria-pressed={like.liked}
          aria-label={title}
          className={twMerge(buttonClasses({ variant: 'secondary', size: 'mono' }), TOUCH)}
        >
          {label}
        </button>
      )}
      {error ? (
        <p role="alert" className="text-loss body-sm">
          {error}
        </p>
      ) : null}
    </>
  )
}
