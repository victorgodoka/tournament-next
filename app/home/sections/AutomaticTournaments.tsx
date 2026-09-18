import { FaqCard } from "@omega/faq-card";
import { Button } from "@ui/index";
import { DOWNLOAD_URL, HOME_AUTO_TOURNAMENT_FAQ } from "@utils/const";
import { Band, BandLead, BandTitle, Kicker, NOTE, Rail } from "./band";

const TABLE_ROW = "lg:grid-cols-[80px_minmax(0,300px)_minmax(0,1fr)] lg:gap-6 px-5.5"

/** 02: what the engine handles, as a three-column table. */
export const AutomaticTournaments = () => (
  <Band id="tournaments" raised>
    <Rail
      side={
        <>
          <Kicker num="02">Yugioh automatic tournament</Kicker>
          <p className={`mt-4.5 ${NOTE}`}>Decks lock at round one. The rule holds without anyone policing it.</p>
          <Button href={DOWNLOAD_URL} className="mt-6.5">Start dueling</Button>
          <p className="mt-3 font-mono text-[11px] tracking-[.06em] text-ink-muted">Free entry. Elo counted.</p>
        </>
      }
    >
      <BandTitle className="mt-0">
        Automatic Swiss tournaments. No judge, no honor system, no <span className="text-cyan">spreadsheet</span>.
      </BandTitle>
      <BandLead>
        Sign up, submit a deck, and duel. Omega checks the list against the format&apos;s banlist, pairs the round, records the result and updates the standings. Decks lock the moment the tournament starts, so the rule holds without anyone policing it.
      </BandLead>
      <ol className="mt-12 border border-line bg-surface-000">
        <li aria-hidden className={`hidden bg-ground-soft py-3.5 text-ink-muted signal tracking-[.18em] lg:grid ${TABLE_ROW}`}>
          <span>Step</span>
          <span>Handled by the engine</span>
          <span>What that means for you</span>
        </li>
        {HOME_AUTO_TOURNAMENT_FAQ.map((faq, i) => (
          <FaqCard key={faq.title} index={i + 1} {...faq} className={`py-6 max-lg:first:border-t-0 ${TABLE_ROW}`} titleClassName="display-6" />
        ))}
      </ol>
    </Rail>
  </Band>
)
