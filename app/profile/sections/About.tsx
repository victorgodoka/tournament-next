import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import { SOCIAL } from "@omega/profile/labels";
import { Panel } from "@ui/panel";
import type { CardArt as CardArtType, ProfileSocial, SocialNetwork } from "@utils/types";
import { CAPTION } from "./Ladders";
import { Rail } from "./rail";

/** Network glyphs, 24px box, filled with currentColor. */
const GLYPH: Record<SocialNetwork, React.ReactNode> = {
  x: <path d="M4 4h3.6l12.4 16h-3.6zM16.6 4h2.6l-5.7 7.3-1.3-1.7zM4.6 20l5.8-7.4 1.3 1.7L7.2 20z" />,
  youtube: <path fillRule="evenodd" d="M2 5h20v14H2zm8 3.5v7l6-3.5z" />,
  twitch: <path d="M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7.1 7.1l1.4 1.4a5 5 0 0 0 0 7l-1.4 1.4a7 7 0 0 1 0-9.8zm9.8 0a7 7 0 0 1 0 9.8l-1.4-1.4a5 5 0 0 0 0-7zM4.2 4.2l1.4 1.4a9 9 0 0 0 0 12.8l-1.4 1.4a11 11 0 0 1 0-15.6zm15.6 0a11 11 0 0 1 0 15.6l-1.4-1.4a9 9 0 0 0 0-12.8z" />,
  instagram: <path fillRule="evenodd" d="M3 3h18v18H3zm2 2v14h14V5zm7 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm5-4h2v2h-2z" />,
  website: <path fillRule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.9 2.2A8 8 0 0 0 4.1 11h3.9c.1-2.5.8-4.9 2.1-6.8zm3.8 0c1.3 1.9 2 4.3 2.1 6.8h3.9a8 8 0 0 0-6-6.8zM10 11h4c-.1-2.4-.8-4.6-2-6.3-1.2 1.7-1.9 3.9-2 6.3zm-5.9 2a8 8 0 0 0 6 6.8c-1.3-1.9-2-4.3-2.1-6.8zm5.9 0c.1 2.4.8 4.6 2 6.3 1.2-1.7 1.9-3.9 2-6.3zm6 0c-.1 2.5-.8 4.9-2.1 6.8a8 8 0 0 0 6-6.8z" />,
}

/** The API sends no label for a bare website, so fall back to the URL host (PROFILE_API.md §4.6). */
const hostOf = (href: string) => {
  try {
    return new URL(href).host.replace(/^www\./, '')
  } catch {
    return href
  }
}

const socialText = ({ network, handle, href }: ProfileSocial) => `${SOCIAL[network].label} · ${handle ?? hostOf(href)}`

const Socials = ({ socials }: { socials: ProfileSocial[] }) => (
  <nav aria-label="Socials" className="flex gap-2">
    {socials.map((social) => (
      <a
        key={social.network}
        href={social.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={socialText(social)}
        title={socialText(social)}
        className="cut grid size-10 place-items-center text-ink [--cut:var(--cut-xs)] [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)] hover:text-cyan hover:[--fill:var(--color-surface-300)] max-md:size-11"
      >
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden className="fill-current">{GLYPH[social.network]}</svg>
      </a>
    ))}
  </nav>
)

/** Big art, gold label, Anton name. Links to the card's wiki page. */
const FavoriteCard = ({ card, size }: { card: CardArtType; size: 'lg' | 'md' }) => (
  <Link href={`/wiki/card/${card.id}`} className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 text-ink no-underline">
    <CardArt
      art={card}
      sizes={size === 'lg' ? '140px' : '128px'}
      className={twMerge('border border-line-mid shadow-lift group-hover:border-cyan', size === 'lg' ? 'size-35 max-md:size-28' : 'size-32 max-md:size-26')}
    />
    <span className="flex min-w-0 flex-col gap-2">
      <span className={twMerge(CAPTION, 'text-gold')}>Favorite card</span>
      <span className={twMerge('font-display leading-[1.02] uppercase group-hover:text-cyan', size === 'lg' ? 'text-[30px] max-md:text-[26px]' : 'text-2xl max-md:text-[22px]')}>
        {card.name ?? `Card ${card.id}`}
      </span>
    </span>
  </Link>
)

const FavoriteDeck = ({ deck }: { deck: string }) => (
  <p className="text-[15px] leading-6 text-ink-dim">Favorite deck: <strong className="font-bold text-ink">{deck}</strong></p>
)

type AboutProps = {
  num: string
  vip: boolean
  /** Rendered markdown (VIP). */
  bio?: string
  socials?: ProfileSocial[]
  favoriteCard: CardArtType | null
  favoriteDeck: string | null
}

/** Bio and socials are VIP; the favorites are everyone's. Nothing to say, no section. */
export const About = ({ num, vip, bio, socials = [], favoriteCard, favoriteDeck }: AboutProps) => {
  if (!bio && !socials.length && !favoriteCard && !favoriteDeck) return null

  const bioBlock = bio ? (
    <div
      className="flex flex-col gap-2.5 text-[15px] leading-6 text-ink-dim [&_*]:m-0 [&_a]:text-cyan [&_a]:underline [&_a]:underline-offset-3 [&_strong]:text-ink"
      dangerouslySetInnerHTML={{ __html: bio }}
    />
  ) : null

  return (
    <>
      <Rail num={num} label="About" />
      {vip ? (
        <>
          <Panel label="About" className="flex flex-col gap-5 max-md:hidden">
            {bioBlock}
            {socials.length ? <Socials socials={socials} /> : null}
            {favoriteCard ? <FavoriteCard card={favoriteCard} size="lg" /> : null}
            {favoriteDeck ? <FavoriteDeck deck={favoriteDeck} /> : null}
          </Panel>
          <div className="flex flex-col gap-4 md:hidden">
            {bioBlock}
            {socials.length ? <Socials socials={socials} /> : null}
            {favoriteCard ? <div className="border border-line bg-surface-100 p-4"><FavoriteCard card={favoriteCard} size="lg" /></div> : null}
            {favoriteDeck ? <FavoriteDeck deck={favoriteDeck} /> : null}
          </div>
        </>
      ) : (
        <>
          {favoriteCard ? (
            <>
              <Panel label="Favorite card" className="max-md:hidden"><FavoriteCard card={favoriteCard} size="md" /></Panel>
              <div className="border border-line bg-surface-100 p-4 md:hidden"><FavoriteCard card={favoriteCard} size="md" /></div>
            </>
          ) : null}
          {favoriteDeck ? <FavoriteDeck deck={favoriteDeck} /> : null}
        </>
      )}
    </>
  )
}
