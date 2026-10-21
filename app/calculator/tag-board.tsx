'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { FilterChip } from '@ui/chip'
import { TextInput } from '@ui/field'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { CardTile } from '@app/deck-builder/card-tile'
import { useLongPress } from '@app/deck-builder/gestures'
import type { DeckCard } from '@utils/combo/deck-cards'
import { normalizeRole, sameRole } from '@utils/combo/roles'
import type { Hand, Roles } from '@utils/combo/types'
import type { Banlist } from '@utils/wiki'
import { CardMenu } from './card-menu'
import { roleCopies, suggestedRule, tagGroups, tagMeta, untaggedCount } from './tags'

const TOUCH = 'max-lg:min-h-11'
const DIM = 'opacity-(--opacity-dim)'
/** Pips on a tile before the rest show as `+N`. */
const PIPS = 4

// Sticky from `lg`: at the top while the site header scrolls away, under it once the header is fixed (`xl`, 60px tall); the
// breathing room is the strip's own padding, on its opaque background. Below `lg`, a bar fixed to the bottom of the viewport that scrolls sideways.
const STRIP =
  'z-(--z-sticky) border-line bg-space-000 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:border-t max-lg:pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:border-b xl:top-15'

export type TourEvent = 'brush' | 'paint' | 'menu'

type TagBoardProps = {
  /** The build's distinct main-deck cards, 0-copy rows included. */
  rows: DeckCard[]
  roles: Roles
  palette: string[]
  /** The tags their rules name make the "In your hands" group. */
  hands: readonly Hand[]
  /** Copies in the deck as loaded, by canonical id: a row that differs is marked. */
  originalCopies: ReadonlyMap<number, number>
  banlist: Banlist | null
  /** Extra + side cards: shown as a count, never drawn. */
  notDrawn: number
  onSetRole(id: number, role: string, on: boolean): void
  onToggle(id: number, role: string): void
  onCopies(id: number, copies: number, passcode: number): void
  onRestore(): void
  /** Adds the tag's suggested rule to the hands. */
  onSuggest(role: string): void
  /** Called once at the start of every paint stroke, before its first `onSetRole`. */
  onPainted?(): void
  onTour?(event: TourEvent): void
  /** The `?` button. Not rendered when absent. */
  onHelp?(): void
}

/** Keys typed here belong to the field or the open card menu, not the board: the menu's Escape is its own, and gives focus back to the tile. */
const typing = (target: EventTarget | null) => target instanceof Element && target.closest('input, textarea, select, [contenteditable], [popover]') !== null

/** A strip of tag brushes over a grid of the deck's cards: pick a brush, then click, drag or tap cards to paint it on. */
export const TagBoard = (p: TagBoardProps) => {
  const t = useTranslations('Calculator')
  const [brush, setBrush] = useState<string | null>(null)
  const [dimTagged, setDimTagged] = useState(false)
  const [menu, setMenu] = useState<{ id: number; anchor: HTMLElement | null } | null>(null)
  const [creating, setCreating] = useState(false)
  /** A mouse stroke in progress: every tile it enters goes the way the first one went. */
  const stroke = useRef<{ on: boolean; end(): void } | null>(null)
  const { bind, kind } = useLongPress()

  const total = p.rows.reduce((sum, row) => sum + row.copies, 0)
  const changed = (row: DeckCard) => (p.originalCopies.get(row.id) ?? 0) !== row.copies
  const menuRow = menu && p.rows.find((row) => row.id === menu.id)
  // Its card left the grid (another build, another deck): the menu stays closed should the card come back.
  if (menu && !menuRow) setMenu(null)

  // A brush no card carries yet still gets its pill.
  const fresh = brush !== null && !p.palette.some((role) => sameRole(role, brush))
  const { used, labels } = tagGroups(fresh ? [...p.palette, brush] : p.palette, p.hands)
  const shown = [...used, ...labels]

  const has = (row: DeckCard, role: string) => (p.roles.get(row.id) ?? []).some((r) => sameRole(r, role))

  const pick = (role: string) => {
    if (brush !== null && sameRole(brush, role)) return setBrush(null)
    setBrush(role)
    p.onTour?.('brush')
  }
  const openMenu = (id: number, anchor: HTMLElement | null) => {
    setMenu({ id, anchor })
    p.onTour?.('menu')
  }
  /** Flips the tag on the card; returns the direction. */
  const paint = (row: DeckCard, role: string) => {
    const on = !has(row, role)
    p.onPainted?.()
    p.onSetRole(row.id, role, on)
    p.onTour?.('paint')
    return on
  }
  const startStroke = (row: DeckCard, role: string) => {
    stroke.current?.end() // one whose release never arrived
    const end = () => {
      stroke.current = null
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    stroke.current = { on: paint(row, role), end }
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    // Shift is no modifier here: AZERTY types its digits with it. A held key repeats: it must not toggle the brush on and off.
    if (e.repeat || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape') return menu ? setMenu(null) : setBrush(null)
    const role = /^[1-9]$/.test(e.key) ? shown[Number(e.key) - 1] : undefined
    if (role !== undefined) pick(role)
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pill = (role: string, suggest: boolean) => {
    const { icon, tone, suggest: rule } = tagMeta(role)
    const n = shown.indexOf(role)
    const count = roleCopies(p.rows, p.roles, role)
    const useInHands = t('tags.useInHands', { role, rule: t(rule === 'avoid' ? 'tags.ruleAvoid' : 'tags.ruleNeed') })
    return (
      <span key={role} className="flex shrink-0 items-center">
        <FilterChip
          pressed={brush !== null && sameRole(brush, role)}
          aria-label={t('tags.brush', { role, count })}
          onClick={() => pick(role)}
          label={
            <>
              {n < 9 ? <kbd className="text-ink-muted max-lg:hidden">{n + 1}</kbd> : null}
              <span style={{ color: tone }}>
                <Icon name={icon} size={14} />
              </span>
              {role}
            </>
          }
          count={count}
          className={TOUCH}
        />
        {suggest && suggestedRule(role) ? (
          <Button variant="ghost" size="icon-sm" aria-label={useInHands} title={useInHands} onClick={() => p.onSuggest(role)} className={TOUCH}>
            <Icon name="plus" size={14} />
          </Button>
        ) : null}
      </span>
    )
  }
  const group = (title: string, roles: string[], suggest: boolean) =>
    roles.length ? (
      <div className="flex shrink-0 items-center gap-1 lg:shrink lg:flex-wrap">
        <span className="mr-1 text-ink-muted signal-sm">{title}</span>
        {roles.map((role) => pill(role, suggest))}
      </div>
    ) : null
  const slug = brush === null ? null : tagMeta(brush).slug

  return (
    <>
      <section data-tour="strip" aria-label={t('tags.title')} className={STRIP}>
        <div className="flex items-center gap-x-4 gap-y-1 overflow-x-auto px-4 pt-2 lg:flex-wrap lg:overflow-visible lg:px-0">
          {group(t('tags.inHands'), used, false)}
          {group(t('tags.labels'), labels, true)}
          {creating ? (
            <TextInput
              autoFocus
              aria-label={t('tags.newTag')}
              placeholder={t('tags.newTagPlaceholder')}
              maxLength={24}
              onKeyDown={(e) => {
                if (e.key === 'Escape') return setCreating(false)
                if (e.key !== 'Enter') return
                e.preventDefault()
                const role = normalizeRole(e.currentTarget.value)
                if (role === null) return
                setBrush(role)
                p.onTour?.('brush')
                setCreating(false)
              }}
              plateClassName="h-8.5 w-40 shrink-0 max-lg:h-11"
              className="text-sm"
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className={twMerge('shrink-0', TOUCH)}>
              <Icon name="plus" size={14} />
              {t('tags.newTag')}
            </Button>
          )}
          <FilterChip
            pressed={dimTagged}
            label={t('tags.untagged', { count: untaggedCount(p.rows, p.roles) })}
            title={t('tags.untaggedHint')}
            onClick={() => setDimTagged((on) => !on)}
            className={TOUCH}
          />
          {p.onHelp ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('tags.help')}
              // The tour's first step waits for a pick: a brush already in hand would make the highlighted pill a put-down.
              onClick={() => {
                stroke.current?.end()
                setBrush(null)
                p.onHelp?.()
              }}
              className={twMerge('ml-auto shrink-0', TOUCH)}
            >
              ?
            </Button>
          ) : null}
        </div>
        <p aria-live="polite" className="min-h-5 truncate px-4 pb-2 text-ink-muted signal-sm lg:px-0">
          {brush !== null ? (
            <>
              <span className="text-ink">{t('tags.painting', { role: brush })}</span> · <span>{slug ? t(`tags.desc.${slug}`) : t('tags.custom')}</span> ·{' '}
              <span>{t('tags.stop')}</span>
            </>
          ) : null}
        </p>
      </section>

      <Panel
        title={t('deck.title')}
        meta={t('deck.size', { count: total })}
        actions={
          p.rows.some(changed) ? (
            <Button variant="secondary" size="sm" onClick={p.onRestore} className={TOUCH}>
              {t('deck.restore')}
            </Button>
          ) : null
        }
      >
        {p.notDrawn > 0 ? <p className="mb-3 text-ink-muted signal-sm">{t('deck.notDrawn', { count: p.notDrawn })}</p> : null}
        <div data-tour="grid" className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(76px,1fr))]">
          {p.rows.map((row) => {
            const name = row.card?.name ?? String(row.passcode)
            const mine = p.roles.get(row.id) ?? []
            // A long press has no event to take the tile from (`shakeTiles` finds tiles the same way).
            const press = bind(() => openMenu(row.id, document.querySelector<HTMLElement>(`[data-card="${row.id}"] [data-tile]`)))
            return (
              <div key={row.id} data-card={row.id} className={twMerge('relative', (row.copies === 0 || (dimTagged && mine.length > 0)) && DIM)}>
                <CardTile
                  id={row.passcode}
                  card={row.card ?? undefined}
                  sizes="80px"
                  count={row.copies}
                  label={mine.length ? t('tags.tileTags', { name, count: row.copies, tags: mine.join(', ') }) : t('tags.tile', { name, count: row.copies })}
                  // With a brush, whether the tile carries it: the ring, for a screen reader.
                  aria-pressed={brush === null ? undefined : has(row, brush)}
                  {...press}
                  // Touch never paints here: a scroll that starts on a tile paints nothing. Nor does a Ctrl-click: on macOS
                  // it is a right-click, and its contextmenu opens the menu.
                  onPointerDown={(e) => {
                    press.onPointerDown(e)
                    if (brush !== null && e.pointerType === 'mouse' && e.button === 0 && !e.ctrlKey) startStroke(row, brush)
                  }}
                  onPointerEnter={(e) => {
                    const live = stroke.current
                    if (!live || e.pointerType !== 'mouse') return
                    // The button is up: the window never saw its release (alt-tab, an OS gesture). That stroke is over.
                    if (!(e.buttons & 1)) return live.end()
                    if (brush === null || has(row, brush) === live.on) return
                    p.onSetRole(row.id, brush, live.on)
                    p.onTour?.('paint')
                  }}
                  onClick={(e) => {
                    const how = kind(e)
                    if (how === 'long') return // the long press opened the menu
                    if (brush === null) return openMenu(row.id, e.currentTarget)
                    // A mouse click already painted on its pointer-down.
                    if (how === 'tap' || e.detail === 0) paint(row, brush)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (kind(e) === 'click') openMenu(row.id, e.currentTarget)
                  }}
                />
                {mine.length ? (
                  <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 flex items-center gap-0.5 bg-space-000 p-0.5 font-mono text-[10px] leading-none text-ink">
                    {mine.slice(0, PIPS).map((role) => (
                      <i key={role} className="block size-1.5" style={{ background: tagMeta(role).tone }} />
                    ))}
                    {mine.length > PIPS ? `+${mine.length - PIPS}` : null}
                  </span>
                ) : null}
                {brush !== null && has(row, brush) ? (
                  <span aria-hidden className="pointer-events-none absolute inset-0 outline-2" style={{ outlineColor: tagMeta(brush).tone }} />
                ) : null}
              </div>
            )
          })}
        </div>
      </Panel>

      {menu && menuRow ? (
        <CardMenu
          key={menuRow.id}
          row={menuRow}
          roles={p.roles}
          palette={p.palette}
          anchor={menu.anchor}
          changed={changed(menuRow)}
          banlist={p.banlist}
          onToggle={p.onToggle}
          onCopies={p.onCopies}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </>
  )
}
