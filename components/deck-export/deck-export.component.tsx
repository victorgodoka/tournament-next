import { API_ENDPOINTS } from "@const";
import ButtonComponent from "../button/button.component";
import { downloadYDK, importOmega } from "./deck-export.api";

const DeckExportComponent = (code: string) => {
  return <div className="deck-export">
    <h2 className="deck-export__title">Deck Export</h2>
    <div className="deck-export__group">
      <div className="deck-export__clipboard">
        <label htmlFor="deck-export__code" className="deck-export__label">Deck Code</label>
        <input
          id="deck-export__code"
          value={code}
          readOnly
        />
      </div>
      <ButtonComponent icon="mdi:content-copy" iconPosition="start" onClick={() => navigator.clipboard.writeText(code)}>
        Copy
      </ButtonComponent>
    </div>
    <div className="deck-export__group">
      <ButtonComponent icon="mdi:download" variant="secondary" onClick={() => downloadYDK(code)}>
        <p>Download YDK</p>
        <p>For YGO Omega</p>
      </ButtonComponent>
      <ButtonComponent icon="mdi:upload" variant="primary" onClick={() => importOmega(code)}>
        <p>Import to Omega</p>
        <p>Direct Import</p>
      </ButtonComponent>
      <ButtonComponent icon="mdi:image" variant="ghost" target="_blank" to={`${API_ENDPOINTS.MAIN}/deck-image/${encodeURIComponent(code)}`}>
        <p>Get Image</p>
        <p>Visual Decklist</p>
      </ButtonComponent>
      <ButtonComponent icon="mdi:file-pdf" variant="danger" target="_blank" to={`/pdf-decklist/${encodeURIComponent(code)}`}>
        <p>Export to PDF</p>
        <p>Printable format</p>
      </ButtonComponent>
    </div>
  </div>
}

export default DeckExportComponent;