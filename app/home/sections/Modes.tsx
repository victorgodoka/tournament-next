import { twMerge } from "tailwind-merge";
import { HOME_MODES } from "@utils/const";
import { Band, BAND_PAD, BandLead, BandTitle, Kicker } from "./band";

const MODE_SKIN = ["bg-ground-gold text-gold md:border-r md:border-line", "bg-ground-cyan text-cyan"]

/** 07: header, then the two modes as tinted halves. */
export const Modes = () => (
  <Band id="modes" flush>
    <div className={`max-w-225 ${BAND_PAD} md:pb-13`}>
      <Kicker num="07" tone="cyan">Yugioh simulator manual and automatic</Kicker>
      <BandTitle>Automatic and manual, in the same client</BandTitle>
      <BandLead>Nobody has to pick a platform. Practice a physical tournament by hand on Monday, grind Elo on the engine on Tuesday, keep one install.</BandLead>
    </div>
    <div className="grid grid-cols-1 border-t border-line md:grid-cols-2">
      {HOME_MODES.map(({ title, text }, i) => (
        <div key={title} className={twMerge("px-5.5 py-11 md:px-11", MODE_SKIN[i])}>
          <h3 className="display-1 leading-[.9]">{title}</h3>
          <p className="mt-5 max-w-115 text-ink-dim text-[17px] leading-[1.6]">{text}</p>
        </div>
      ))}
    </div>
  </Band>
)
