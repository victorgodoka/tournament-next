import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import { formatNumber } from "@omega/profile/labels";
import { RailHead } from "@ui/rail-head";
import { relative, type CommunityDeck } from "@utils/welcome";
import { ArrowLink, GHOST_TAG, RailFooter } from "./rails";

const BADGE: Record<CommunityDeck['accent'], string> = {
  gold: 'bg-gold text-gold-on',
  cyan: 'bg-cyan text-cyan-on',
  indigo: 'bg-indigo text-indigo-on',
}

type DeckCommunityProps = {
  decks: CommunityDeck[]
  publicDecks: number
  now: number
}

/** DeckTile: duotone art header with a badge and a metric, a body, and a gold footer link. */
export const DeckCommunity = ({ decks, publicDecks, now }: DeckCommunityProps) => (
  <section id="decks">
    <RailHead num="03" label="Deck community" stamp={`${formatNumber(publicDecks)} public decks`} />

    <div className="grid grid-cols-1 gap-px border-b border-line bg-line xl:grid-cols-3">
      {decks.map((deck) => (
        <article key={deck.id} className="flex min-w-0 flex-col bg-surface-000">
          <CardArt
            art={deck.art}
            alt=""
            sizes="(min-width: 1280px) 33vw, 100vw"
            className="h-45 border-b border-line"
            imageClassName="object-[center_28%] duotone"
          >
            <div aria-hidden className="absolute inset-0 bg-linear-to-b from-veil-top to-veil-base" />
            <span className={twMerge("absolute top-0 left-0 px-3 py-1.75 signal-chip tracking-[.18em]", BADGE[deck.accent])}>
              {deck.badge}
            </span>
            <span className="absolute right-0 bottom-0 bg-surface-000 px-3 py-2 font-mono text-[11px] font-bold tracking-[.06em] text-ink">
              {deck.metric}
            </span>
          </CardArt>

          <div className="flex flex-1 flex-col px-7 py-6">
            <h3 className="text-ink display-4">{deck.name}</h3>
            <p className="mt-2 font-mono text-[11px] tracking-[.06em] text-ink-muted">
              by {deck.author}, updated {relative(deck.updatedAt, now)}
            </p>
            <p className="mt-3.5 text-[15px] leading-normal text-ink-dim">{deck.note}</p>
            <ul className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              {deck.tags.map((tag) => (
                <li key={tag} className={GHOST_TAG}>{tag}</li>
              ))}
            </ul>
          </div>

          <Link
            href="/deck-editor"
            className="flex items-center justify-between gap-3 border-t border-line px-7 py-3.5 text-gold signal-nav hover:bg-gold hover:text-gold-on"
          >
            <span>Open deck</span>
            <span aria-hidden className="text-[13px]">→</span>
          </Link>
        </article>
      ))}
    </div>

    <RailFooter className="border-t-0 border-b border-b-line-strong">
      <ArrowLink href="/deck-editor" muted>Open deck builder</ArrowLink>
      <ArrowLink href="/deck-editor">Browse deck community</ArrowLink>
    </RailFooter>
  </section>
)
