'use client'

import { useEffect, useRef, useState } from 'react'
import ButtonComponent from '@components/button/button.component'
import IconComponent from '@components/icon/icon.component'

interface DeckImportDialogProps {
  open: boolean
  loading: boolean
  error: string | null
  onClose: () => void
  onImport: (value: string) => void
}

const DeckImportDialog = ({ open, loading, error, onClose, onImport }: DeckImportDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="import-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className="import-dialog__inner">
        <header className="import-dialog__head">
          <h2>Import deck</h2>
          <button type="button" className="import-dialog__close" onClick={onClose} aria-label="Close">
            <IconComponent icon="mdi:close" width={20} height={20} />
          </button>
        </header>
        <p className="import-dialog__hint">Paste a YDKE URL (<code>ydke://…</code>) to load it into the editor.</p>
        <textarea
          className="import-dialog__input"
          rows={3}
          placeholder="ydke://..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="import-dialog__error" role="alert">
            <IconComponent icon="mdi:alert-circle-outline" width={16} height={16} />
            {error}
          </p>
        )}
        <div className="import-dialog__actions">
          <ButtonComponent variant="ghost" onClick={onClose}>Cancel</ButtonComponent>
          <ButtonComponent
            variant="primary"
            icon="mdi:import"
            loading={loading}
            disabled={!value.trim()}
            onClick={() => onImport(value.trim())}
          >
            Import
          </ButtonComponent>
        </div>
      </div>
    </dialog>
  )
}

export default DeckImportDialog
