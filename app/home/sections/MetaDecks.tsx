import Link from "next/link";
import { CardArt } from "@omega/card-art";
import { DOWNLOAD_URL, HOME_META_DECKS } from "@utils/const";
import { Band, BandLead, BandTitle, Kicker } from "./band";

/** 05: the ranked meta as a hairline grid of deck tiles. Tiles fill gold on hover. */
export const MetaDecks = () => (
  <Band id="meta">
    <div className="max-w-210">
      <Kicker num="05" tone="cyan">Free yugioh ranked online</Kicker>
      <BandTitle>Play the current meta the week it shifts</BandTitle>
      <BandLead>These decks are in the ranked queue now. Build any of them, in full, for nothing.</BandLead>
    </div>
    <ul className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px border border-line bg-line sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] lg:grid-cols-4">
      {HOME_META_DECKS.map((deck) => (
        <li key={deck.id}>
          <Link href={DOWNLOAD_URL} className="group block h-full bg-surface-000 hover:bg-gold">
            <CardArt art={{ id: deck.id, name: deck.name }} alt={`${deck.name} deck card artwork`} sizes="(min-width: 1024px) 25vw, 50vw" className="aspect-4/3" />
            <div className="flex items-baseline justify-between gap-3 px-5 pt-4.5 pb-5">
              <h3 className="text-ink display-5 leading-[1.04] group-hover:text-gold-on sm:min-h-19.5">{deck.name}</h3>
              <span className="text-right text-ink-muted signal tracking-[.14em] group-hover:text-gold-on">{deck.style}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  </Band>
)
