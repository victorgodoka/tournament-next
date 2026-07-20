import { API_ENDPOINTS } from "@const";
import ButtonComponent from "../button/button.component";
import IconComponent from "../icon/icon.component";
import { downloadYDK, importOmega } from "./deck-export.api";
import './deck-export.styles.css';
import { ConvertedDeck } from "@app/decks/decks.types";

const DeckExportComponent = (deck: ConvertedDeck & { name?: string }) => {
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
        <ButtonComponent className="deck-export__copy" variant="secondary" icon="mdi:content-copy" iconPosition="start" onClick={() => navigator.clipboard.writeText(deck.code)}>
          Copy
        </ButtonComponent>
      </div>
    </div>

    <div className="deck-export__tiles">
      <ButtonComponent fullWidth icon="mdi:download" variant="tile" onClick={() => downloadYDK(deck)}>
        <div className="deck-export__download-text">
          <strong>Download YDK</strong>
          <small>For YGO Omega</small>
        </div>
      </ButtonComponent>
      <ButtonComponent fullWidth icon="mdi:upload" variant="tile" onClick={() => importOmega(deck.code)}>
        <div className="deck-export__download-text">
          <strong>Import to Omega</strong>
          <small>Direct Import</small>
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