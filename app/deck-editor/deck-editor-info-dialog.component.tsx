'use client'

import { useEffect, useRef } from 'react'
import IconComponent from '@components/icon/icon.component'
import { FAQ } from './deck-editor.const'

interface DeckEditorInfoDialogProps {
  open: boolean
  onClose: () => void
}

const DeckEditorInfoDialog = ({ open, onClose }: DeckEditorInfoDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="import-dialog import-dialog--info"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className="import-dialog__inner">
        <header className="import-dialog__head">
          <h2>About the deck builder</h2>
          <button type="button" className="import-dialog__close" onClick={onClose} aria-label="Close">
            <IconComponent icon="mdi:close" width={20} height={20} />
          </button>
        </header>

        <p className="deck-editor-page__lead">
          Build, edit, and test Yu-Gi-Oh! decks online — search the full card database, drag cards into
          your Main, Extra, and Side Decks, and stay legal with live TCG, OCG, and Genesys banlist checks.
        </p>

        <p className="import-dialog__hint">
          Whether you are a casual player brewing a fun combo or a competitor tuning a tournament list, the
          YGO Omega deck maker gives you a fast, modern workspace. Filter the entire card pool by type,
          attribute, level, ATK, DEF, Pendulum scale, archetype, and more, then right-click or drag any
          card straight into your deck. The builder tracks Forbidden, Limited, and Semi-Limited cards for
          your chosen format so your list is always ready for play.
        </p>

        <h2>Frequently asked questions</h2>
        <dl className="deck-editor-page__faq">
          {FAQ.map((item) => (
            <div key={item.question} className="deck-editor-page__faq-item">
              <dt>{item.question}</dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  )
}

export default DeckEditorInfoDialog
