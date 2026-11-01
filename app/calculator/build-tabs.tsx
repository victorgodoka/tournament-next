'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { TabBar } from '@ui/tab-bar'
import { LIMITS, type Build } from '@utils/combo/types'

const TOUCH = 'max-lg:min-h-11'
const LETTERS = 'ABCDEF'

/** "A · Snake-Eye": the letter the compare table's deltas refer to, then the build's name. */
export const buildLabel = (build: Build, index: number, untitled: string): string => `${LETTERS[index] ?? index + 1} · ${build.name || untitled}`

type BuildTabsProps = {
  builds: Build[]
  active: number
  onSelect(index: number): void
  /** Opens the picker to add a build. */
  onAdd(): void
  /** Copies the active build as a what-if. */
  onDuplicate(): void
  /** Removes the active build. */
  onRemove(): void
}

/** One tab per build; everything below shows the active one. */
export const BuildTabs = ({ builds, active, onSelect, onAdd, onDuplicate, onRemove }: BuildTabsProps) => {
  const t = useTranslations('Calculator')
  const full = builds.length >= LIMITS.builds
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <TabBar
        fit
        label={t('builds.title')}
        idPrefix="calc-build"
        tabs={builds.map((b, i) => ({ id: String(i), label: buildLabel(b, i, t('builds.untitled', { n: i + 1 })) }))}
        active={String(active)}
        onSelect={(id) => onSelect(Number(id))}
        className="md:min-w-0 md:w-auto md:flex-1"
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" aria-disabled={full || undefined} title={full ? t('builds.full') : undefined} onClick={() => !full && onAdd()} className={TOUCH}>
          {t('builds.add')}
        </Button>
        <Button variant="secondary" size="sm" aria-disabled={full || undefined} title={full ? t('builds.full') : undefined} onClick={() => !full && onDuplicate()} className={TOUCH}>
          {t('builds.duplicate')}
        </Button>
        {builds.length > 1 ? (
          <Button variant="ghost" size="sm" onClick={onRemove} className={TOUCH}>
            {t('builds.remove')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
