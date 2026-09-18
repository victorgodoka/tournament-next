import { FaqCard } from "@omega/faq-card";
import { Button } from "@ui/index";
import { DOWNLOAD_URL, HOME_FAQ_ALTERNATIVE } from "@utils/const";
import { Band, BandLead, BandTitle, Kicker, NOTE, Rail } from "./band";

/** 01: the three reasons players leave the official clients. */
export const FaqReasons = () => (
  <Band id="alternative" className="md:pb-0">
    <Rail
      side={
        <>
          <Kicker num="01" tone="cyan">A free Master Duel alternative</Kicker>
          <p aria-hidden className="mt-4.5 font-display text-8xl leading-[.8] text-surface-400">03</p>
          <p className={`mt-3.5 ${NOTE}`}>Reasons players leave the official clients</p>
        </>
      }
    >
      <BandTitle className="mt-0">Ranked Yu-Gi-Oh! online, free, with the tournament format intact</BandTitle>
      <BandLead className="max-w-160">Three things push competitive players off the official clients. Omega removes all three.</BandLead>
      <ol className="mt-12 border-b border-line">
        {HOME_FAQ_ALTERNATIVE.map((faq, i) => (
          <FaqCard key={faq.title} index={i + 1} {...faq} className="lg:grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)]" />
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-5 pt-8 pb-14">
        <Button variant="secondary" href={DOWNLOAD_URL}>Download free</Button>
        <span className="font-mono text-[11px] tracking-[.06em] text-ink-muted">No credit card. Install takes under 2 minutes.</span>
      </div>
    </Rail>
  </Band>
)
