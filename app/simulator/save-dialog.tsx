'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import { FilterChip } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { Dialog } from '@ui/dialog'
import { Field, TextInput } from '@ui/field'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardMap, Deck } from '@utils/deck/types'
import { DECK_TAGS } from '@utils/decks'
import { setReturnTo } from '@utils/return-to'
import { COVER_CARDS, LIMITS, VISIBILITIES, type ComboMeta } from '@utils/simulator/types'
import { TOUCH } from './toolbar'
import type { SaveFlow } from './use-save'

type SaveDialogProps = {
  open: boolean
  /** Where the title starts each time the dialog opens: the deck name for a first save, the combo's title for a tied one. */
  initialTitle: string
  /** What it shows: what the combo has, or for a first save whoever has the link (as Share expects) and the deck's first cards. */
  initialMeta: ComboMeta
  deck: Deck
  cards: CardMap
  /** A save is on its way: both buttons wait. */
  busy: boolean
  onClose(): void
  /** `title` trimmed, 1–80 characters. */
  onSave(title: string, asNew: boolean, meta: ComboMeta): void
}

/** The cards of the deck, once each: click to put one on the cover, in the order picked, up to three. */
const CoverPicker = ({ deck, cards, value, onChange }: { deck: Deck; cards: CardMap; value: number[]; onChange(next: number[]): void }) => {
  const t = useTranslations('Simulator')
  const full = value.length >= COVER_CARDS
  return (
    <Field label={t('combos.coverLabel')} meta={`${value.length}/${COVER_CARDS}`}>
      <ul aria-label={t('combos.coverLabel')} className="grid max-h-52 grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1 overflow-y-auto">
        {[...new Set([...deck.main, ...deck.extra])].map((code) => {
          const place = value.indexOf(code)
          return (
            <li key={code} className={twMerge('relative', full && place < 0 && 'opacity-40')}>
              <CardTile
                id={code}
                card={cards.get(code)}
                sizes="60px"
                aria-pressed={place >= 0}
                onClick={() => onChange(place >= 0 ? value.filter((c) => c !== code) : full ? value : [...value, code])}
                className={twMerge(place >= 0 && 'outline outline-2 outline-cyan')}
              />
              {place >= 0 ? <span className="pointer-events-none absolute top-0 left-0 bg-cyan px-1 font-mono text-[11px] leading-4 font-bold text-space-000">{place + 1}</span> : null}
            </li>
          )
        })}
      </ul>
    </Field>
  )
}

/** The title of a combo, its cover, tags and who opens it, then Save or Save as new. Enter in the field is Save. */
const SaveDialog = ({ open, initialTitle, initialMeta, deck, cards, busy, onClose, onSave }: SaveDialogProps) => {
  const t = useTranslations('Simulator')
  const tDeck = useTranslations('DeckEditor')
  const id = useId()
  const [title, setTitle] = useState(initialTitle)
  const [meta, setMeta] = useState(initialMeta)
  // Each opening starts from `initialTitle`, set here in render: an effect would show the last title for a frame.
  const [shown, setShown] = useState(open)
  if (shown !== open) {
    setShown(open)
    if (open) {
      setTitle(initialTitle)
      setMeta(initialMeta)
    }
  }
  const set = (patch: Partial<ComboMeta>) => setMeta((now) => ({ ...now, ...patch }))
  const trimmed = title.trim()
  const off = busy || trimmed.length === 0
  const send = (asNew: boolean) => !off && onSave(trimmed, asNew, meta)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('combos.dialogTitle')}
      footer={
        <>
          <Button variant="secondary" disabled={off} onClick={() => send(true)} className={TOUCH}>
            {t('combos.saveAsNew')}
          </Button>
          <Button disabled={off} onClick={() => send(false)} className={TOUCH}>
            {t('combos.save')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          send(false)
        }}
      >
        <Field label={t('combos.titleLabel')} htmlFor={id}>
          <TextInput id={id} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} plateClassName={TOUCH} />
        </Field>
        <CoverPicker deck={deck} cards={cards} value={meta.coverCards} onChange={(coverCards) => set({ coverCards })} />
        <Field label={t('combos.tagsLabel')}>
          <div className="flex flex-wrap gap-2">
            {DECK_TAGS.map((tag) => {
              const on = meta.tags.includes(tag)
              return <FilterChip key={tag} pressed={on} label={tDeck(`deckTags.${tag}`)} onClick={() => set({ tags: on ? meta.tags.filter((x) => x !== tag) : [...meta.tags, tag] })} />
            })}
          </div>
        </Field>
        <div className="flex flex-col gap-2">
          <Segmented
            label={t('combos.visibilityLabel')}
            options={VISIBILITIES.map((value) => ({ value, label: t(`combos.visibility.${value}`) }))}
            value={meta.visibility}
            onChange={(visibility) => set({ visibility })}
          />
          <p className="text-ink-muted body-sm">{t(`combos.visibilityHint.${meta.visibility}`)}</p>
        </div>
        <p className="text-ink-muted body-sm">{t('combos.archetypeHint')}</p>
      </form>
    </Dialog>
  )
}

const TONE = { signIn: 'info', limit: 'warn', saveFailed: 'negative', damaged: 'negative', failed: 'negative', copied: 'positive', copiedPrivate: 'warn', copyFailed: 'info' } as const

/** What `useSave` shows: the outcome of the last save or share, the title dialog and the conflict dialog. Retry waits out a replay, as Save does. */
export const SaveFlowView = ({ flow, playing, deck, cards }: { flow: SaveFlow; playing: boolean; deck: Deck; cards: CardMap }) => {
  const t = useTranslations('Simulator')
  const { outcome } = flow
  const asked = flow.asking?.meta
  const initialMeta: ComboMeta = { visibility: asked?.visibility ?? 'link', coverCards: asked?.coverCards ?? [...new Set(deck.main)].slice(0, COVER_CARDS), tags: asked?.tags ?? [] }
  const dismiss = (
    <Button variant="ghost" size="sm" onClick={flow.dismiss} className={TOUCH}>
      {t('dismiss')}
    </Button>
  )

  return (
    <>
      {outcome ? (
        <Alert
          tone={TONE[outcome.kind]}
          edged
          title={t(`combos.${outcome.kind}`)}
          action={
            outcome.kind === 'signIn' ? (
              <Link href="/login" onClick={() => setReturnTo(location.pathname + location.search)} className={twMerge(buttonClasses({ size: 'sm' }), TOUCH)}>
                {t('combos.signInAction')}
              </Link>
            ) : outcome.kind === 'failed' ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={playing || flow.busy} onClick={flow.retry} className={TOUCH}>
                  {t('retry')}
                </Button>
                {dismiss}
              </div>
            ) : (
              dismiss
            )
          }
        >
          {outcome.kind === 'copyFailed' ? (
            <TextInput readOnly value={outcome.link} mono aria-label={t('combos.link')} onFocus={(e) => e.target.select()} plateClassName="mt-2" />
          ) : null}
        </Alert>
      ) : null}

      <SaveDialog
        open={flow.asking !== null}
        initialTitle={flow.asking?.title ?? ''}
        initialMeta={initialMeta}
        deck={deck}
        cards={cards}
        busy={flow.busy}
        onClose={flow.cancel}
        onSave={flow.submit}
      />

      <Dialog
        size="sm"
        open={flow.conflict !== null}
        onClose={flow.closeConflict}
        title={t('combos.conflict.title')}
        footer={
          <>
            <Button variant="secondary" disabled={flow.busy} onClick={flow.reload} className={TOUCH}>
              {t('combos.conflict.reload')}
            </Button>
            <Button disabled={flow.busy} onClick={flow.saveAsNew} className={TOUCH}>
              {t('combos.saveAsNew')}
            </Button>
          </>
        }
      >
        <p className="text-ink body">{t('combos.conflict.body')}</p>
      </Dialog>
    </>
  )
}
