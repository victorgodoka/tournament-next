import { Button } from "@ui/index";
import { DECK_BUILDER_URL, HOME_TOOLS } from "@utils/const";
import { Band, BandLead, BandTitle, Kicker } from "./band";

/** 06: pitch on the left, one linked row per tool on the right. */
export const Tools = () => (
  <Band id="tools" raised>
    <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <Kicker num="06">Yugioh deck builder online</Kicker>
        <BandTitle>Build the deck in the browser, then duel it in the client</BandTitle>
        <BandLead>Filter the full card pool by attribute, level, type, archetype and banlist status. Save the list, share the link, load it into Omega.</BandLead>
        <Button variant="secondary" href={DECK_BUILDER_URL} className="mt-8">Build my deck</Button>
      </div>
      <ul className="border-t border-line">
        {HOME_TOOLS.map(({ title, text }) => (
          <li key={title}>
            <a
              href={DECK_BUILDER_URL}
              className="grid grid-cols-1 items-baseline gap-2.5 border-b border-line px-1 py-6.5 hover:bg-surface-300 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:gap-6"
            >
              <h3 className="text-ink display-5">{title}</h3>
              <p className="text-ink-dim body">{text}</p>
              <span aria-hidden className="font-mono text-sm text-gold max-lg:hidden">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  </Band>
)
