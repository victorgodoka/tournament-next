'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useLazyText } from '@hooks/index'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip, Tag } from '@ui/chip'
import { Field, Select, TextInput } from '@ui/field'
import { Lookup, type LookupOption } from '@ui/lookup'
import { searchCards } from '@utils/cards'
import { CARD_ART_URL } from '@utils/const'
import { cardLoader } from '@utils/image-loader'
import {
  DECK_TAGS, listPublicDecks, listSeasons, listUserDecks, seasonName,
  type DeckFilters, type DeckSummary, type DeckTag, type GeneratedFilter, type Season,
} from '@utils/decks'
import { getBanlists, type Banlist } from '@utils/wiki'

type Card = { id: number; name: string }
type Filters = { q: string; archetype: string; format: number | null; tag: DeckTag | null; cards: Card[]; generated: GeneratedFilter | null; season: number | null }
type Page = { key: string; decks: DeckSummary[]; cursor: string | null; failed: boolean; loadingMore: boolean }

const EMPTY: Filters = { q: '', archetype: '', format: null, tag: null, cards: [], generated: null, season: null }
const TOUCH = 'max-lg:min-h-11'
const GENERATED: Array<GeneratedFilter | ''> = ['', 'hide', 'only']

/** Module-level, so `Lookup` gets a stable search. */
const findCards = async (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  (await searchCards(text, 10, signal)).map(({ id, name }) => ({ key: id, label: name }))

const query = (f: Filters): DeckFilters => ({
  q: f.q, archetype: f.archetype, format: f.format, tag: f.tag, cards: f.cards.map((c) => c.id), generated: f.generated, season: f.season,
})

/**
 * A filterable grid of decks. With `userId`, that duelist's decks as the viewer may see them (the
 * owner sees every one); without, every public deck.
 */
export const DeckBrowser = ({ userId }: { userId?: string }) => {
  const t = useTranslations('DeckEditor.browse')
  const tEditor = useTranslations('DeckEditor')
  const [filters, setFilters] = useState(EMPTY)
  const [banlists, setBanlists] = useState<Banlist[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [attempt, setAttempt] = useState(0)
  // The request a page answers: while it differs from the filters, the grid is loading.
  const key = JSON.stringify([userId ?? null, query(filters), attempt])
  const [page, setPage] = useState<Page | null>(null)
  const current = page?.key === key ? page : null

  const fetchPage = (q: DeckFilters, cursor?: string) => (userId ? listUserDecks(userId, q, cursor) : listPublicDecks(q, cursor))

  useEffect(() => {
    getBanlists().then(setBanlists)
    listSeasons().then(setSeasons)
  }, [])

  useEffect(() => {
    let live = true
    const [, q] = JSON.parse(key) as [string | null, DeckFilters]
    ;(userId ? listUserDecks(userId, q) : listPublicDecks(q)).then(
      (r) => live && setPage({ key, decks: r.decks, cursor: r.nextCursor, failed: false, loadingMore: false }),
      (error) => {
        console.error(error)
        if (live) setPage({ key, decks: [], cursor: null, failed: true, loadingMore: false })
      },
    )
    return () => {
      live = false
    }
  }, [key, userId])

  const more = () => {
    if (!current?.cursor) return
    setPage({ ...current, loadingMore: true, failed: false })
    fetchPage(query(filters), current.cursor).then(
      (r) => setPage((prev) => (prev?.key === key ? { ...prev, decks: [...prev.decks, ...r.decks], cursor: r.nextCursor, loadingMore: false } : prev)),
      (error) => {
        console.error(error)
        setPage((prev) => (prev?.key === key ? { ...prev, loadingMore: false, failed: true } : prev))
      },
    )
  }

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
  const name = useLazyText(filters.q, (q) => set({ q }), 300)
  const archetype = useLazyText(filters.archetype, (archetype) => set({ archetype }), 300)
  const formatName = (id: number | null) => banlists.find((b) => b.id === id)?.name

  return (
    <div className="flex flex-col gap-6">
      <div className={twMerge('grid gap-4 sm:grid-cols-2', userId ? 'lg:grid-cols-5' : 'lg:grid-cols-6')}>
        <Field label={t('name')} htmlFor="decks-q">
          <TextInput id="decks-q" type="search" maxLength={80} {...name} plateClassName={TOUCH} />
        </Field>
        <Field label={t('archetype')} htmlFor="decks-archetype">
          <TextInput id="decks-archetype" type="search" maxLength={80} {...archetype} plateClassName={TOUCH} />
        </Field>
        <Field label={t('format')} htmlFor="decks-format">
          <Select
            id="decks-format"
            block
            options={[{ value: '', label: t('anyFormat') }, ...banlists.map((b) => ({ value: String(b.id), label: b.name }))]}
            value={filters.format === null ? '' : String(filters.format)}
            onChange={(e) => set({ format: e.target.value ? Number(e.target.value) : null })}
            className={TOUCH}
          />
        </Field>
        <Field label={t('season')} htmlFor="decks-season">
          <Select
            id="decks-season"
            block
            options={[{ value: '', label: t('anySeason') }, ...seasons.map((s) => ({ value: String(s.id), label: seasonName(s) }))]}
            value={filters.season === null ? '' : String(filters.season)}
            onChange={(e) => set({ season: e.target.value ? Number(e.target.value) : null })}
            className={TOUCH}
          />
        </Field>
        <Field label={t('tag')} htmlFor="decks-tag">
          <Select
            id="decks-tag"
            block
            options={[{ value: '', label: t('anyTag') }, ...DECK_TAGS.map((tag) => ({ value: tag, label: tEditor(`deckTags.${tag}`) }))]}
            value={filters.tag ?? ''}
            onChange={(e) => set({ tag: (e.target.value || null) as DeckTag | null })}
            className={TOUCH}
          />
        </Field>
        {/* Only the public showcase mixes duelists' decks with the sample decks the statistics build. */}
        {userId ? null : (
          <Field label={t('generated')} htmlFor="decks-generated">
            <Select
              id="decks-generated"
              block
              options={GENERATED.map((value) => ({ value, label: t(`generatedOptions.${value || 'all'}`) }))}
              value={filters.generated ?? ''}
              onChange={(e) => set({ generated: (e.target.value || null) as GeneratedFilter | null })}
              className={TOUCH}
            />
          </Field>
        )}
        <Field label={t('cards')} className={twMerge('sm:col-span-2', userId ? 'lg:col-span-5' : 'lg:col-span-6')}>
          <div className="flex flex-wrap items-center gap-2">
            <Lookup
              label={t('cards')}
              placeholder={t('cardsPlaceholder')}
              search={findCards}
              exclude={filters.cards.map((c) => c.id)}
              onPick={(o) => {
                const id = Number(o.key)
                if (filters.cards.length < 10 && !filters.cards.some((c) => c.id === id)) set({ cards: [...filters.cards, { id, name: String(o.label) }] })
              }}
              className="w-full max-w-90"
            />
            {filters.cards.map((card) => (
              <Tag key={card.id} onRemove={() => set({ cards: filters.cards.filter((c) => c.id !== card.id) })} removeLabel={t('removeCard', { name: card.name })}>
                {card.name}
              </Tag>
            ))}
            {JSON.stringify(filters) !== JSON.stringify(EMPTY) ? (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)} className={twMerge('ml-auto', TOUCH)}>
                {t('clear')}
              </Button>
            ) : null}
          </div>
        </Field>
      </div>

      {!current ? (
        <p role="status" className="text-ink-muted body">{t('loading')}</p>
      ) : current.failed && !current.decks.length ? (
        <Alert tone="negative" edged title={t('failed')} action={<Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)} className={TOUCH}>{tEditor('retry')}</Button>} />
      ) : !current.decks.length ? (
        <p className="text-ink-muted body">{t('empty')}</p>
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {current.decks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} format={formatName(deck.format)} showOwner={!userId} />
            ))}
          </ul>
          {current.failed ? <Alert tone="negative" edged title={t('failed')} /> : null}
          {current.cursor ? (
            <Button variant="secondary" aria-disabled={current.loadingMore || undefined} onClick={() => !current.loadingMore && more()} className={twMerge('self-center', TOUCH)}>
              {current.loadingMore ? t('loading') : t('more')}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}

const DeckCard = ({ deck, format, showOwner }: { deck: DeckSummary; format?: string; showOwner: boolean }) => {
  const t = useTranslations('DeckEditor')
  const formatter = useFormatter()
  const now = useNow()
  const art = deck.coverCardId ?? deck.label?.artCardId
  const owner = deck.owner.name ?? t('browse.unknownOwner')

  return (
    // The title link stretches over the card; the owner and the deck's links sit above it.
    <li className="relative flex flex-col border border-line bg-surface-100 hover:border-line-strong">
      <span className="relative aspect-[16/9] bg-surface-300">
        {art ? <Image loader={cardLoader} src={CARD_ART_URL(art)} alt="" fill sizes="(min-width: 1024px) 25vw, 100vw" className="object-cover" /> : null}
      </span>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="truncate text-ink body-strong">
          <Link href={`/decks/${deck.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-focus-ring">
            {deck.name}
          </Link>
        </h2>
        <p className="truncate text-ink-muted signal-sm">
          {[
            deck.label?.name,
            deck.season ? seasonName(deck.season) : format,
            t('tray.counts', deck.counts),
            deck.likes ? t('browse.likes', { count: deck.likes }) : null,
            formatter.relativeTime(new Date(deck.updatedAt), now),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {showOwner ? (
          <Link href={`/profile/${deck.owner.id}/my-decks`} className="relative z-1 self-start text-cyan body-sm hover:underline">
            {t('browse.by', { name: owner })}
          </Link>
        ) : null}
        {deck.description ? <p className="line-clamp-2 text-ink-dim body-sm">{deck.description}</p> : null}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {deck.visibility !== 'public' ? <Chip tone="cyan">{t(`myDecks.visibility.${deck.visibility}`)}</Chip> : null}
          {deck.generated ? <Chip tone="amber">{t('browse.generatedChip')}</Chip> : null}
          {deck.deckTags.map((tag) => (
            <Chip key={tag} tone={tag === 'competitive' ? 'gold' : tag === 'rogue' ? 'indigo' : 'neutral'}>
              {t(`deckTags.${tag}`)}
            </Chip>
          ))}
        </div>
        {deck.links.length ? (
          <ul aria-label={t('browse.links')} className="relative z-1 flex flex-wrap gap-x-3 gap-y-1">
            {deck.links.map((href) => (
              <li key={href} className="min-w-0">
                <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="block max-w-56 truncate text-cyan body-sm hover:underline">
                  {href.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  )
}
