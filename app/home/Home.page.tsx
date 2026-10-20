import Image from "next/image";
import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import { ArticleCard } from "@omega/wiki/article";
import { Button } from "@ui/button";
import { Chip } from "@ui/chip";
import { Eyebrow } from "@ui/eyebrow";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { Icon } from "@ui/icon";
import {
  ANALYTICS_ENABLED,
  DECK_BUILDER_URL,
  DOWNLOAD_URL,
  FORMATS_SUPPORTED,
  HOME_AUTO_TOURNAMENT_FAQ,
  HOME_DOUBLE_SCRIPT_DISPLAY,
  HOME_FAQ,
  HOME_FAQ_ALTERNATIVE,
  HOME_META_DECKS,
  HOME_MODES,
  HOME_NAVBAR_ITEMS,
  HOME_TOOLS,
} from "@utils/const";
import { getLatestArticles } from "@utils/articles";
import { getTopDecks } from "@utils/global-explorer";
import type { ArticleSummary } from "@utils/types";
import { Carousel } from "@ui/carousel";
import { useTranslations } from "next-intl";
import { NonVipOnly } from "@omega/ads/non-vip-only";
import { VipPanel } from "@app/download/vip-panel";

type MetaDeck = { id: number; name: string; note: string }

/** Content column: 1280px of content plus the page gutter on each side. */
const WRAP = "mx-auto w-full max-w-[calc(var(--container-page)+2*var(--spacing-gutter))] px-gutter"
const SECTION_GAP = "flex flex-col gap-[clamp(28px,4vw,48px)]"
const BAND_TITLE = "font-display text-[clamp(40px,7vw,104px)] leading-[0.92] uppercase text-balance"
const BAND_LEAD = "text-[clamp(16px,1.6vw,20px)] leading-[1.55] text-ink-dim"
const NOTE = "text-ink-muted signal-sm"
/** Anton set as an outline only. */
const OUTLINE = "text-transparent [-webkit-text-stroke:var(--stroke-w)_var(--stroke-c)]"

const Download = ({ size, variant }: { size?: "lg"; variant?: "secondary" }) => (
  <Button href={DOWNLOAD_URL} size={size} variant={variant}>
    <Icon name="down" />
    Download free
  </Button>
)

const DownloadNote = ({ className }: { className?: string }) => (
  <span className={twMerge(NOTE, className)}>No credit card. Install takes under 2 minutes.</span>
)

/** Numbered strip that opens a band: gold number, mono label, a rule to the edge. */
const Rail = ({ num, children }: { num: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 text-ink-muted signal">
    <span className="font-bold text-gold">{num}</span>
    <span className="font-bold whitespace-nowrap text-ink">{children}</span>
    <span aria-hidden className="h-px flex-1 bg-line-mid" />
  </div>
)

const Band = ({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) => (
  <section id={id} className={twMerge("scroll-mt-16 pt-[clamp(72px,10vw,144px)]", className)}>
    <div className={twMerge(WRAP, SECTION_GAP)}>{children}</div>
  </section>
)

/* ------------------------------------------------------------------ hero */

type Card = { id: number; name: string | null }

/** Shown when the API has no top deck to offer. */
const HERO_FALLBACK: Card[] = [
  { id: 26077387, name: "Sky Striker Ace Raye" },
  { id: 13332685, name: "Ame no Habakiri no Mitsurugi" },
  { id: 68468459, name: "Fallen of Albaz" },
]

const HERO_SLOTS = [
  { tilt: "-rotate-9", edge: "[--edge:var(--color-line-strong)]", slot: "w-[34%] -mr-[10%] translate-y-[8%]" },
  { tilt: "", edge: "[--edge:var(--color-cyan)]", slot: "relative z-2 w-[40%]" },
  { tilt: "rotate-9", edge: "[--edge:var(--color-line-strong)]", slot: "w-[34%] -ml-[10%] translate-y-[8%]" },
]

/** Fanned card art, notched like the client's panels. */
const CardFan = ({ cards }: { cards: Card[] }) => (
  <div className="flex flex-[0_1_460px] items-end justify-center px-6">
    {cards.slice(0, 3).map((c, i) => ({ ...c, ...HERO_SLOTS[i] })).map((card) => (
      <div key={card.id} className={card.slot}>
        <div className={twMerge("cut notch aspect-11/16 w-full [--cut:18px] [--fill:var(--color-surface-200)]", card.edge, card.tilt)}>
          <CardArt
            art={{ id: card.id, name: card.name ?? "" }}
            sizes="(min-width: 1280px) 190px, 30vw"
            priority
            className="absolute inset-px [clip-path:polygon(0_0,calc(100%-17px)_0,100%_17px,100%_100%,0_100%)]"
          >
            <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-space-000 to-transparent px-3 pt-8 pb-3 font-sans text-sm leading-4.5 font-bold text-ink">
              {card.name}
            </span>
          </CardArt>
        </div>
      </div>
    ))}
  </div>
)

const Hero = ({ cards }: { cards: Card[] }) => (
  <section id="top" className="dots relative overflow-hidden border-b border-line pt-[calc(4rem+clamp(56px,8vw,120px))] pb-[clamp(64px,9vw,140px)]">
    <div aria-hidden className="absolute top-[-18%] right-[-12%] aspect-square w-[min(900px,90%)] rounded-round bg-[radial-gradient(circle,rgba(0,253,255,0.22)_0%,rgba(74,111,216,0.16)_35%,rgba(8,10,20,0)_68%)]" />
    <Image src="/omega-mark.png" alt="" width={720} height={672} aria-hidden className="absolute -top-[4%] -right-[6%] w-[min(720px,70%)] opacity-9" />
    <div className={twMerge(WRAP, "relative flex flex-col gap-[clamp(32px,5vw,64px)]")}>
      <Eyebrow tone="cyan" meta="Windows · macOS · Linux · Android">Free · every card unlocked</Eyebrow>
      <h1 className="font-display text-[clamp(52px,10.4vw,115px)] leading-[0.88] tracking-[-0.005em] uppercase text-balance">
        The first Yu-Gi-Oh! simulator with <span className="text-cyan">automatic tournaments</span>
      </h1>
      <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-10">
        <div className="flex max-w-155 flex-[1_1_380px] flex-col gap-7">
          <p className={twMerge(BAND_LEAD, "max-w-[56ch]")}>
            Official TCG and OCG rulings, every card unlocked, Elo ranking, and Swiss tournaments. No install beyond the launcher. Free.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Download size="lg" />
            <DownloadNote />
          </div>
        </div>
        <CardFan cards={cards} />
      </div>
      <ValueCards />
    </div>
  </section>
)

const VALUE_CARD = "group cut notch relative flex min-h-60 flex-col justify-between gap-8 overflow-hidden p-[clamp(24px,3vw,32px)] [--cut:var(--cut-lg)] motion-safe:transition-[translate] motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-1"
/** Glow in the card's corner, brighter while hovered. */
const CardGlow = ({ tone }: { tone: string }) => (
  <span aria-hidden className={twMerge("absolute -top-1/2 -right-1/4 aspect-square w-[80%] rounded-round opacity-40 group-hover:opacity-90 motion-safe:transition-opacity motion-safe:duration-300", tone)} />
)

/** One duelist's season, rising with dips: 13 results, ends top-right. */
const ELO_WALK = "4,64 28,58 52,62 76,50 100,54 124,42 148,46 172,36 196,40 220,28 244,31 268,20 292,12"

/** Hero's two promises. Each loop rests on its last frame, which is all reduced motion sees. */
const ValueCards = () => (
  <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
    <div className={twMerge(VALUE_CARD, "hover:[--edge:var(--color-gold)]")}>
      <CardGlow tone="bg-[radial-gradient(circle,rgba(239,209,126,0.22)_0%,rgba(0,0,0,0)_65%)]" />
      <div className="relative flex items-end justify-between gap-6">
        <dt className="font-display text-[clamp(72px,9vw,128px)] leading-[0.82] text-gold">$0</dt>
        <ul aria-hidden className="flex flex-col items-end gap-2.5">
          {["Currency", "Crafting", "Packs"].map((word, i) => (
            <li key={word} className="relative font-display text-[clamp(24px,2.6vw,34px)] leading-none text-ink-muted uppercase">
              {word}
              <span className="absolute -inset-x-1.5 top-[calc(50%-1.5px)] h-0.75 origin-left animate-strike bg-gold" style={{ animationDelay: `${i * 0.4}s` }} />
            </li>
          ))}
        </ul>
      </div>
      <ul aria-hidden className="relative flex flex-col gap-2 font-mono text-sm leading-none text-ink-dim">
        {["Every card", "Ranked queue", "Tournament entry"].map((item) => (
          <li key={item} className="flex items-baseline gap-2">
            {item}
            <span className="flex-1 border-b border-dotted border-line-mid" />
            <b className="text-gold">$0.00</b>
          </li>
        ))}
      </ul>
      <dd className="relative text-ink-dim signal">No currency, no crafting, no packs</dd>
    </div>

    <div className={twMerge(VALUE_CARD, "hover:[--edge:var(--color-cyan)]")}>
      <CardGlow tone="bg-[radial-gradient(circle,rgba(0,253,255,0.18)_0%,rgba(0,0,0,0)_65%)]" />
      <div className="relative flex items-end justify-between gap-6">
        <dt className="font-display text-[clamp(72px,9vw,128px)] leading-[0.82] text-cyan">Elo</dt>
        <span aria-hidden className="flex flex-col items-end gap-1.5">
          <span className="text-ink-muted signal-sm">Rating</span>
          <span className="elo-count animate-count font-mono text-[clamp(28px,3vw,40px)] leading-none font-bold text-ink" />
          <span className="font-mono text-sm leading-none font-bold text-win">+148</span>
        </span>
      </div>
      <svg aria-hidden viewBox="0 0 300 76" className="relative -my-2 w-full overflow-visible">
        {[16, 40, 64].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} className="stroke-line" strokeDasharray="2 6" />)}
        <polyline points={ELO_WALK} pathLength={1} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="animate-draw stroke-cyan [stroke-dasharray:1]" />
        <circle cx="292" cy="12" r="5" className="origin-center animate-pop fill-cyan [transform-box:fill-box]" />
      </svg>
      <dd className="relative text-ink-dim signal">A rating that moves with your results</dd>
    </div>
  </dl>
)

/** Every supported format in outsized Anton, alternating solid and outline, on a 40s loop. */
const FormatTicker = () => (
  <div role="marquee" aria-label="Supported formats" className="overflow-hidden border-b border-line bg-space-000 py-[clamp(16px,2.4vw,28px)]">
    <div className="flex w-max animate-ticker">
      {[0, 1].map((copy) => (
        <div key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0">
          {FORMATS_SUPPORTED.map(({ title }, i) => (
            <span
              key={title}
              className={twMerge(
                "flex items-center gap-[clamp(20px,3vw,40px)] pr-[clamp(20px,3vw,40px)] font-display text-[clamp(40px,6vw,88px)] leading-[1.1] whitespace-nowrap uppercase",
                i % 2 ? twMerge(OUTLINE, "[--stroke-c:var(--color-line-strong)] [--stroke-w:1.5px]") : "text-ink",
              )}
            >
              {title}
              <span aria-hidden className="size-3.5 rotate-45 bg-cyan" />
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
)

/* ------------------------------------------------------------------ bands */

const Alternative = () => (
  <Band id="alternative">
    <Rail num="01">Free Master Duel alternative</Rail>
    <h2 className={twMerge(BAND_TITLE, "max-w-[14ch]")}>Three reasons players leave official clients</h2>
    <ol className="flex flex-col border-b border-line">
      {HOME_FAQ_ALTERNATIVE.map(({ title, text }, i) => (
        <li key={title} className="flex flex-wrap items-start gap-x-[clamp(24px,4vw,64px)] gap-y-3 border-t border-line py-[clamp(28px,4vw,48px)]">
          <span aria-hidden className={twMerge(OUTLINE, "flex-none font-display text-[clamp(88px,14vw,200px)] leading-[0.8] [--stroke-c:var(--color-cyan)] [--stroke-w:2px]")}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="flex flex-[1_1_420px] flex-col gap-3.5 pt-2">
            <h3 className="font-display text-[clamp(30px,4.2vw,60px)] leading-[0.95] uppercase">{title}</h3>
            <p className="max-w-[60ch] text-[clamp(15px,1.4vw,18px)] leading-[1.6] text-ink-dim">{text}</p>
          </div>
        </li>
      ))}
    </ol>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <Download variant="secondary" />
      <DownloadNote />
    </div>
  </Band>
)

const Tournaments = () => (
  <section id="tournaments" className="mt-[clamp(72px,10vw,144px)] scroll-mt-16 border-y border-line-mid bg-surface-100 bg-[radial-gradient(ellipse_60%_80%_at_0%_0%,rgba(0,253,255,0.10),rgba(0,0,0,0)_70%)] py-[clamp(56px,8vw,112px)]">
    <div className={twMerge(WRAP, SECTION_GAP)}>
      <Rail num="02">Yugioh automatic tournament</Rail>
      <div className="flex flex-wrap items-end gap-x-16 gap-y-8">
        <h2 className={twMerge(BAND_TITLE, "max-w-[18ch] flex-[1_1_520px]")}>Decks lock at round one and stay locked to the last round</h2>
        <div className="flex flex-[1_1_320px] flex-col gap-6">
          <h3 className="font-display text-[28px] leading-none text-cyan uppercase">Automatic, rotating Swiss tournaments</h3>
          <p className="text-base leading-[1.6] text-ink-dim">
            Sign up, submit a deck, and duel. Omega checks the list against the format&apos;s banlist, pairs the round, records the result and updates the standings. Decks lock the moment the tournament starts, so no judge has to check for swaps. Rotating tournaments open on the calendar by themselves, with no organizer behind them.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button href="/tournaments" variant="secondary">
              <Icon name="sword" />
              Start dueling
            </Button>
            <Button href="/calendar" variant="ghost">
              <Icon name="calendar" />
              See the calendar
            </Button>
            <span className={NOTE}>Free entry. Elo counted.</span>
          </div>
        </div>
      </div>
      <Eyebrow meta="Step 1">Handled by the engine</Eyebrow>
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-px border border-line-strong bg-line-strong">
        {HOME_AUTO_TOURNAMENT_FAQ.map(({ title, text }, i) => (
          <li key={title} className="flex flex-col gap-3 bg-steel px-5.5 pt-6 pb-6.5">
            <span className="flex items-center gap-3">
              <span className="cut grid size-11 place-items-center font-mono text-[13px] leading-none font-bold text-cyan [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span aria-hidden className="h-px flex-1 bg-line-strong opacity-50" />
            </span>
            <b className="text-lg leading-6">{title}</b>
            <span className="text-sm leading-5.5 text-ink-dim">{text}</span>
          </li>
        ))}
      </ol>
    </div>
  </section>
)

/** Left label per ruling split: TCG vs OCG text, or pre-errata vs current text. */
const SPLIT = {
  tcg: [<Chip key="a" tone="tcg">TCG text</Chip>, <Chip key="b" tone="ocg">OCG text</Chip>],
  errata: [<Chip key="a">Pre-errata text</Chip>, <Chip key="b" tone="cyan">Current text</Chip>],
}

const Rulings = () => (
  <Band id="rullings">
    <Rail num="03">Yugioh TCG OCG rulings</Rail>
    <h2 className={twMerge(BAND_TITLE, "max-w-[18ch]")}>When two texts disagree, the card gets two scripts</h2>
    <p className="max-w-[72ch] text-[clamp(15px,1.4vw,18px)] leading-[1.6] text-ink-dim">
      Omega runs the official Fluorohydride core, ocgcore, with corrections to damage calculation and to TCG rulings. It&apos;s the first automatic simulator that scripts a card separately whenever its wording, ruling, or era diverges: TCG versus OCG, and current text versus pre-errata text. Pick a format and you get that format&apos;s card, resolved by a script instead of a server&apos;s interpretation.
    </p>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))] gap-[clamp(32px,4vw,48px)]">
      {HOME_DOUBLE_SCRIPT_DISPLAY.map((card) => (
        <div key={card.id} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <CardArt art={{ id: card.id, name: card.name }} sizes="36px" className="h-13 w-9 shrink-0 rounded-xs border border-line-strong" />
            <span className="font-display text-[clamp(28px,3.4vw,44px)] leading-none uppercase">{card.name}</span>
          </div>
          <div className="relative flex flex-wrap gap-px border border-line bg-line">
            {card.effects.map((effect, i) => (
              <div key={effect.title} className="flex flex-[1_1_260px] flex-col gap-3 bg-surface-100 p-[clamp(20px,3vw,32px)]">
                <div className="flex">{SPLIT[card.isPreErrata ? "errata" : "tcg"][i]}</div>
                <b className="font-display text-[clamp(24px,2.6vw,34px)] leading-none font-normal uppercase">{effect.title}</b>
                <span className="text-[15px] leading-[1.6] text-ink-dim">{effect.description}</span>
              </div>
            ))}
            <span aria-hidden className="absolute top-1/2 left-1/2 grid size-11 -translate-1/2 rotate-45 place-items-center border border-cyan bg-space-000">
              <span className="-rotate-45 font-mono text-xs leading-none font-bold text-cyan">VS</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  </Band>
)

const Formats = () => (
  <Band id="formats">
    <Rail num="04">Yugioh formats and banlists</Rail>
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
      <div className="flex flex-[1_1_560px] flex-col gap-5">
        <h2 className={twMerge(BAND_TITLE, "max-w-[16ch]")}>{FORMATS_SUPPORTED.length} formats, and every banlist the game has ever had</h2>
        <p className={twMerge(BAND_LEAD, "max-w-[56ch]")}>Switch era between duels. Nothing to buy, nothing to unlock, no second client to install.</p>
      </div>
      <Download variant="secondary" />
    </div>
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-px border border-line bg-line">
      {FORMATS_SUPPORTED.map(({ title, text }, i) => {
        const num = String(i + 1).padStart(2, "0")
        return (
          <li key={title} className="relative flex min-h-45 flex-col gap-2.5 overflow-hidden bg-surface-100 p-6">
            <span aria-hidden className={twMerge(OUTLINE, "absolute -right-1.5 -bottom-5.5 font-display text-[120px] leading-none [--stroke-c:var(--color-line-mid)] [--stroke-w:1px]")}>{num}</span>
            <span className="font-bold text-gold signal-sm">{num}</span>
            <h3 className="font-display text-[30px] leading-none uppercase">{title}</h3>
            <span className="relative text-sm leading-[1.55] text-ink-dim">{text}</span>
          </li>
        )
      })}
    </ul>
  </Band>
)

const MetaDecks = ({ decks }: { decks: MetaDeck[] }) => (
  <Band id="meta">
    <Rail num="05">Free Yugioh ranked online</Rail>
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
      <h2 className={twMerge(BAND_TITLE, "max-w-[15ch] flex-[1_1_560px]")}>Play the current meta the week it shifts</h2>
      <p className={twMerge(BAND_LEAD, "max-w-[40ch] flex-[1_1_320px]")}>These decks are in the ranked queue now. Build any of them, in full, for nothing.</p>
    </div>
    <Carousel label="Top decks in the ranked queue">
      {decks.map((deck, i) => (
        <a key={`${deck.id}-${i}`} href={`/wiki/card/${deck.id}`} className="cut notch flex h-full flex-col text-ink [--cut:14px] hover:-translate-y-0.5 hover:[--edge:var(--color-line-strong)] motion-safe:transition-transform motion-safe:duration-120">
          <CardArt
            art={{ id: deck.id, name: deck.name }}
            alt={`${deck.name} deck card artwork`}
            sizes="300px"
            className="mx-px mt-px aspect-4/3 [clip-path:polygon(0_0,calc(100%-13px)_0,100%_13px,100%_100%,0_100%)]"
          >
            <span className="absolute inset-x-3.5 top-3.5 flex items-start justify-between">
              <Chip tone="tcg">In ranked</Chip>
              <span className="font-mono text-[11px] leading-none font-bold text-ink">{String(i + 1).padStart(2, "0")}</span>
            </span>
          </CardArt>
          <span className="px-5 pt-4.5 pb-1 font-display text-[28px] leading-none uppercase">{deck.name}</span>
          <span className={twMerge("px-5 pb-5", NOTE)}>{deck.note}</span>
        </a>
      ))}
    </Carousel>
  </Band>
)

/** Decorative deck-builder mock: search, filter chips, a card grid with one selected slot. */
const BuilderPreview = () => (
  <div role="img" aria-label="Deck builder preview" className="cut notch flex flex-col gap-4 p-5 [--cut:18px] [--edge:var(--color-line-strong)]">
    <div className="flex items-center gap-2">
      <span className="cut flex h-10 flex-1 items-center gap-2 px-3 text-sm text-ink-muted [--fill:var(--color-surface-200)]">
        <Icon name="search" />
        Mitsurugi
      </span>
      <Chip tone="tcg">TCG</Chip>
    </div>
    <div className="flex flex-wrap gap-1.5">
      <Chip>Light</Chip>
      <Chip>Level 4</Chip>
      <Chip>Ritual</Chip>
      <Chip tone="gold">Limited</Chip>
    </div>
    <div className="grid grid-cols-6 gap-1.5">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={twMerge("aspect-11/16 rounded-xs border bg-surface-300", i === 5 ? "border-cyan" : "border-line-mid")} />
      ))}
    </div>
    <div className="flex items-center justify-between text-ink-muted signal-sm">
      <span>Main 40 · Extra 15 · Legal</span>
      <span className="text-cyan">Share link</span>
    </div>
  </div>
)

const Tools = () => (
  <Band id="tools">
    <Rail num="06">Yugioh deck builder online</Rail>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-[clamp(32px,5vw,64px)]">
      <div className="flex flex-col gap-6">
        <h2 className={twMerge(BAND_TITLE, "max-w-[16ch]")}>Build the deck in the browser, then duel it in the client</h2>
        <p className={twMerge(BAND_LEAD, "max-w-[48ch]")}>
          Filter the full card pool by attribute, level, type, archetype and banlist status. Save the list, share the link, load it into Omega.
        </p>
        <div className="flex">
          <Button href={DECK_BUILDER_URL} variant="secondary">
            <Icon name="deck" />
            Build my deck
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <BuilderPreview />
        <ul className="flex flex-col gap-px border border-line bg-line">
          {HOME_TOOLS.map(({ title, text }) => (
            <li key={title}>
              <a href={DECK_BUILDER_URL} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-surface-100 px-5.5 py-5 text-ink hover:bg-surface-300">
                <span className="flex flex-col gap-1">
                  <b className="text-[17px] leading-6">{title}</b>
                  <span className="text-sm leading-normal text-ink-dim">{text}</span>
                </span>
                <Icon name="right" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </Band>
)

/** Automatic sits on steel with a cyan outline word; Manual on surface-100 with gold. */
const MODE_TONE = [
  { fill: "bg-steel", stroke: "[--stroke-c:var(--color-cyan)]" },
  { fill: "bg-surface-100", stroke: "[--stroke-c:var(--color-gold)]" },
]

const Modes = () => (
  <Band id="modes">
    <Rail num="07">Yugioh simulator manual and automatic</Rail>
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
      <h2 className={twMerge(BAND_TITLE, "max-w-[14ch] flex-[1_1_560px]")}>Automatic and manual, in the same client</h2>
      <p className={twMerge(BAND_LEAD, "max-w-[44ch] flex-[1_1_320px]")}>
        Nobody has to pick a platform. Practice a physical tournament by hand on Monday, grind Elo on the engine on Tuesday, keep one install.
      </p>
    </div>
    <div className="flex flex-wrap gap-px border border-line-strong bg-line-strong">
      {HOME_MODES.map(({ title, text }, i) => (
        <div key={title} className={twMerge("relative flex min-h-85 flex-[1_1_380px] flex-col justify-end gap-4 overflow-hidden p-[clamp(24px,4vw,48px)]", MODE_TONE[i]?.fill)}>
          <span aria-hidden className={twMerge(OUTLINE, "absolute -top-2.5 -left-1 font-display text-[clamp(96px,13vw,180px)] leading-[0.85] uppercase opacity-60 [--stroke-w:1.5px]", MODE_TONE[i]?.stroke)}>
            {title}
          </span>
          <h3 className="relative font-display text-[clamp(36px,4.4vw,60px)] leading-[0.95] uppercase">{title}</h3>
          <p className="relative max-w-[46ch] text-base leading-[1.6] text-ink-dim">{text}</p>
        </div>
      ))}
    </div>
  </Band>
)

/** The home carries no ads: the VIP pitch takes their place. `num="VIP"` keeps 01–09 unbroken when it hides. */
const Vip = () => {
  const t = useTranslations("Download.donations")
  return (
    <Band id="vip">
      <Rail num="VIP">{t("heading")}</Rail>
      <VipPanel />
    </Band>
  )
}

const Faq = () => (
  <Band id="faq">
    <Rail num="08">FAQ</Rail>
    <div className="flex flex-wrap items-start gap-[clamp(24px,4vw,64px)]">
      <h2 className={twMerge(BAND_TITLE, "max-w-[10ch] flex-[1_1_300px]")}>Questions, answered in one line</h2>
      <div className="flex min-w-0 flex-[2_1_520px] flex-col border border-b-0 border-line">
        {HOME_FAQ.map(({ question, answer }, i) => (
          <details key={question} open={i === 0} className="group border-b border-line bg-surface-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5.5 font-display text-[clamp(22px,2.4vw,30px)] leading-[1.05] uppercase [&::-webkit-details-marker]:hidden">
              {question}
              <span aria-hidden className="grid size-7 shrink-0 place-items-center border border-line-strong font-mono text-base leading-none font-bold text-cyan">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">−</span>
              </span>
            </summary>
            <p className="max-w-[70ch] px-6 pb-6 text-base leading-[1.6] text-ink-dim">{answer}</p>
          </details>
        ))}
      </div>
    </div>
  </Band>
)

const Wiki = ({ articles }: { articles: ArticleSummary[] }) => (
  <Band id="wiki">
    <Rail num="09">Yugioh wiki</Rail>
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
      <h2 className={twMerge(BAND_TITLE, "max-w-[15ch] flex-[1_1_560px]")}>Latest from the wiki</h2>
      <Button href="/wiki" variant="ghost">
        All articles
        <Icon name="right" />
      </Button>
    </div>
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
    </ul>
  </Band>
)

const ClosingCta = () => (
  <section className="relative mt-[clamp(80px,11vw,160px)] overflow-hidden border-t border-line-mid bg-surface-100 bg-[radial-gradient(ellipse_50%_70%_at_50%_100%,rgba(0,253,255,0.18),rgba(0,0,0,0)_70%)] py-[clamp(72px,10vw,144px)]">
    <Image src="/omega-mark.png" alt="" width={820} height={765} aria-hidden className="absolute -bottom-[30%] left-1/2 w-[min(820px,120%)] -translate-x-1/2 opacity-8" />
    <div className={twMerge(WRAP, "relative flex flex-col items-center gap-8 text-center")}>
      <Image src="/omega-mark.png" alt="" width={88} height={82} />
      <h2 className="max-w-[16ch] font-display text-[clamp(44px,8vw,120px)] leading-[0.9] uppercase text-balance">
        Free automatic Yu-Gi-Oh! simulator. <span className="text-cyan">Ranked, scripted, judged by the engine.</span>
      </h2>
      <div className="flex flex-col items-center gap-3.5">
        <Download size="lg" />
        <DownloadNote />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {["Windows", "macOS", "Linux", "Android"].map((os) => <Chip key={os}>{os}</Chip>)}
      </div>
      <div className="flex flex-wrap justify-center gap-6 text-ink-dim signal">
        <span>Every card unlocked</span>
        <span aria-hidden className="text-line-strong">/</span>
        <span>Install under 2 minutes</span>
      </div>
    </div>
  </section>
)

/** Landing, rebuilt on the Omega Hub design system: hero, format ticker, eight numbered bands, closing call to action. */
const HomePage = async () => {
  // TCG ranking; the landing falls back to the static picks if the API is down or has no open season.
  const [ranked, articles] = await Promise.all([ANALYTICS_ENABLED ? getTopDecks("tcg").catch(() => null) : null, getLatestArticles()])
  const top = ranked ?? []
  const heroCards = top[0]?.topCards.length === 3 ? top[0].topCards : HERO_FALLBACK
  const live = top.flatMap(({ topCards: [card], name, metaShare }) =>
    card && name ? [{ id: card.id, name, note: `${(metaShare * 100).toFixed(1)}% of the meta` }] : [])
  const decks: MetaDeck[] = live.length ? live : HOME_META_DECKS.map(({ id, name, style }) => ({ id, name, note: style }))

  return (
    <>
      <Header items={HOME_NAVBAR_ITEMS} />
      <main className="relative flex w-full flex-col overflow-x-clip">
        <Hero cards={heroCards} />
        <FormatTicker />
        <Alternative />
        <Tournaments />
        <Rulings />
        <Formats />
        <MetaDecks decks={decks} />
        <Tools />
        <Modes />
        <NonVipOnly>
          <Vip />
        </NonVipOnly>
        <Faq />
        {articles.length ? <Wiki articles={articles} /> : null}
        <ClosingCta />
      </main>
      <Footer />
    </>
  )
}

export default HomePage;
