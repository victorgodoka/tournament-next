'use client'

import { useEffect, useRef, useState } from "react";
import { API_ENDPOINTS } from "@const";
import ButtonComponent from "../button/button.component";
import IconComponent from "../icon/icon.component";
import { downloadYDK, importOmega } from "./deck-export.api";
import './deck-export.styles.css';
import { ConvertedDeck } from "@app/decks/decks.types";

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_RESET_MS = 2000

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied!',
  failed: 'Copy failed',
}

const COPY_ICON: Record<CopyState, string> = {
  idle: 'mdi:content-copy',
  copied: 'mdi:check',
  failed: 'mdi:alert-circle-outline',
}

const DeckExportComponent = (deck: ConvertedDeck & { name?: string }) => {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [importError, setImportError] = useState(false)
  const copyResetRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
  }, [])

  const flashCopyState = (state: CopyState) => {
    setCopyState(state)
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
    copyResetRef.current = window.setTimeout(() => setCopyState('idle'), COPY_RESET_MS)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deck.code)
      flashCopyState('copied')
    } catch {
      // Clipboard access can be denied (permissions, insecure context).
      flashCopyState('failed')
    }
  }

  const handleImport = async () => {
    setImportError(false)
    try {
      await importOmega(deck.code)
    } catch {
      // The local Omega client isn't running or refused the deck.
      setImportError(true)
    }
  }

  return <div className="deck-export">
    <h2 className="deck-export__title">
      <IconComponent className="deck-export__title-icon" icon="mdi:tray-arrow-down" width={16} height={16} />
      Deck Export
    </h2>

    <div className="deck-export__field">
      <label htmlFor="deck-export__code" className="deck-export__label">Deck Code</label>
      <div className="deck-export__clipboard">
        <input
          id="deck-export__code"
          className="deck-export__code"
          value={deck.code}
          readOnly
        />
        <ButtonComponent
          className="deck-export__copy"
          variant="secondary"
          icon={COPY_ICON[copyState]}
          iconPosition="start"
          onClick={handleCopy}
        >
          {COPY_LABEL[copyState]}
        </ButtonComponent>
        <span className="visually-hidden" role="status">
          {copyState === 'copied' ? 'Deck code copied to clipboard' : ''}
          {copyState === 'failed' ? 'Copying failed' : ''}
        </span>
      </div>
    </div>

    <div className="deck-export__tiles">
      <ButtonComponent fullWidth icon="mdi:download" variant="tile" onClick={() => downloadYDK(deck)}>
        <div className="deck-export__download-text">
          <strong>Download YDK</strong>
          <small>For YGO Omega</small>
        </div>
      </ButtonComponent>
      <ButtonComponent fullWidth icon="mdi:upload" variant="tile" onClick={handleImport}>
        <div className="deck-export__download-text">
          <strong>Import to Omega</strong>
          <small>{importError ? 'Is YGO Omega running?' : 'Direct Import'}</small>
        </div>
      </ButtonComponent>
      <ButtonComponent fullWidth icon="mdi:image" variant="tile" target="_blank" to={`${API_ENDPOINTS.MAIN}/deck-image/${encodeURIComponent(deck.code)}`}>
        <div className="deck-export__download-text">
          <strong>Get Image</strong>
          <small>Visual Decklist</small>
        </div>
      </ButtonComponent>
      <ButtonComponent fullWidth icon="mdi:file-pdf" variant="tile" target="_blank" to={`/pdf-decklist/${encodeURIComponent(deck.code)}`}>
        <div className="deck-export__download-text">
          <strong>Export to PDF</strong>
          <small>Printable format</small>
        </div>
      </ButtonComponent>
    </div>
  </div>
}

export default DeckExportComponent;
