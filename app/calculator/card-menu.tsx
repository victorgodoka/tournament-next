'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { TextInput } from '@ui/field'
import { Icon } from '@ui/icon'
import { copyLimit, oncePerTurn, type DeckCard } from '@utils/combo/deck-cards'
import { normalizeRole, sameRole } from '@utils/combo/roles'
import type { Roles } from '@utils/combo/types'
import type { Banlist } from '@utils/wiki'
import { tagMeta } from './tags'

const TOUCH = 'max-lg:min-h-11'

/** Gap kept to the viewport's edge, in px. */
const EDGE = 8

// The toolbar's popover look, placed by `place` from `sm` and a bottom sheet below it. `fixed` beats `.cut`'s position: relative;
// the sheet's `!` beats the inline top/left, so a resize across `sm` needs no re-placing.
const MENU =
  'cut notch fixed inset-auto m-0 w-80 border-0 bg-transparent p-3 text-ink [--cut:var(--cut-md)] [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)] max-sm:inset-x-0! max-sm:top-auto! max-sm:bottom-0! max-sm:w-auto'

type CardMenuProps = {
  row: DeckCard
  roles: Roles
  palette: readonly string[]
  /** The tile the menu opened from: positions it. */
  anchor: HTMLElement | null
  /** The card's copies differ from the deck as loaded. */
  changed: boolean
  banlist: Banlist | null
  onToggle(id: number, role: string): void
  onCopies(id: number, copies: number, passcode: number): void
  onClose(): void
}

/** Under the anchor, above it when the menu would run off the bottom; kept `EDGE` px inside the viewport's sides. */
const place = (menu: HTMLElement, anchor: HTMLElement | null) => {
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const { offsetWidth, offsetHeight } = menu
  menu.style.top = `${rect.bottom + offsetHeight > window.innerHeight ? rect.top - offsetHeight : rect.bottom}px`
  menu.style.left = `${Math.max(EDGE, Math.min(rect.left, window.innerWidth - offsetWidth - EDGE))}px`
}

/** One card's popover: what-if copies within the format's limit, and a checkbox per tag. A bottom sheet below `sm`. */
export const CardMenu = (p: CardMenuProps) => {
  const t = useTranslations('Calculator')
  const name = p.row.card?.name ?? String(p.row.passcode)
  const canAdd = p.row.copies < copyLimit(p.row.card, p.banlist)
  const canRemove = p.row.copies > 0
  const mine = p.roles.get(p.row.id) ?? []
  const opt = p.row.card ? oncePerTurn(p.row.card.description) : null

  const show = useCallback(
    (menu: HTMLDivElement | null) => {
      if (!menu) return
      // StrictMode attaches a ref twice, and showing an open popover throws.
      if (menu.showPopover && !menu.matches(':popover-open')) menu.showPopover()
      place(menu, p.anchor)
    },
    [p.anchor],
  )

  return (
    <div
      ref={show}
      popover="auto"
      role="dialog"
      aria-label={name}
      // Light dismiss and Escape close a popover without asking.
      onToggle={(e) => {
        if (e.nativeEvent.newState === 'closed') p.onClose()
      }}
      className={MENU}
    >
      <div className="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-ink body-strong">{name}</span>
            <span className="flex flex-wrap items-center gap-2 text-ink-muted signal-sm">
              {p.row.card ? null : <span>{t('deck.unknown')}</span>}
              {opt ? <Chip title={t('deck.optHint')}>{t(opt === 'HOPT' ? 'deck.hopt' : 'deck.opt')}</Chip> : null}
              {p.changed ? <Chip tone="cyan">{t('deck.changed')}</Chip> : null}
            </span>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={t('menu.close')} onClick={p.onClose} className={TOUCH}>
            <Icon name="close" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted signal-sm">{t('menu.copies')}</span>
          <span role="group" aria-label={t('deck.copiesOf', { name })} className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={t('deck.fewer', { name })}
              aria-disabled={!canRemove || undefined}
              onClick={() => canRemove && p.onCopies(p.row.id, p.row.copies - 1, p.row.passcode)}
              className={TOUCH}
            >
              −
            </Button>
            <span className="min-w-6 text-center text-ink data">{p.row.copies}</span>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={t('deck.more', { name })}
              aria-disabled={!canAdd || undefined}
              onClick={() => canAdd && p.onCopies(p.row.id, p.row.copies + 1, p.row.passcode)}
              className={TOUCH}
            >
              +
            </Button>
          </span>
        </div>

        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 text-ink-muted signal-sm">{t('menu.tags')}</legend>
          <div className="grid grid-cols-2 gap-1">
            {p.palette.map((role) => {
              const { icon, tone } = tagMeta(role)
              return (
                <label
                  key={role}
                  className={twMerge(
                    'cut flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1.5 text-ink body-sm [--cut:var(--cut-xs)] [--fill:var(--color-surface-300)] has-checked:[--edge:var(--color-cyan)] has-focus-visible:shadow-focus-ring',
                    TOUCH,
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={mine.some((r) => sameRole(r, role))}
                    aria-label={t('tags.toggle', { role, name })}
                    onChange={() => p.onToggle(p.row.id, role)}
                  />
                  <span style={{ color: tone }}>
                    <Icon name={icon} />
                  </span>
                  <span className="truncate">{role}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <TextInput
          aria-label={t('tags.newTag')}
          placeholder={t('tags.newTagPlaceholder')}
          maxLength={24}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const role = normalizeRole(e.currentTarget.value)
            if (role === null) return
            p.onToggle(p.row.id, role)
            e.currentTarget.value = ''
          }}
          plateClassName="h-8.5 max-lg:h-11"
          className="text-sm"
        />
      </div>
    </div>
  )
}
