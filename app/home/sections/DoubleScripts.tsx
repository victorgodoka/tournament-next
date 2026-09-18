import DoubleScriptDisplay from "@omega/double-script-display";
import { HOME_DOUBLE_SCRIPT_DISPLAY } from "@utils/const";
import { Band, BAND_PAD, BandLead, BandTitle, Kicker } from "./band";

/** 03: header block, then each worked example runs edge to edge. */
export const DoubleScripts = () => (
  <Band id="rulings" flush>
    <div className={`${BAND_PAD} md:pb-14`}>
      <Kicker num="03" tone="cyan">Yugioh TCG OCG rulings</Kicker>
      <BandTitle className="max-w-250">The same card, scripted twice: one split for rulings, one for eras</BandTitle>
      <BandLead className="max-w-195">
        Omega runs the official Fluorohydride core, ocgcore, with corrections to damage calculation and to TCG rulings. It&apos;s the first automatic simulator that scripts a card separately whenever its wording, ruling, or era diverges: TCG versus OCG, and current text versus pre-errata text. Pick a format and you get that format&apos;s card, resolved by a script instead of a server&apos;s interpretation.
      </BandLead>
    </div>
    <ul>
      {HOME_DOUBLE_SCRIPT_DISPLAY.map((script) => <DoubleScriptDisplay key={script.id} {...script} />)}
    </ul>
  </Band>
)
