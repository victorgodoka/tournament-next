'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Chip, FilterChip } from '@ui/chip'
import { TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import { copyLimit, type DeckCard } from '@utils/combo/deck-cards'
import type { Roles } from '@utils/combo/types'
import { CARD_ART_URL } from '@utils/const'
import type { Banlist } from '@utils/wiki'

const TOUCH = 'max-lg:min-h-11'

type CardRolesProps = {
  /** The build's distinct main-deck cards, 0-copy rows included. */
  rows: DeckCard[]
  roles: Roles
  palette: string[]
  /** Copies in the deck as loaded, by canonical id: a row that differs is marked. */
  originalCopies: ReadonlyMap<number, number>
  banlist: Banlist | null
  /** Extra + side cards: shown as a count, never drawn. */
  notDrawn: number
  onToggle(id: number, role: string): void
  onCopies(id: number, copies: number, passcode: number): void
  onRestore(): void
}

/** One row per distinct main-deck card: art, name, what-if copies within the format's limit, role chips. */
export const CardRoles = (p: CardRolesProps) => {
  const t = useTranslations('Calculator')
  const total = p.rows.reduce((sum, row) => sum + row.copies, 0)
  const changed = (row: DeckCard) => (p.originalCopies.get(row.id) ?? 0) !== row.copies
  const anyChanged = p.rows.some(changed)

  return (
    <Panel
      title={t('deck.title')}
      meta={t('deck.size', { count: total })}
      actions={
        anyChanged ? (
          <Button variant="secondary" size="sm" onClick={p.onRestore} className={TOUCH}>
            {t('deck.restore')}
          </Button>
        ) : null
      }
    >
      {p.notDrawn > 0 ? <p className="mb-3 text-ink-muted signal-sm">{t('deck.notDrawn', { count: p.notDrawn })}</p> : null}
      <ul className="flex flex-col">
        {p.rows.map((row) => {
          const name = row.card?.name ?? String(row.passcode)
          const limit = copyLimit(row.card, p.banlist)
          const canAdd = row.copies < limit
          const canRemove = row.copies > 0
          const mine = p.roles.get(row.id) ?? []
          return (
            <li key={row.id} className={twMerge('flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2.5 last:border-b-0', row.copies === 0 && 'opacity-(--opacity-dim)')}>
              <span className="relative aspect-[4/3] w-12 shrink-0 bg-surface-300">
                {row.card ? <Image src={CARD_ART_URL(row.passcode)} alt="" fill sizes="48px" className="object-cover" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-ink body-strong">{name}</span>
                <span className="flex flex-wrap items-center gap-2 text-ink-muted signal-sm">
                  {row.card ? null : <span>{t('deck.unknown')}</span>}
                  {changed(row) ? <Chip tone="cyan">{t('deck.changed')}</Chip> : null}
                </span>
              </span>
              <span role="group" aria-label={t('deck.copiesOf', { name })} className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={t('deck.fewer', { name })}
                  aria-disabled={!canRemove || undefined}
                  onClick={() => canRemove && p.onCopies(row.id, row.copies - 1, row.passcode)}
                  className={TOUCH}
                >
                  −
                </Button>
                <span className="min-w-6 text-center text-ink data">{row.copies}</span>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={t('deck.more', { name })}
                  aria-disabled={!canAdd || undefined}
                  onClick={() => canAdd && p.onCopies(row.id, row.copies + 1, row.passcode)}
                  className={TOUCH}
                >
                  +
                </Button>
              </span>
              <div className="flex basis-full flex-wrap items-center gap-1">
                {p.palette.map((role) => (
                  <FilterChip
                    key={role}
                    pressed={mine.some((r) => r.toLowerCase() === role.toLowerCase())}
                    label={role}
                    aria-label={t('deck.roleOf', { role, name })}
                    onClick={() => p.onToggle(row.id, role)}
                    // The chip is 42px by design; a phone wants 44.
                    className="max-lg:py-1.25"
                  />
                ))}
                <TextInput
                  aria-label={t('deck.addRole')}
                  placeholder={t('deck.addRolePlaceholder')}
                  maxLength={24}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const value = e.currentTarget.value
                    if (!value.trim()) return
                    p.onToggle(row.id, value)
                    e.currentTarget.value = ''
                  }}
                  plateClassName="h-8.5 min-w-36 max-lg:h-11"
                  className="text-sm"
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
