'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Select, TextInput } from '@ui/field'
import type { Problem } from '@utils/deck/rules'
import type { Banlist } from '@utils/wiki'
import type { ViewMode } from './deck-editor.reducer'

const POPOVER_ID = 'deck-problems'

type ToolbarProps = {
  name: string
  onRename(name: string): void
  banlists: Banlist[]
  banlist: Banlist | null
  onFormat(id: number): void
  problems: Problem[]
  /** Name shown for a problem's card (canonical id → a deck print's name, else the passcode). */
  nameOf(cardId: number): string
  onJump(problem: Problem): void
  /** Genesys lists only. */
  points: { used: number; cap: number } | null
  canUndo: boolean
  canRedo: boolean
  onUndo(): void
  onRedo(): void
  onSort(): void
  view: ViewMode
  onView(view: ViewMode): void
  dirty: boolean
  onSave(): void
}

const PILL = 'cut inline-flex h-9 items-center gap-2 px-3 signal-strong [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)]'

export const Toolbar = (p: ToolbarProps) => {
  const t = useTranslations('DeckEditor')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TextInput
        value={p.name}
        onChange={(e) => p.onRename(e.target.value)}
        placeholder={t('newDeck')}
        aria-label={t('toolbar.name')}
        maxLength={100}
        plateClassName="min-w-0 flex-1 basis-48"
      />
      <Select
        banlist
        aria-label={t('toolbar.format')}
        options={p.banlists.map((b) => ({ value: String(b.id), label: b.name }))}
        value={p.banlist ? String(p.banlist.id) : ''}
        onChange={(e) => p.onFormat(Number(e.target.value))}
        disabled={!p.banlists.length}
        className="min-w-44"
      />

      {p.problems.length ? (
        <>
          <button type="button" popoverTarget={POPOVER_ID} className={twMerge(PILL, 'cursor-pointer text-crimson-lift [--edge:var(--color-crimson-lift)] hover:[--fill:var(--color-surface-300)]')}>
            {t('problems', { count: p.problems.length })}
          </button>
          <div
            id={POPOVER_ID}
            popover="auto"
            aria-label={t('toolbar.problemsList')}
            // `fixed` beats `.cut`'s position: relative; the UA popover border and Canvas fill give way to the chamfer.
            className="cut notch fixed inset-x-4 top-32 bottom-auto mx-auto w-auto max-w-105 border-0 bg-transparent p-2 text-ink [--cut:var(--cut-md)] [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)]"
          >
            <ul className="flex flex-col">
              {p.problems.map((problem, i) => (
                <li key={i}>
                  <button
                    type="button"
                    popoverTarget={POPOVER_ID}
                    popoverTargetAction="hide"
                    onClick={() => p.onJump(problem)}
                    className="w-full cursor-pointer px-3 py-2 text-left body-sm hover:bg-surface-300"
                  >
                    {t(`problem.${problem.code}`, { count: problem.count ?? 0, limit: problem.limit ?? 0, name: problem.cardId === undefined ? '' : p.nameOf(problem.cardId) })}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <span role="status" className={twMerge(PILL, 'text-win [--edge:var(--color-win)]')}>
          {t('legal')}
        </span>
      )}

      {p.points ? (
        <span className={twMerge(PILL, p.points.used > p.points.cap ? 'text-crimson-lift' : 'text-gold')}>
          <span className="text-ink-muted">{t('toolbar.points')}</span>
          {t('toolbar.pointsValue', { used: p.points.used, cap: p.points.cap })}
        </span>
      ) : null}

      <div className="flex gap-1">
        <Button variant="secondary" size="mono" aria-disabled={!p.canUndo || undefined} onClick={p.onUndo}>
          {t('toolbar.undo')}
        </Button>
        <Button variant="secondary" size="mono" aria-disabled={!p.canRedo || undefined} onClick={p.onRedo}>
          {t('toolbar.redo')}
        </Button>
        <Button variant="secondary" size="mono" onClick={p.onSort}>
          {t('toolbar.sort')}
        </Button>
      </div>

      <Segmented
        size="sm"
        label={t('toolbar.view')}
        value={p.view}
        onChange={p.onView}
        options={(['grid', 'list', 'stacked'] as const).map((v) => ({ value: v, label: t(`views.${v}`) }))}
      />

      <Button size="mono" onClick={p.onSave} className="ml-auto">
        {t('toolbar.save')}
        {p.dirty ? (
          <>
            <span aria-hidden className="size-1.5 bg-cyan-on" />
            <span className="sr-only">{t('toolbar.unsaved')}</span>
          </>
        ) : null}
      </Button>
    </div>
  )
}
