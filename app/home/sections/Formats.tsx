import Link from "next/link";
import { FaqCard } from "@omega/faq-card";
import { DOWNLOAD_URL, FORMATS_SUPPORTED } from "@utils/const";
import { Band, BandLead, BandTitle, Kicker } from "./band";

/** 04: header with a trailing link, then one row per format. The last row is the highlighted one. */
export const Formats = () => (
  <Band id="formats" raised>
    <div className="flex flex-wrap items-end justify-between gap-7">
      <div className="max-w-200">
        <Kicker num="04">Yugioh all cards free</Kicker>
        <BandTitle>Every format, and every banlist the game has ever had</BandTitle>
        <BandLead>Switch era between duels. Nothing to buy, nothing to unlock, no second client to install.</BandLead>
      </div>
      <Link href={DOWNLOAD_URL} className="font-display text-xl tracking-[.05em] text-gold uppercase hover:text-cyan">Download free →</Link>
    </div>
    <ol className="mt-13 border-t border-line">
      {FORMATS_SUPPORTED.map(({ title, text }, i) => (
        <FaqCard
          key={title}
          index={i + 1}
          title={title}
          text={text}
          className="border-t-0 border-b px-1 py-5 lg:grid-cols-[56px_minmax(0,220px)_minmax(0,1fr)] lg:gap-6 last:bg-ground-gold"
          numClassName={i === FORMATS_SUPPORTED.length - 1 ? "text-gold" : "text-ink-muted"}
          titleClassName="display-5"
        />
      ))}
    </ol>
  </Band>
)
