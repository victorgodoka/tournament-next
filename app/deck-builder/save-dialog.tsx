'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { FilterChip } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { Dialog } from '@ui/dialog'
import { Field, Select, TextArea, TextInput } from '@ui/field'
import { CARD_ART_URL } from '@utils/const'
import { cardLoader } from '@utils/image-loader'
import { DECK_TAGS, listSeasons, seasonName, VISIBILITIES, type DeckMeta, type Season } from '@utils/decks'
import type { SaveDetails } from './use-save'

const FORM_ID = 'deck-save'
const TOUCH = 'max-lg:min-h-11'
const MAX_LINKS = 5

type SaveDialogProps = {
  open: boolean
  onClose(): void
  name: string
  meta: DeckMeta
  /** The deck's passcodes, in deck order: the cover choices. */
  cards: number[]
  nameOf(cardId: number): string
  onSave(details: SaveDetails): void
}

/** Name and showcase of the deck, confirmed before every save from the Save button. */
export const SaveDialog = (p: SaveDialogProps) => {
  const t = useTranslations('DeckEditor')
  return (
    <Dialog
      open={p.open}
      onClose={p.onClose}
      title={t('saveDialog.title')}
      footer={
        <>
          <Button variant="secondary" onClick={p.onClose} className={twMerge('ml-auto', TOUCH)}>
            {t('myDecks.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} className={TOUCH}>
            {t('toolbar.save')}
          </Button>
        </>
      }
    >
      {/* The Dialog only renders an open body: the form starts from the deck each time it opens. */}
      <SaveForm {...p} />
    </Dialog>
  )
}

const isLink = (raw: string) => {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const SaveForm = (p: SaveDialogProps) => {
  const t = useTranslations('DeckEditor')
  const [name, setName] = useState(p.name)
  const [meta, setMeta] = useState(p.meta)
  const [links, setLinks] = useState(p.meta.links.join('\n'))
  const [seasons, setSeasons] = useState<Season[]>([])
  const set = (patch: Partial<DeckMeta>) => setMeta((m) => ({ ...m, ...patch }))
  const covers = [...new Set(p.cards)]

  useEffect(() => {
    listSeasons().then(setSeasons)
  }, [])

  const linkList = links.split('\n').map((l) => l.trim()).filter(Boolean)
  const linkError = linkList.length > MAX_LINKS ? t('saveDialog.tooManyLinks', { max: MAX_LINKS })
    : linkList.some((l) => !isLink(l)) ? t('saveDialog.badLink')
      : null

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-6 overflow-y-auto px-5 py-6 min-[720px]:px-8"
      onSubmit={(e) => {
        e.preventDefault()
        if (linkError) return
        p.onSave({ ...meta, name, links: linkList, description: meta.description.trim() })
      }}
    >
      <Field label={t('toolbar.name')} htmlFor="deck-save-name">
        <TextInput id="deck-save-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('newDeck')} maxLength={80} />
      </Field>

      <Field label={t('saveDialog.visibility')} hint={t(`saveDialog.visibilityHint.${meta.visibility}`)}>
        <Segmented
          label={t('saveDialog.visibility')}
          value={meta.visibility}
          onChange={(visibility) => set({ visibility })}
          options={VISIBILITIES.map((v) => ({ value: v, label: t(`myDecks.visibility.${v}`) }))}
        />
      </Field>

      <Field label={t('saveDialog.season')} htmlFor="deck-save-season" hint={t('saveDialog.seasonHint')}>
        <Select
          id="deck-save-season"
          block
          options={[{ value: '', label: t('saveDialog.noSeason') }, ...seasons.map((s) => ({ value: String(s.id), label: seasonName(s) }))]}
          value={meta.seasonId === null ? '' : String(meta.seasonId)}
          onChange={(e) => set({ seasonId: e.target.value ? Number(e.target.value) : null })}
        />
      </Field>

      <Field label={t('saveDialog.tags')}>
        <div className="flex flex-wrap gap-2">
          {DECK_TAGS.map((tag) => {
            const on = meta.deckTags.includes(tag)
            return (
              <FilterChip
                key={tag}
                pressed={on}
                label={t(`deckTags.${tag}`)}
                onClick={() => set({ deckTags: on ? meta.deckTags.filter((x) => x !== tag) : [...meta.deckTags, tag] })}
              />
            )
          })}
        </div>
      </Field>

      <Field label={t('saveDialog.description')} htmlFor="deck-save-description" meta={`${meta.description.length}/300`}>
        <TextArea id="deck-save-description" value={meta.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} rows={2} />
      </Field>

      <Field label={t('saveDialog.links')} htmlFor="deck-save-links" hint={linkError ?? t('saveDialog.linksHint', { max: MAX_LINKS })} warn={!!linkError}>
        <TextArea id="deck-save-links" value={links} onChange={(e) => setLinks(e.target.value)} rows={3} mono placeholder="https://" />
      </Field>

      <Field label={t('saveDialog.cover')} hint={t('saveDialog.coverHint')}>
        <div role="radiogroup" aria-label={t('saveDialog.cover')} className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 overflow-y-auto">
          <CoverChoice checked={meta.coverCardId === null} onPick={() => set({ coverCardId: null })} label={t('saveDialog.coverAuto')}>
            <span className="grid size-full place-items-center px-1 text-center text-ink-muted signal-sm">{t('saveDialog.coverAuto')}</span>
          </CoverChoice>
          {covers.map((id) => (
            <CoverChoice key={id} checked={meta.coverCardId === id} onPick={() => set({ coverCardId: id })} label={p.nameOf(id)}>
              <Image loader={cardLoader} src={CARD_ART_URL(id)} alt="" fill sizes="96px" className="object-cover" />
            </CoverChoice>
          ))}
        </div>
      </Field>
    </form>
  )
}

const CoverChoice = ({ checked, onPick, label, children }: { checked: boolean; onPick(): void; label: string; children: React.ReactNode }) => (
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    aria-label={label}
    title={label}
    onClick={onPick}
    className={twMerge('relative aspect-square cursor-pointer overflow-hidden bg-surface-300 outline-offset-2', checked ? 'outline-2 outline-cyan' : 'opacity-70 hover:opacity-100')}
  >
    {children}
  </button>
)
