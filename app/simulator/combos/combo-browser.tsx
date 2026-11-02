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
import { listPublicCombos, type ComboFilters, type PublicCombo } from '@utils/combos'
import { CARD_ART_URL } from '@utils/const'
import { DECK_TAGS, type DeckTag } from '@utils/decks'
import { cardLoader } from '@utils/image-loader'

type Card = { id: number; name: string }
type Filters = { q: string; archetype: string; tag: DeckTag | null; cards: Card[] }
type Page = { key: string; combos: PublicCombo[]; cursor: string | null; failed: boolean; loadingMore: boolean }

const EMPTY: Filters = { q: '', archetype: '', tag: null, cards: [] }
const TOUCH = 'max-lg:min-h-11'
const MAX_CARDS = 10

/** Module-level, so `Lookup` gets a stable search. */
const findCards = async (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  (await searchCards(text, 10, signal)).map(({ id, name }) => ({ key: id, label: name }))

const query = (f: Filters): ComboFilters => ({ q: f.q, archetype: f.archetype, tag: f.tag, cards: f.cards.map((c) => c.id) })

/** A combo's three cards, side by side as slanted panes of the same glass; fewer panes when it has fewer. */
const Triptych = ({ cards }: { cards: number[] }) => (
  <span aria-hidden className="relative block aspect-[16/9] overflow-hidden bg-surface-300">
    <span className="flex size-full">
      {cards.map((id) => (
        <span key={id} className="sim-pane-cover relative min-w-0 flex-1">
          <Image loader={cardLoader} src={CARD_ART_URL(id)} alt="" fill sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 34vw" className="object-cover" />
        </span>
      ))}
    </span>
    <span className="absolute inset-0 bg-linear-to-t from-surface-100 via-transparent to-transparent" />
  </span>
)

const ComboCard = ({ combo }: { combo: PublicCombo }) => {
  const t = useTranslations('Simulator')
  const tDeck = useTranslations('DeckEditor')
  const format = useFormatter()
  const now = useNow()
  return (
    // The title link stretches over the card.
    <li className="relative flex flex-col border border-line bg-surface-100 transition-colors hover:border-cyan">
      <Triptych cards={combo.coverCards} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="truncate text-ink body-strong">
          <Link href={`/simulator/c/${combo.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-focus-ring">
            {combo.title}
          </Link>
        </h2>
        <p className="truncate text-ink-dim body-sm">{[combo.archetype ?? combo.deckName, combo.owner.name && t('player.by', { name: combo.owner.name })].filter(Boolean).join(' · ')}</p>
        <p className="truncate text-ink-muted signal-sm">{[t('myCombos.steps', { count: combo.steps }), format.relativeTime(new Date(combo.updatedAt), now)].join(' · ')}</p>
        {combo.tags.length ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {combo.tags.map((tag) => (
              <Chip key={tag} tone={tag === 'competitive' ? 'gold' : tag === 'rogue' ? 'indigo' : 'neutral'}>
                {tDeck(`deckTags.${tag}`)}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  )
}

/** Every published combo that matches, newest first (`GET /combos/public`). A card opens its replay. */
export const ComboBrowser = () => {
  const t = useTranslations('Simulator')
  const tDeck = useTranslations('DeckEditor')
  const tFilter = useTranslations('DeckEditor.browse')
  const [filters, setFilters] = useState(EMPTY)
  const [attempt, setAttempt] = useState(0)
  // The request a page answers: while it differs from the filters, the grid is loading.
  const key = JSON.stringify([query(filters), attempt])
  const [page, setPage] = useState<Page | null>(null)
  const current = page?.key === key ? page : null

  useEffect(() => {
    let live = true
    const [q] = JSON.parse(key) as [ComboFilters]
    listPublicCombos(q).then(
      (r) => live && setPage({ key, combos: r.combos, cursor: r.nextCursor, failed: false, loadingMore: false }),
      () => live && setPage({ key, combos: [], cursor: null, failed: true, loadingMore: false }),
    )
    return () => {
      live = false
    }
  }, [key])

  const more = () => {
    if (!current?.cursor) return
    setPage({ ...current, loadingMore: true, failed: false })
    listPublicCombos(query(filters), current.cursor).then(
      (r) => setPage((prev) => (prev?.key === key ? { ...prev, combos: [...prev.combos, ...r.combos], cursor: r.nextCursor, loadingMore: false } : prev)),
      () => setPage((prev) => (prev?.key === key ? { ...prev, loadingMore: false, failed: true } : prev)),
    )
  }

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
  const name = useLazyText(filters.q, (q) => set({ q }), 300)
  const archetype = useLazyText(filters.archetype, (archetype) => set({ archetype }), 300)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('browse.name')} htmlFor="combos-q">
          <TextInput id="combos-q" type="search" maxLength={80} {...name} plateClassName={TOUCH} />
        </Field>
        <Field label={tFilter('archetype')} htmlFor="combos-archetype">
          <TextInput id="combos-archetype" type="search" maxLength={80} {...archetype} plateClassName={TOUCH} />
        </Field>
        <Field label={tFilter('tag')} htmlFor="combos-tag">
          <Select
            id="combos-tag"
            block
            options={[{ value: '', label: tFilter('anyTag') }, ...DECK_TAGS.map((tag) => ({ value: tag, label: tDeck(`deckTags.${tag}`) }))]}
            value={filters.tag ?? ''}
            onChange={(e) => set({ tag: (e.target.value || null) as DeckTag | null })}
            className={TOUCH}
          />
        </Field>
        <Field label={t('browse.cards')} className="sm:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <Lookup
              label={t('browse.cards')}
              placeholder={tFilter('cardsPlaceholder')}
              search={findCards}
              exclude={filters.cards.map((c) => c.id)}
              onPick={(o) => {
                const id = Number(o.key)
                if (filters.cards.length < MAX_CARDS && !filters.cards.some((c) => c.id === id)) set({ cards: [...filters.cards, { id, name: String(o.label) }] })
              }}
              className="w-full max-w-90"
            />
            {filters.cards.map((card) => (
              <Tag key={card.id} onRemove={() => set({ cards: filters.cards.filter((c) => c.id !== card.id) })} removeLabel={tFilter('removeCard', { name: card.name })}>
                {card.name}
              </Tag>
            ))}
            {JSON.stringify(filters) !== JSON.stringify(EMPTY) ? (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)} className={twMerge('ml-auto', TOUCH)}>
                {tFilter('clear')}
              </Button>
            ) : null}
          </div>
        </Field>
      </div>

      {!current ? (
        <p role="status" className="text-ink-muted body">{t('myCombos.loading')}</p>
      ) : current.failed && !current.combos.length ? (
        <Alert tone="negative" edged title={t('browse.failed')} action={<Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)} className={TOUCH}>{t('retry')}</Button>} />
      ) : !current.combos.length ? (
        <p className="text-ink-muted body">{t('browse.empty')}</p>
      ) : (
        <>
          <ul aria-label={t('browse.title')} className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {current.combos.map((combo) => (
              <ComboCard key={combo.id} combo={combo} />
            ))}
          </ul>
          {current.failed ? <Alert tone="negative" edged title={t('browse.failed')} /> : null}
          {current.cursor ? (
            <Button variant="secondary" aria-disabled={current.loadingMore || undefined} onClick={() => !current.loadingMore && more()} className={twMerge('self-center', TOUCH)}>
              {current.loadingMore ? t('myCombos.loading') : t('myCombos.more')}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
