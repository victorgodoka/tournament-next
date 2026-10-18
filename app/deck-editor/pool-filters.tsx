'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { useLazyText } from '@hooks/index'
import { Button } from '@ui/button'
import { FilterChip, Tag } from '@ui/chip'
import { Switch } from '@ui/choice'
import { FIELD_LABEL, TextInput } from '@ui/field'
import { Icon } from '@ui/icon'
import { Lookup, type LookupOption } from '@ui/lookup'
import { findArchetypes, type PoolQuery } from '@utils/cards'
import { releaseRegion } from '@utils/deck/rules'
import { titleCase, type Banlist, type CardKind } from '@utils/wiki'
import { ATTRIBUTES, resetFilters, toggle } from './pool-query'

const KINDS: CardKind[] = ['monster', 'spell', 'trap']
const TYPES = ['normal', 'effect', 'fusion', 'ritual', 'synchro', 'xyz', 'pendulum', 'link', 'tuner', 'flip', 'toon', 'spirit', 'union', 'gemini', 'token', 'special_summon']
const RACES = [
  'warrior', 'spellcaster', 'fairy', 'fiend', 'zombie', 'machine', 'aqua', 'pyro', 'rock', 'winged_beast', 'plant', 'insect', 'thunder',
  'dragon', 'beast', 'beast_warrior', 'dinosaur', 'fish', 'sea_serpent', 'reptile', 'psychic', 'divine_beast', 'creator_god', 'wyrm', 'cyberse', 'illusion',
]
const STATUSES = ['forbidden', 'limited', 'semi_limited', 'unlimited'] as const
/** Row by row; `null` is the centre, which is not an arrow. */
const ARROWS = ['top_left', 'top', 'top_right', 'left', null, 'right', 'bottom_left', 'bottom', 'bottom_right'] as const
const ARROW_GLYPH: Record<string, string> = { top_left: '↖', top: '↑', top_right: '↗', left: '←', right: '→', bottom_left: '↙', bottom: '↓', bottom_right: '↘' }

type RangeKey = 'level' | 'atk' | 'def' | 'scale' | 'points'

/** Module-level, so `Lookup` gets a stable search. */
const searchArchetypes = async (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  (await findArchetypes(text, signal)).map(({ name }) => ({ key: name, label: name }))

const toInt = (value: string) => (value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Math.trunc(Number(value)))

type RangeInputProps = { value: number | undefined; onCommit(value: number | undefined): void; 'aria-label': string; placeholder: string }

/** A number that reaches the query 250 ms after typing stops (or on blur), like the search text. */
const RangeInput = ({ value, onCommit, ...props }: RangeInputProps) => {
  const lazy = useLazyText(value === undefined ? '' : String(value), (text) => onCommit(toInt(text)), 250)
  // `w-0`: a number input's intrinsic width would widen the two-column grid past the drawer; flex-1 fills the plate.
  return <TextInput type="number" inputMode="numeric" plateClassName="min-w-0 flex-1 max-lg:h-11" className="w-0" {...props} {...lazy} />
}

type PoolFiltersProps = {
  open: boolean
  onClose(): void
  query: PoolQuery
  onChange(query: PoolQuery): void
  banlist: Banlist | null
}

/**
 * Every `GET /cards` filter, in a drawer from the right (a full-screen sheet below lg). Changes apply
 * as they are made; Done closes.
 */
export const PoolFilters = ({ open, onClose, query, onChange, banlist }: PoolFiltersProps) => {
  const t = useTranslations('DeckEditor.filters')
  const tPool = useTranslations('DeckEditor.pool')
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const region = banlist && releaseRegion(banlist.format)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const patch = (next: Partial<PoolQuery>) => onChange({ ...query, ...next })

  const chips = (key: 'types' | 'race' | 'attribute' | 'status', values: readonly string[], label: (v: string) => string) => (
    <div className="flex flex-wrap gap-x-1">
      {values.map((v) => (
        <FilterChip key={v} pressed={query[key].includes(v)} label={label(v)} onClick={() => patch({ [key]: toggle(query[key], v) })} className="max-lg:py-1.25" />
      ))}
    </div>
  )

  const range = (key: RangeKey) => (
    // A fieldset is min-content wide by default: min-w-0 keeps it in its grid column.
    <fieldset className="flex min-w-0 flex-col">
      <legend className={FIELD_LABEL}>{t(key)}</legend>
      <div className="flex gap-2">
        {(['Min', 'Max'] as const).map((end) => (
          <RangeInput
            key={end}
            aria-label={t(`range${end}`, { label: t(key) })}
            placeholder={t(`range${end}Short`)}
            value={query[`${key}${end}`]}
            onCommit={(value) => patch({ [`${key}${end}`]: value })}
          />
        ))}
      </div>
    </fieldset>
  )

  const section = (label: string, children: React.ReactNode) => (
    <section className="flex flex-col gap-2">
      <h3 className={FIELD_LABEL}>{label}</h3>
      {children}
    </section>
  )

  return (
    // Native <dialog> for the focus trap, Escape and focus return, as the nav drawer does.
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(440px,92vw)] max-w-none flex-col border-l border-line-mid max-lg:w-full max-lg:border-l-0 bg-surface-100 text-ink shadow-lift open:flex backdrop:bg-scrim motion-safe:open:animate-drawer-in motion-safe:backdrop:animate-fade-in"
    >
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-5">
        <h2 id={titleId} className="signal-strong">{t('title')}</h2>
        <Button variant="ghost" size="icon" aria-label={t('close')} onClick={onClose} className="max-lg:size-11">
          <Icon name="close" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto px-5 py-5 [scrollbar-color:var(--color-line-mid)_transparent] [scrollbar-width:thin]">
        <div className="flex flex-col gap-2">
          {section(
            t('kind'),
            <div className="flex flex-wrap gap-x-1">
              {KINDS.map((kind) => (
                <FilterChip key={kind} pressed={query.kind.includes(kind)} label={tPool(kind)} onClick={() => patch({ kind: toggle(query.kind, kind) })} className="max-lg:py-1.25" />
              ))}
              <FilterChip pressed={!!query.extraDeck} label={tPool('extra')} onClick={() => patch({ extraDeck: query.extraDeck ? undefined : true })} className="max-lg:py-1.25" />
            </div>,
          )}
          <Switch quiet checked={query.legalOnly} onChange={(legalOnly) => patch({ legalOnly })} label={tPool('legalOnly')} disabled={!banlist} className="max-lg:min-h-11" />
        </div>
        {section(
          t('archetype'),
          query.archetype ? (
            <div>
              <Tag removeLabel={t('removeArchetype', { name: query.archetype })} onRemove={() => patch({ archetype: undefined })}>
                {query.archetype}
              </Tag>
            </div>
          ) : (
            <Lookup label={t('archetype')} placeholder={t('archetypeSearch')} search={searchArchetypes} onPick={(o) => patch({ archetype: String(o.key) })} className="max-lg:[&>label]:h-11" />
          ),
        )}
        {section(t('types'), chips('types', TYPES, titleCase))}
        {section(t('race'), chips('race', RACES, titleCase))}
        {section(t('attribute'), chips('attribute', ATTRIBUTES, titleCase))}

        <div className="grid grid-cols-2 gap-4">
          {range('level')}
          {range('scale')}
          {range('atk')}
          {range('def')}
        </div>

        {section(
          t('linkArrows'),
          <div role="group" aria-label={t('linkArrows')} className="grid w-fit grid-cols-3 gap-1">
            {ARROWS.map((arrow, i) =>
              arrow ? (
                <button
                  key={arrow}
                  type="button"
                  aria-pressed={query.linkMarkers.includes(arrow)}
                  aria-label={t(`arrows.${arrow}`)}
                  onClick={() => patch({ linkMarkers: toggle(query.linkMarkers, arrow) })}
                  className={twMerge(
                    'cut grid size-10 cursor-pointer max-lg:size-11 place-items-center text-lg [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)]',
                    query.linkMarkers.includes(arrow) ? 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]' : 'text-ink-dim hover:text-ink',
                  )}
                >
                  <span aria-hidden>{ARROW_GLYPH[arrow]}</span>
                </button>
              ) : (
                <button key={i} type="button" disabled aria-hidden tabIndex={-1} className="size-10 bg-surface-300 opacity-(--opacity-dim) max-lg:size-11" />
              ),
            )}
          </div>,
        )}

        <fieldset className="flex min-w-0 flex-col" disabled={!region}>
          <legend className={FIELD_LABEL}>{t('release')}</legend>
          <div className="flex gap-2">
            {(['releasedAfter', 'releasedBefore'] as const).map((key) => (
              <TextInput
                key={key}
                type="date"
                aria-label={t(key)}
                value={query[key] ?? ''}
                onChange={(e) => patch({ [key]: e.target.value || undefined })}
                plateClassName="min-w-0 flex-1 max-lg:h-11"
                className="w-0"
              />
            ))}
          </div>
          <p className="mt-1.5 caption text-ink-muted">{region ? t('releaseHint', { region: region.toUpperCase() }) : t('releaseNeedsFormat')}</p>
        </fieldset>

        {banlist && banlist.pointCap === null ? section(t('status'), chips('status', STATUSES, (s) => t(`statuses.${s as (typeof STATUSES)[number]}`))) : null}
        {banlist && banlist.pointCap !== null ? range('points') : null}
      </div>

      <footer className="flex items-center justify-end gap-3 border-t border-line p-5">
        <Button variant="ghost" onClick={() => onChange(resetFilters(query))} className="max-lg:min-h-11">
          {t('reset')}
        </Button>
        <Button onClick={onClose} className="max-lg:min-h-11">
          {t('done')}
        </Button>
      </footer>
    </dialog>
  )
}
