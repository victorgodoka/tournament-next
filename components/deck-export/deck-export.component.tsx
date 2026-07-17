import { API_ENDPOINTS } from "@const";
import ButtonComponent from "../button/button.component";
import { downloadYDK, importOmega } from "./deck-export.api";
import './deck-export.styles.css';

const DeckExportComponent = ({ code }: { code: string }) => {
  return <div className="deck-export">
    <h2 className="deck-export__title">Deck Export</h2>
    <label htmlFor="deck-export__code" className="deck-export__label">Deck Code</label>
    <div className="deck-export__group">
      <div className="deck-export__clipboard">
        <input
          id="deck-export__code"
          className="deck-export__code"
          value={code}
          readOnly
        />
      <ButtonComponent fullWidth icon="mdi:content-copy" iconPosition="start" onClick={() => navigator.clipboard.writeText(code)}>
        Copy
      </ButtonComponent>
      </div>
    </div>
    <div className="deck-export__group">
      <ButtonComponent fullWidth icon="mdi:download" variant="tile" onClick={() => downloadYDK(code)}>
        <div className="deck-export__download-text">
          <strong>Download YDK</strong>
          <small>For YGO Omega</small>
        </div>
      </ButtonComponent>
      <ButtonComponent fullWidth icon="mdi:upload" variant="tile" onClick={() => importOmega(code)}>
        <div className="deck-export__download-text">
          <strong>Import to Omega</strong>
          <small>Direct Import</small>
        </div>
      </ButtonComponent>
      <ButtonComponent fullWidth icon="mdi:image" variant="tile" target="_blank" to={`${API_ENDPOINTS.MAIN}/deck-image/${encodeURIComponent(code)}`}>
        <div className="deck-export__download-text">
          <strong>Get Image</strong>
          <small>Visual Decklist</small>
        </div>
      </ButtonComponent>
      <ButtonComponent fullWidth icon="mdi:file-pdf" variant="tile" target="_blank" to={`/pdf-decklist/${encodeURIComponent(code)}`}>
        <div className="deck-export__download-text">
          <strong>Export to PDF</strong>
          <small>Printable format</small>
        </div>
      </ButtonComponent>
    </div>
  </div>
}

export default DeckExportComponent;