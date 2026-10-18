'use client'

import { useFormatter, useNow, useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import type { SavedDeck } from '@utils/decks'

/**
 * The deck changed elsewhere since it was loaded (`409`). Stays mounted, so closing the native dialog
 * hands focus back to the Save button. Closing without a choice keeps the local edits unsaved.
 */
export const ConflictDialog = ({ latest, onResolve }: { latest: SavedDeck | null; onResolve(choice: 'load' | 'overwrite' | 'cancel'): void }) => {
  const t = useTranslations('DeckEditor')
  const format = useFormatter()
  // Mounted for the editor's whole life: keep "n minutes ago" current.
  const now = useNow({ updateInterval: 30_000 })

  return (
    <Dialog
      size="sm"
      open={latest !== null}
      onClose={() => onResolve('cancel')}
      title={t('conflict.title')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onResolve('load')} className="max-lg:min-h-11">
            {t('conflict.load')}
          </Button>
          <Button onClick={() => onResolve('overwrite')} className="max-lg:min-h-11">
            {t('conflict.overwrite')}
          </Button>
        </>
      }
    >
      {latest ? (
        <p className="text-ink body">
          {t('conflict.body', { name: latest.name, revision: latest.revision, when: format.relativeTime(new Date(latest.updatedAt), now) })}
        </p>
      ) : null}
    </Dialog>
  )
}
