import { Suspense } from "react";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import {
  ArtCard,
  ArtCardGrid,
  Avatar,
  Button,
  CharacterLine,
  Chip,
  Eyebrow,
  Icon,
  MediaCard,
  RailHead,
  Sticker,
  type IconName,
} from "@omega-hub/ds";
import { CardArt } from "@omega/card-art";
import { LocalDay } from "@omega/wiki/local-day";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { NonVipOnly } from "@omega/ads/non-vip-only";
import { CARD_ART_URL, DOWNLOAD_BUILDS, DOWNLOAD_URL, HOME_META_DECKS, HOME_NAVBAR_ITEMS, RELEASES_URL } from "@utils/const";
import { getLatestArticles } from "@utils/articles";
import { getTopDecks } from "@utils/statistics";
import type { ArticleSummary } from "@utils/types";
import { MetaCarousel, type MetaDeck } from "./meta-carousel";
import "./home.css";

const PLATFORMS = "Windows · macOS · Linux · Android · iOS"
const PAYPAL_URL = "https://paypal.me/DUnite"
const ART = "/home-art.webp"

const ic = (name: IconName) => <Icon name={name} size={24} />

const Lead = ({ title, text, className }: { title: React.ReactNode; text?: React.ReactNode; className?: string }) => (
  <div className={className ?? "flex max-w-170 flex-col gap-3"}>
    <h2 className="m-0 title display-2 text-ink">{title}</h2>
    {text ? <p className="m-0 body">{text}</p> : null}
  </div>
)

/** ShirAi's name plate: a violet diamond and her name. */
const ShirAi = ({ size = 14 }: { size?: number }) => (
  <span className="flex items-center gap-2">
    <span aria-hidden className="size-2 rotate-45 bg-shirai" />
    <span className="font-sans leading-5 font-extrabold text-shirai-lift" style={{ fontSize: size }}>ShirAi</span>
  </span>
)

type Ranked = Promise<Awaited<ReturnType<typeof getTopDecks>>>

/* ------------------------------------------------------------------ hero */

type FanCard = { id: number; name: string }

/** Shown when the API has no ranked season to read. */
const HERO_FALLBACK: FanCard[] = HOME_META_DECKS.slice(0, 3)

/** #2 left, #3 right, #1 in front. */
const FAN_SLOTS: { acc: string; r: string; style: React.CSSProperties; delay: number }[] = [
  { acc: "var(--color-gold)", r: "0deg", style: { left: 135, top: 0, width: 200, height: 288 }, delay: 360 },
  { acc: "var(--color-violet)", r: "-10deg", style: { left: 0, top: 40, width: 190, height: 272 }, delay: 120 },
  { acc: "var(--color-azure-lift)", r: "10deg", style: { right: 0, top: 40, width: 190, height: 272 }, delay: 240 },
]

/**
 * Without cards the empty frames hold the space (the Suspense fallback), so no art is preloaded only to be swapped.
 * `ranked` false is the static list: no rank badges and no ranking claim in the labels or the caption.
 */
const CardFan = ({ cards = [], ranked = false }: { cards?: FanCard[]; ranked?: boolean }) => (
  <>
    <div className="ol-fan absolute top-6 left-1/2 -ml-58.75 h-90 w-117.5">
      {[1, 2, 0].map((i) => {
        const card = cards[i]
        const slot = FAN_SLOTS[i]
        if (!slot) return null
        const style = { "--ol-acc": slot.acc, "--r": slot.r, animationDelay: `${slot.delay}ms`, ...slot.style } as React.CSSProperties
        // Index keys: two ranked decks can share a face card.
        if (!card) return <span key={i} aria-hidden className="ol-hcard cut notch" style={style} />
        return (
          <Link key={i} href={`/wiki/card/${card.id}`} aria-label={ranked ? `${card.name}, number ${i + 1} in TCG ranked` : card.name} className="ol-hcard cut notch" style={style}>
            {ranked ? <span className={i === 0 ? "ol-hrank ol-hrank--1" : "ol-hrank"}>#{i + 1}</span> : null}
            <CardArt art={{ id: card.id, name: card.name }} sizes="200px" priority className="ol-art" />
          </Link>
        )
      })}
    </div>
    {cards.length ? <span className="ol-fan-cap signal-sm">{ranked ? "Top 3 decks in TCG ranked" : "Popular decks"}</span> : null}
  </>
)

const LiveCardFan = async ({ ranked }: { ranked: Ranked }) => {
  const cards = ((await ranked) ?? []).flatMap(({ topCards: [card], name }) => (card && name ? [{ id: card.id, name }] : [])).slice(0, 3)
  return cards.length === 3 ? <CardFan cards={cards} ranked /> : <CardFan cards={HERO_FALLBACK} />
}

const Hero = ({ ranked }: { ranked: Ranked }) => (
  <section id="top" aria-label="YGO Omega" className="relative overflow-hidden border-b border-line">
    <div aria-hidden className="dots absolute inset-0 mask-[linear-gradient(90deg,transparent_5%,#000_55%)]" />
    <Image src="/omega-mark.png" alt="" width={780} height={780} sizes="780px" aria-hidden className="ol-mark" />
    <div className="ol-hero-in">
      {/* Text and stage share a row down to the laptop page width (1100px at 1366). */}
      <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
        <Eyebrow tone="cyan" meta={PLATFORMS}>Free Yu-Gi-Oh! simulator</Eyebrow>
        <h1 className="ol-h1 display-hero">The free Yu-Gi-Oh! simulator that runs its own tournaments</h1>
        <p className="m-0 max-w-145 lead">
          Every card is unlocked from your first duel. Play best-of-three ranked to climb your favorite ladder, or enter tournaments in every kind of
          format. The engine checks each play, so you never worry about cheating, a missed ruling or waiting for a judge call.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button size="lg" href={DOWNLOAD_URL}>
            <Icon name="download" />
            Download Free
          </Button>
          <Button size="lg" variant="secondary" href="/tournaments">See Tournaments</Button>
        </div>
      </div>
      <div className="ol-stage">
        <Suspense fallback={<CardFan />}>
          <LiveCardFan ranked={ranked} />
        </Suspense>
        <div className="ol-pop absolute right-0 bottom-0 flex items-end" style={{ animationDelay: "700ms" }}>
          <div className="cut notch -mr-2.5 mb-5.5 max-w-57.5 px-3.5 py-2.5 [--cut:var(--cut-sm)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)]">
            <div className="mb-1"><ShirAi /></div>
            <p className="m-0 body-sm text-ink">Three games, one side deck. The better duelist takes the match.</p>
          </div>
          <Sticker name="shirai-play" size="lg" />
        </div>
      </div>
    </div>
  </section>
)

/* ------------------------------------------------------------------ sections */

const Why = () => (
  <section id="why" className="ol-sec">
    <RailHead num="01" label="Why Omega" stamp="Ranked · tournaments" />
    <div className="ol-body flex flex-col gap-6">
      <div className="ol-why-head">
        <h2 className="m-0 title display-2 text-ink">Why duelists switch to Omega</h2>
        <div className="min-w-0">
          <CharacterLine character="kurai" mood="giggle" compact>
            One bad hand used to cost me the whole match. Now it costs one game, and I still lose the other two.
          </CharacterLine>
        </div>
      </div>
      <ArtCardGrid columns={3}>
        <ArtCard titleAs="h3" accent="ember" icon={ic("sword")} animation="clash" eyebrow="Bo3 ranked" title="Matches go to three games" artPosition="60% 30%" clamp={false}>
          Ranked and tournaments play best-of-three with a side deck, so you get two more games to fix a bad opening hand.
        </ArtCard>
        <ArtCard titleAs="h3" accent="violet" icon={ic("history")} animation="flip" eyebrow="29 banlists" title="Every era on one launcher" artPosition="20% 70%" clamp={false}>
          Play the current TCG list, then switch to GOAT, Edison or Genesys for the next duel.
        </ArtCard>
        <ArtCard titleAs="h3" accent="gold" icon={ic("unlock")} animation="spin" eyebrow="$0" title="Every card unlocked" artPosition="85% 40%" clamp={false}>
          Build any deck at full playset from your first launch. Omega has no packs, crafting or in-game currency.
        </ArtCard>
      </ArtCardGrid>
    </div>
  </section>
)

const TOURNAMENT_STEPS: { icon: IconName; anim: "jump" | "spin" | "bob" | "wobble"; accent: "cyan" | "violet" | "ember" | "azure"; title: string; text: string; pos: string }[] = [
  { icon: "check", anim: "jump", accent: "cyan", title: "Deck check", text: "Omega checks your deck against the event's banlist before round one.", pos: "10% 80%" },
  { icon: "shuffle", anim: "spin", accent: "violet", title: "Pairing", text: "The engine pairs each Swiss round as soon as the last one ends.", pos: "80% 20%" },
  { icon: "trophy", anim: "bob", accent: "ember", title: "Scoring", text: "Results count the moment a match ends, with no report to file.", pos: "40% 60%" },
  { icon: "chart", anim: "wobble", accent: "azure", title: "Meta charts", text: "Final standings feed the charts on Statistics.", pos: "90% 70%" },
]

const Tournaments = () => (
  <section id="tournaments" className="ol-sec">
    <RailHead num="02" label="Automatic tournaments" stamp="Free entry · Elo counted" />
    <div className="ol-body flex flex-wrap items-start gap-x-12 gap-y-8">
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip tone="gold">Swiss</Chip>
          <Chip>TCG · Genesys · Edison</Chip>
        </div>
        <h2 className="m-0 title display-2 text-ink">Decks lock at round one. The engine runs the rest.</h2>
        <p className="m-0 max-w-140 body">
          Register with a legal deck and Omega checks it, pairs every Swiss round, records each result and posts the standings. One tournament runs at a
          time, rotating between TCG, Genesys and Edison.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="secondary" href="/tournaments">
            <Icon name="trophy" />
            See Tournaments
          </Button>
          <Button variant="ghost" href="/calendar">Open the Calendar</Button>
        </div>
      </div>
      <div className="min-w-0 flex-[1_1_520px]">
        <ArtCardGrid columns={2}>
          {TOURNAMENT_STEPS.map((step, i) => (
            <ArtCard key={step.title} size="sm" titleAs="h3" accent={step.accent} icon={ic(step.icon)} animation={step.anim} eyebrow={String(i + 1).padStart(2, "0")} title={step.title} artPosition={step.pos} clamp={false}>
              {step.text}
            </ArtCard>
          ))}
        </ArtCardGrid>
      </div>
    </div>
  </section>
)

/** The TCG ranking's top 10; the static picks when the API is down or has no open season. */
const LiveMeta = async ({ ranked }: { ranked: Ranked }) => {
  const live: MetaDeck[] = ((await ranked) ?? []).flatMap(({ topCards: [card], name, share }) =>
    card && name ? [{ id: card.id, name, note: `${(share * 100).toFixed(1)}% of ranked games` }] : [])
  return live.length
    ? <Meta decks={live} ranked />
    : <Meta decks={HOME_META_DECKS.map(({ id, name, style }) => ({ id, name, note: style }))} ranked={false} />
}

const Meta = ({ decks, ranked }: { decks: MetaDeck[]; ranked: boolean }) => (
  <section id="meta" className="ol-sec">
    <RailHead num="03" label="Ranked meta" stamp="Share of ranked games" />
    <div className="ol-body flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <Lead title="The most played decks in ranked" text="Every card is unlocked, so any deck on this list is yours to build tonight." className="flex max-w-160 flex-col gap-3" />
        <Button variant="ghost" href="/leaderboard">View Leaderboard</Button>
      </div>
      <div className="ol-meta-row">
        <MetaCarousel decks={decks} ranked={ranked} />
        <div className="ol-deck ol-deck--shirai cut notch dots">
          <Sticker name="shirai-teach" size="lg" />
          <ShirAi size={16} />
          <p className="m-0 max-w-60 body-sm text-ink">Every number on Statistics comes from real ranked games. Check it before you pick your next deck.</p>
          <Button variant="secondary" href="/statistics">
            <Icon name="chart" />
            Follow the Meta
          </Button>
        </div>
      </div>
    </div>
  </section>
)

const Vip = () => (
  <section id="vip" aria-label="Become VIP" className="ol-sec">
    <RailHead label="Support Omega" stamp="VIP from 5 USD" emphasis />
    <div className="ol-body">
      <div className="ol-vip2">
        <div className="ol-vip2-main">
          <ArtCard
            accent="gold"
            art={ART}
            artPosition="35% 40%"
            icon={ic("coin")}
            animation="spin"
            eyebrow="VIP · From 5 USD"
            title="Back Omega and stand out at the table"
            titleAs="h2"
            clamp={false}
            footer={
              <span className="flex flex-wrap gap-3">
                <Button variant="secondary" href={PAYPAL_URL} target="_blank">Become VIP</Button>
                <Button variant="ghost" href="/download#donations">See VIP Perks</Button>
              </span>
            }
          >
            <span className="flex flex-col gap-4 pt-1">
              <span className="max-w-130 body">Donate 5 USD or more and every opponent sees your mat and sleeves. Donations keep Omega running and free for every duelist.</span>
              <span className="flex items-baseline gap-2">
                <span className="stat text-[88px] leading-[.9] text-gold">5</span>
                <span className="stat text-[28px] text-gold">USD</span>
                <span className="ml-2 signal-sm text-ink-muted">Minimum donation</span>
              </span>
            </span>
          </ArtCard>
        </div>
        <div className="ol-vip2-perks">
          <ArtCard size="sm" interactive titleAs="h3" accent="gold" icon={ic("star")} animation="spin" eyebrow="Perk 01" title="1 of each rarity" artPosition="80% 20%">One copy of each rarity on your account.</ArtCard>
          <ArtCard size="sm" interactive titleAs="h3" accent="violet" icon={ic("frame")} animation="flip" eyebrow="Perk 02" title="Mat and sleeves" artPosition="20% 60%">Your playmat and sleeves show to every opponent.</ArtCard>
          <ArtCard size="sm" interactive titleAs="h3" accent="cyan" icon={ic("block")} animation="wobble" eyebrow="Perk 03" title="No site ads" artPosition="60% 80%">Browse the stats, wiki and tournaments with no ads.</ArtCard>
        </div>
      </div>
    </div>
  </section>
)

type Ruling = { id: number; kind: string; name: string; sides: { eyebrow: string; title: string; text: string; footer: string; accent: "cyan" | "violet" | "gold"; icon: IconName }[] }

const RULINGS: Ruling[] = [
  {
    id: 39000945, kind: "TCG vs OCG", name: "Reflection of Endymion",
    sides: [
      { eyebrow: "TCG text", title: "Both returns or neither", accent: "cyan", icon: "cards", footer: "Played in TCG formats", text: "The card says \"and\", so both returns resolve as one. If either target is gone, neither card comes back and no counters are placed." },
      { eyebrow: "OCG text", title: "Each return stands alone", accent: "violet", icon: "swap", footer: "Played in OCG formats", text: "The official ruling splits the returns. If one target is gone, only that card is lost, and the other still comes back with its counters." },
    ],
  },
  {
    id: 26202165, kind: "Pre-errata vs current", name: "Sangan",
    sides: [
      { eyebrow: "Pre-errata text", title: "Free search, no limits", accent: "gold", icon: "history", footer: "Played in Time Wizard formats", text: "The original text only adds the monster. It has no once-per-turn clause and no lock on the card you search." },
      { eyebrow: "Current text", title: "One search, one lockout", accent: "cyan", icon: "cards", footer: "Played in current formats", text: "The current text limits the effect to once per turn and locks the searched card's name for the rest of the turn." },
    ],
  },
]

const Rulings = () => (
  <section id="rulings" className="ol-sec">
    <RailHead num="04" label="Rulings" stamp="Fluorohydride core" />
    <div className="ol-body flex flex-col gap-6">
      <h2 className="m-0 max-w-190 title display-2 text-ink">When TCG and OCG texts disagree, the card gets two scripts</h2>
      <p className="m-0 max-w-180 body">
        Omega runs the Fluorohydride core (ocgcore), patched for damage calculation and TCG rulings. A card whose wording, ruling or era differs gets its
        own script for each version.
      </p>
      {RULINGS.map((ruling, r) => (
        <div key={ruling.id} className={r ? "ol-duel2 ol-duel2--rev" : "ol-duel2"}>
          <figure className="ol-duel2-art">
            <figcaption className="ol-duel2-head">
              <span className="ol-duel2-kind title">{ruling.kind}</span>
              <span className="ol-duel2-name title display-3">{ruling.name}</span>
            </figcaption>
            <CardArt art={{ id: ruling.id, name: ruling.name }} sizes="300px" className="ol-duel2-img" />
          </figure>
          <div className="ol-duel2-stack">
            {ruling.sides.map((side, i) => (
              <div key={side.title} className={i ? "ol-duel2-b" : "ol-duel2-a"}>
                <ArtCard
                  interactive
                  titleAs="h3"
                  accent={side.accent}
                  icon={ic(side.icon)}
                  animation="clash"
                  eyebrow={side.eyebrow}
                  title={side.title}
                  art={CARD_ART_URL(ruling.id)}
                  artPosition={i ? "70% 30%" : "30% 30%"}
                  clamp={false}
                  footer={side.footer}
                >
                  {side.text}
                </ArtCard>
              </div>
            ))}
            <span className="ol-duel-vs cut" aria-label="versus">VS</span>
          </div>
        </div>
      ))}
    </div>
  </section>
)

const ERAS = [
  { year: "2002", name: "Original", note: "The first list" },
  { year: "2005", name: "GOAT", note: "For the retro duelists" },
  { year: "2010", name: "Edison", note: "The modern era on wheels" },
  { year: "2014", name: "HAT · Burning Abyss", note: "The Zexal era's finest format" },
  { year: "2017", name: "Link Zoo", note: "The last days of Broadbull on Earth" },
  { year: "2019", name: "TOSS", note: "The eternal format, last of MR4" },
]

const FORMAT_FAMILIES: { eyebrow: string; title: string; text: string; accent: "cyan" | "violet" | "gold" | "azure" | "ember"; icon: IconName; anim: "flip" | "spin" | "wobble" | "clash" | "jump" | "bob"; pos: string; chips: (string | { label: string; more: true })[] }[] = [
  { eyebrow: "Current", title: "Current lists", accent: "cyan", icon: "cards", anim: "flip", pos: "15% 30%", chips: ["TCG 19.10.2026", "OCG 01.10.2026", "WCS 19.10.2026"], text: "The newest TCG, OCG and WCS lists, with the previous ones still available." },
  { eyebrow: "Points", title: "Genesys at any cap", accent: "violet", icon: "coin", anim: "spin", pos: "50% 70%", chips: ["Genesys", "Genesys OCG"], text: "Every card has a cost. Play the standard 100 points, or set the budget to 0, 50, 150 or 200." },
  { eyebrow: "Frozen in time", title: "Time Wizard", accent: "gold", icon: "history", anim: "wobble", pos: "70% 20%", chips: ["GOAT", "Edison", "HAT", { label: "+7", more: true }], text: "Card pool and banlist locked to one date. Also Original, TeleDad, TenguPlant, VFD, B.Abyss, Link Zoo and TOSS." },
  { eyebrow: "Digital", title: "Master Duel", accent: "azure", icon: "star", anim: "spin", pos: "80% 80%", chips: ["MD 06.10.2026"], text: "The Master Duel banlist, to test a deck before you take it there." },
  { eyebrow: "Speed Duel", title: "Duel Links", accent: "ember", icon: "burst", anim: "clash", pos: "10% 40%", chips: ["Duel Links 26.06.2025", "Speed Duel 27.06.2026"], text: "The Duel Links banlist, plus the Speed Duel list: skills, three zones and smaller decks." },
  { eyebrow: "Alt rules", title: "Rush Duel", accent: "cyan", icon: "summon", anim: "jump", pos: "40% 60%", chips: ["Rush Duel 01.10.2026"], text: "Rush rules with Rush cards." },
  { eyebrow: "House rules", title: "Traditional", accent: "violet", icon: "unlock", anim: "bob", pos: "90% 70%", chips: ["TCG Traditional", "OCG Traditional"], text: "Forbidden cards come back at one copy, on the TCG or OCG list." },
  { eyebrow: "Community", title: "Player-made formats", accent: "azure", icon: "chat", anim: "wobble", pos: "40% 20%", chips: ["Trinity 2026.11"], text: "Formats the community designed and keeps updated, like Trinity." },
]

const Formats = () => (
  <section id="formats" className="ol-sec">
    <RailHead num="05" label="Formats" stamp="2002 to today" />
    <div className="ol-body flex flex-col gap-10">
      <div className="ol-fmt-head">
        <Lead
          title="Every era of Yu-Gi-Oh!, from the 2002 list to the current one"
          text="Pick a banlist before each duel: the current lists, a Time Wizard era, a community format or Genesys at any points cap."
          className="flex max-w-160 flex-col gap-3"
        />
        <div className="flex items-end gap-3.5">
          <span className="ol-big stat text-ink">29</span>
          <span className="max-w-32.5 pb-2.5 signal-sm text-ink-muted">Banlists in the client</span>
        </div>
      </div>
      <div className="ol-fmt-body">
        <ol className="ol-era" aria-label="Era formats by year">
          {ERAS.map((era) => (
            <li key={era.year}>
              <span className="stat text-ink">{era.year}</span>
              <span className="body-strong text-ink">{era.name}</span>
              <span className="body-sm">{era.note}</span>
            </li>
          ))}
          <li className="ol-era-now">
            <span className="stat text-cyan">Today</span>
            <span className="body-strong text-ink">TCG · OCG · Genesys</span>
            <span className="body-sm">Current formats, always updated</span>
          </li>
        </ol>
        <div className="ol-fmt-cards">
          <ArtCardGrid columns={4}>
            {FORMAT_FAMILIES.map((f) => (
              <ArtCard key={f.title} size="sm" interactive titleAs="h3" accent={f.accent} icon={ic(f.icon)} animation={f.anim} eyebrow={f.eyebrow} title={f.title} artPosition={f.pos} chips={f.chips} clamp={false}>
                {f.text}
              </ArtCard>
            ))}
          </ArtCardGrid>
        </div>
      </div>
    </div>
  </section>
)

/** `href: null`: the tool isn't on the site yet, so the card says so instead of linking nowhere. */
const TOOLS: { eyebrow: string; title: string; text: string; href: string | null; footer: string; accent: "cyan" | "violet" | "ember" | "gold" | "azure"; icon: IconName; anim: "flip" | "spin" | "jump" | "wobble" | "bob"; pos: string }[] = [
  { eyebrow: "Decks", title: "Deck Builder", href: "/deck-builder", footer: "Build a Deck", accent: "cyan", icon: "deck", anim: "flip", pos: "20% 70%", text: "Build and share your deck, or start from decks generated automatically from the best players in Omega ranked." },
  { eyebrow: "Odds", title: "Combo Calculator", href: "/calculator", footer: "Open the Calculator", accent: "violet", icon: "chart", anim: "spin", pos: "70% 30%", text: "The odds of opening your combo pieces, and how two builds compare." },
  { eyebrow: "Practice", title: "Combo Simulator", href: "/simulator", footer: "Open the Simulator", accent: "ember", icon: "play", anim: "jump", pos: "40% 50%", text: "Practice lines in the browser and save the combos that work." },
  { eyebrow: "Puzzles", title: "Puzzle & Rulings Simulator", href: null, footer: "Solve a Puzzle", accent: "gold", icon: "info", anim: "wobble", pos: "85% 60%", text: "Play puzzles in the browser, and ask about simple or complex rulings to get an answer on the spot." },
  { eyebrow: "Banlists", title: "Banlist Creator", href: null, footer: "Create a Banlist", accent: "azure", icon: "block", anim: "bob", pos: "15% 20%", text: "Write your own banlist for a local format or a house tournament." },
  { eyebrow: "Create", title: "Custom Card Maker", href: null, footer: "Make a Card", accent: "violet", icon: "edit", anim: "flip", pos: "60% 85%", text: "Design a card and download it ready to play in Omega." },
]

const Tools = () => (
  <section id="tools" className="ol-sec">
    <RailHead num="06" label="Deck tools" stamp="In the browser" />
    <div className="ol-body flex flex-col gap-6">
      <Lead title="Build in the browser, duel in the client" text="Six tools on the website, from building and testing a deck to designing your own cards." />
      <ArtCardGrid columns={3} className="ol-equal">
        {TOOLS.map((tool) => (
          <ArtCard
            key={tool.title}
            titleAs="h3"
            accent={tool.accent}
            href={tool.href ?? undefined}
            interactive={!tool.href}
            badge={tool.href ? undefined : <Chip>Soon</Chip>}
            icon={ic(tool.icon)}
            animation={tool.anim}
            eyebrow={tool.eyebrow}
            title={tool.title}
            artPosition={tool.pos}
            clamp={false}
            footer={tool.href ? tool.footer : undefined}
          >
            {tool.text}
          </ArtCard>
        ))}
      </ArtCardGrid>
    </div>
  </section>
)

const Modes = () => (
  <section id="modes" className="ol-sec">
    <RailHead num="07" label="Automatic and manual" stamp="One client" />
    <div className="ol-body flex flex-col gap-6">
      <Lead title="Automatic or manual, in the same client" text="One install covers both." />
      <ArtCardGrid columns={2}>
        <ArtCard titleAs="h3" accent="cyan" icon={ic("burst")} animation="clash" eyebrow="Ranked · tournaments" title="Automatic" artPosition="15% 40%" clamp={false}>
          The engine tracks life points, chains, timing windows and priority. You pick the plays, and the core resolves them under the rules of the format
          you chose.
        </ArtCard>
        <ArtCard titleAs="h3" accent="violet" icon={ic("hand")} animation="wobble" eyebrow="Casual" title="Manual" artPosition="85% 60%" clamp={false}>
          One Move button handles every card. Type /help for the chat commands, and bring your own custom cards.
        </ArtCard>
      </ArtCardGrid>
    </div>
  </section>
)

const FAQ = [
  { q: "Is YGO Omega free?", a: "Yes. Every card is unlocked, ranked is open to everyone and tournament entry costs nothing. Donations keep the project running." },
  { q: "Which platforms does YGO Omega run on?", a: "Windows, macOS, Linux, Android and iOS, through a launcher. It doesn't run in a browser, and the first update is about 2.9 GB." },
  { q: "Do I need a Discord account?", a: "Yes, to play online. You can install Omega and build decks without one." },
  { q: "Does Omega follow TCG or OCG rulings?", a: "Both. It runs the Fluorohydride core (ocgcore) and keeps a separate script wherever the TCG and OCG texts differ." },
  { q: "How do the automatic tournaments work?", a: "You register with a legal deck, and the engine checks it, pairs each Swiss round, records results and posts the standings. One tournament runs at a time, rotating between TCG, Genesys and Edison." },
  { q: "Can I duel manually?", a: "Yes. Manual mode is in the same client, with one Move button, chat commands like /help and support for custom cards." },
  { q: "Is there an offline AI opponent?", a: "Not yet. It depends on donations and has no release date." },
  { q: "How fast do new cards arrive?", a: "New cards are scripted between three hours and a week after they're revealed." },
]

const Faq = () => (
  <section id="faq" className="ol-sec">
    <RailHead num="08" label="FAQ" stamp={`${FAQ.length} questions`} />
    <div className="ol-body flex flex-wrap items-start gap-x-12 gap-y-6">
      <h2 className="m-0 flex-[1_1_280px] title display-2 text-ink">Questions about YGO Omega</h2>
      <div className="min-w-0 flex-[999_1_560px] border-t border-line">
        {FAQ.map(({ q, a }, i) => (
          <details key={q} open={i === 0} className="border-b border-line">
            <summary className="flex min-h-15 cursor-pointer items-center justify-between gap-4 text-ink">
              <h3 className="m-0 body-strong">{q}</h3>
              <span aria-hidden className="ol-plus flex text-cyan"><Icon name="plus" /></span>
            </summary>
            <p className="m-0 mb-5 max-w-160 body">{a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
)

const LatestWiki = async () => {
  const articles = await getLatestArticles()
  return articles.length ? <Wiki articles={articles} /> : null
}

/**
 * MediaCard takes one plain URL, so the cover goes through Next's optimizer here instead of shipping the 1920px
 * original into a ~455px card. 400 wide picks the 828 variant for 2x screens (`src` is the largest srcset entry).
 */
const coverSrc = ({ cover }: ArticleSummary) =>
  cover ? getImageProps({ src: cover.src, alt: "", width: 400, height: 172, quality: 75 }).props.src : undefined

const Wiki = ({ articles }: { articles: ArticleSummary[] }) => (
  <section id="wiki" className="ol-sec">
    <RailHead num="09" label="From the wiki" stamp="Latest" />
    <div className="ol-body flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <Lead
          title="Learn the game on the Omega wiki"
          text="Install guides, fixes for common problems, meta reports and set previews, all in one place. Start with the latest posts."
          className="flex max-w-170 flex-col gap-3"
        />
        <Button variant="secondary" href="/wiki">
          <Icon name="info" />
          Visit the Wiki
        </Button>
      </div>
      <ArtCardGrid columns={3}>
        {articles.map((article) => {
          const author = article.author.username ?? "Omega"
          return (
            <MediaCard
              key={article.id}
              size="sm"
              ratio="cinema"
              href={`/wiki/${article.slug}`}
              accent="cyan"
              image={coverSrc(article)}
              imageAlt={article.cover?.alt ?? ""}
              title={article.title}
              titleAs="h3"
              meta={
                <>
                  <Avatar name={author} src={article.author.avatarUrl} size="sm" />
                  <span className="font-semibold text-ink-dim">{author}</span>
                  <span>
                    · <LocalDay iso={article.publishedAt ?? article.updatedAt} />
                    {article.views === undefined ? null : ` · ${article.views} views`}
                  </span>
                </>
              }
            >
              {article.summary || null}
            </MediaCard>
          )
        })}
      </ArtCardGrid>
    </div>
  </section>
)

const Closing = () => (
  // Keeps #downloads alive: Google sitelinks and old links still point here.
  <section id="downloads" aria-label="Download Omega" className="ol-sec pb-18">
    <div className="ol-body ol-closing">
      <div className="ol-closing-copy">
        <Eyebrow tone="cyan" meta={PLATFORMS}>Free download</Eyebrow>
        <h2 className="m-0 title display-1 text-ink">Download Omega and queue your first match</h2>
        <p className="m-0 max-w-130 body">Every card is unlocked from the first launch. Online play needs a Discord account, and the first update is about 2.9 GB.</p>
        {/* #downloads used to hold these: Google sitelinks and old links still expect the direct files here. */}
        <p className="m-0 flex flex-wrap items-center gap-x-4 signal-sm text-ink-muted">
          Direct download:
          {DOWNLOAD_BUILDS.map(({ name, kind, file }) => (
            <a key={file} href={RELEASES_URL + file} className="py-1.5 text-ink-dim underline underline-offset-4 hover:text-ink">
              {name} {kind}
            </a>
          ))}
        </p>
      </div>
      <div className="ol-closing-line">
        <CharacterLine
          character="kurai"
          mood="point"
          stamp="Free · 5 platforms"
          actions={
            <>
              <Button href={DOWNLOAD_URL}>
                <Icon name="download" />
                Download Free
              </Button>
              <Button variant="ghost" href="/download#donations">See VIP Perks</Button>
            </>
          }
        >
          Every card is unlocked and it costs nothing. Download it and queue up. I&apos;ll be the one in the gold sleeves.
        </CharacterLine>
      </div>
    </div>
  </section>
)

/**
 * Landing, built on @omega-hub/ds: hero, nine numbered sections and a closing download pitch.
 * Sync on purpose: only the API-fed parts suspend, so the hero ships in the first chunk instead of behind `app/loading.tsx`.
 */
const HomePage = () => {
  // TCG ranking, started once and awaited by the hero fan and the meta section.
  const ranked: Ranked = getTopDecks("tcg").catch(() => null)

  return (
    <>
      <Header items={HOME_NAVBAR_ITEMS} />
      {/* No ads here (see NO_ADS in ads-mode.ts): the home is the download pitch. */}
      <main className="ol-page relative flex w-full flex-col overflow-x-clip text-ink-dim">
        <Hero ranked={ranked} />
        <div className="ol-after">
          <div aria-hidden className="ol-bg">
            <Image src={ART} alt="" fill sizes="100vw" />
          </div>
          <div aria-hidden className="ol-bg ol-bg--end">
            <Image src={ART} alt="" fill sizes="100vw" />
          </div>
          <Why />
          <Tournaments />
          <Suspense>
            <LiveMeta ranked={ranked} />
          </Suspense>
          <NonVipOnly>
            <Vip />
          </NonVipOnly>
          <Rulings />
          <Formats />
          <Tools />
          <Modes />
          <Faq />
          <Suspense>
            <LatestWiki />
          </Suspense>
          <Closing />
        </div>
      </main>
      <Footer />
    </>
  )
}

export default HomePage;
