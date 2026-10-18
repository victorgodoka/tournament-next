'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button, buttonClasses } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Select, TextArea, TextInput } from '@ui/field'
import type { Problem } from '@utils/deck/rules'
import type { Banlist } from '@utils/wiki'
import type { ViewMode } from './deck-editor.reducer'
import { DECK_NAME_ID } from './keyboard'

export const PROBLEMS_POPOVER = 'deck-problems'
const POPOVER_ID = PROBLEMS_POPOVER
const IMPORT_ID = 'deck-import'
const EXPORT_ID = 'deck-export'

/** `wide` / `tall`: the 16:9 and 9:16 images, downloaded. `share`: the 9:16 one through the share sheet. */
export type ExportKind = 'omega' | 'ydke' | 'ydk' | 'pdf' | 'list' | 'wide' | 'tall' | 'share'
const EXPORTS: ExportKind[] = ['omega', 'ydke', 'ydk', 'pdf', 'list', 'wide', 'tall', 'share']

// `fixed` beats `.cut`'s position: relative; the UA popover border and Canvas fill give way to the chamfer.
const MENU =
  'cut notch fixed inset-x-4 top-32 bottom-auto mx-auto w-auto max-w-105 border-0 bg-transparent p-2 text-ink [--cut:var(--cut-md)] [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)]'

/** `checking`: cards or banlists still loading. `unavailable`: the banlists failed, so no format checks ran. */
export type Validity = 'checking' | 'unavailable' | 'ready'

/** Below lg the toolbar lives in the deck tray's menu: 44px tap targets. */
const TOUCH = 'max-lg:min-h-11'

type ToolbarProps = {
  name: string
  onRename(name: string): void
  banlists: Banlist[]
  banlist: Banlist | null
  onFormat(id: number): void
  validity: Validity
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
  saving: boolean
  onSave(): void
  onMyDecks(): void
  /** A pasted Omega code, ydke:// URL or .ydk text. */
  onImport(text: string): void
  onImportFile(file: File): void
  onExport(kind: ExportKind): void
  /** The export menu opened: a phone starts drawing the image to share before the tap. */
  onExportOpen(): void
}

const PILL = 'cut inline-flex h-9 items-center gap-2 px-3 signal-strong [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)]'

export const Toolbar = (p: ToolbarProps) => {
  const t = useTranslations('DeckEditor')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TextInput
        id={DECK_NAME_ID}
        value={p.name}
        onChange={(e) => p.onRename(e.target.value)}
        placeholder={t('newDeck')}
        aria-label={t('toolbar.name')}
        maxLength={80}
        plateClassName="min-w-0 flex-1 basis-48 max-lg:h-11"
      />
      <Select
        banlist
        aria-label={t('toolbar.format')}
        options={p.banlists.map((b) => ({ value: String(b.id), label: b.name }))}
        value={p.banlist ? String(p.banlist.id) : ''}
        onChange={(e) => p.onFormat(Number(e.target.value))}
        disabled={!p.banlists.length}
        className="min-w-44 max-lg:h-11"
      />

      {p.validity === 'checking' ? (
        <span role="status" className={twMerge(PILL, 'text-ink-muted')}>
          {t('checking')}
        </span>
      ) : p.problems.length ? (
        <>
          <button type="button" popoverTarget={POPOVER_ID} className={twMerge(PILL, 'cursor-pointer text-crimson-lift [--edge:var(--color-crimson-lift)] hover:[--fill:var(--color-surface-300)]', TOUCH)}>
            {t('problems', { count: p.problems.length })}
          </button>
          <div id={POPOVER_ID} popover="auto" role="dialog" aria-label={t('toolbar.problemsList')} className={MENU}>
            <ul className="flex flex-col">
              {p.problems.map((problem, i) => (
                <li key={i}>
                  <button
                    type="button"
                    popoverTarget={POPOVER_ID}
                    popoverTargetAction="hide"
                    onClick={() => p.onJump(problem)}
                    className={twMerge('w-full cursor-pointer px-3 py-2 text-left body-sm hover:bg-surface-300', TOUCH)}
                  >
                    {t(`problem.${problem.code}`, { count: problem.count ?? 0, limit: problem.limit ?? 0, name: problem.cardId === undefined ? '' : p.nameOf(problem.cardId) })}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : p.validity === 'unavailable' ? (
        <span role="status" className={twMerge(PILL, 'text-ink-muted')}>
          {t('rulesUnavailable')}
        </span>
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
        <Button variant="secondary" size="mono" aria-disabled={!p.canUndo || undefined} onClick={p.onUndo} className={TOUCH}>
          {t('toolbar.undo')}
        </Button>
        <Button variant="secondary" size="mono" aria-disabled={!p.canRedo || undefined} onClick={p.onRedo} className={TOUCH}>
          {t('toolbar.redo')}
        </Button>
        <Button variant="secondary" size="mono" onClick={p.onSort} className={TOUCH}>
          {t('toolbar.sort')}
        </Button>
      </div>

      {/* Below lg the toolbar sits in the deck tray, which always lists; the view only changes the desktop deck. */}
      <Segmented
        size="sm"
        label={t('toolbar.view')}
        value={p.view}
        onChange={p.onView}
        options={(['grid', 'list', 'stacked'] as const).map((v) => ({ value: v, label: t(`views.${v}`) }))}
        className="max-lg:hidden"
      />

      <div className="flex gap-1 lg:ml-auto">
        <Button variant="secondary" size="mono" popoverTarget={IMPORT_ID} className={TOUCH}>
          {t('io.import')}
        </Button>
        <div id={IMPORT_ID} popover="auto" role="dialog" aria-label={t('io.import')} className={MENU}>
          <form
            className="flex flex-col gap-2 p-1"
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              const text = String(new FormData(form).get('code') ?? '')
              if (!text.trim()) return
              document.getElementById(IMPORT_ID)?.hidePopover()
              form.reset()
              p.onImport(text)
            }}
          >
            <TextArea name="code" mono rows={3} placeholder={t('io.placeholder')} aria-label={t('io.code')} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" className={TOUCH}>
                {t('io.importCode')}
              </Button>
              <label className={twMerge(buttonClasses({ variant: 'secondary', size: 'sm' }), 'cursor-pointer has-focus-visible:shadow-focus-ring', TOUCH)}>
                {t('io.importFile')}
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = '' // the same file again still fires
                    if (!file) return
                    document.getElementById(IMPORT_ID)?.hidePopover()
                    p.onImportFile(file)
                  }}
                />
              </label>
            </div>
            <p className="text-ink-muted body-sm max-lg:hidden">{t('io.pasteHint')}</p>
          </form>
        </div>

        <Button variant="secondary" size="mono" popoverTarget={EXPORT_ID} className={TOUCH}>
          {t('io.export')}
        </Button>
        <div
          id={EXPORT_ID}
          popover="auto"
          role="dialog"
          aria-label={t('io.export')}
          className={MENU}
          onToggle={(e) => {
            if (e.newState === 'open') p.onExportOpen()
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
                  onClick={() => p.onExport(kind)}
                  className={twMerge('w-full cursor-pointer px-3 py-2 text-left body-sm hover:bg-surface-300', TOUCH)}
                >
                  {t(`io.as.${kind}`)}
                </button>
              </li>
            ))}
          </ul>
          <p className="px-3 pt-1 pb-2 text-ink-muted body-sm max-lg:hidden">{t('io.copyHint')}</p>
        </div>
      </div>

      <Button variant="secondary" size="mono" onClick={p.onMyDecks} className={TOUCH}>
        {t('toolbar.myDecks')}
      </Button>
      <Button size="mono" aria-disabled={p.saving || undefined} onClick={p.onSave} className={TOUCH}>
        {p.saving ? t('toolbar.saving') : t('toolbar.save')}
        {p.dirty && !p.saving ? (
          <>
            <span aria-hidden className="size-1.5 bg-cyan-on" />
            <span className="sr-only">{t('toolbar.unsaved')}</span>
          </>
        ) : null}
      </Button>
    </div>
  )
}
