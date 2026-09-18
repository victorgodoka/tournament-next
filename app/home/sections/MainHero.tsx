import { ArtTile } from "@omega/art-tile";
import { Button, Eyebrow } from "@ui/index";
import { CARD_ART_URL, DOWNLOAD_URL, FORMATS_SUPPORTED } from "@utils/const";

const Figure = ({ value, label, className }: { value: string; label: string; className?: string }) => (
  <div className={className}>
    <p className="display-3">{value}</p>
    <p className="mt-1.5 font-mono text-[10px] tracking-[.12em] text-ink-muted uppercase">{label}</p>
  </div>
)

/** Gold band of every supported format, scrolled on a -50% loop; the second copy is aria-hidden. */
const FormatTicker = () => (
  <div className="shrink-0 overflow-hidden border-t border-line-strong bg-gold py-3.25">
    <div className="flex w-max animate-ticker font-display text-xs tracking-[.1em] text-gold-on uppercase sm:text-sm md:text-base">
      {[0, 1].map((copy) => (
        <p key={copy} aria-hidden={copy === 1 || undefined} className="flex gap-6.5 pr-6.5 whitespace-nowrap">
          {FORMATS_SUPPORTED.map(({ title }) => (
            <span key={title} className="flex gap-6.5">
              <span>{title}</span>
              <span aria-hidden>/</span>
            </span>
          ))}
        </p>
      ))}
    </div>
  </div>
)

/**
 * Split hero: copy on the left, a duotone card-art collage on the right, the format ticker last.
 * From xl the section is exactly one viewport tall: the split takes whatever the header and the
 * ticker leave, so the ticker always sits on the bottom edge of the first screen. The headline is
 * capped by viewport height there so short screens don't push the copy into the ticker.
 */
export const MainHero = () => (
  <section id="top" className="flex flex-col border-b border-line-strong pt-16 xl:h-dvh xl:min-h-170">
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="flex flex-col px-5.5 pt-10 pb-8.5 sm:px-11 sm:pt-18 sm:pb-14 xl:flex-1 xl:border-r xl:border-line">
        <Eyebrow live meta="Est. 2019 / Duelists Unite">Free. Every card unlocked.</Eyebrow>
        <h1 className="flex-1 pt-8.5 text-ink display-hero xl:text-[clamp(46px,min(6.6vw,10dvh),104px)]">
          The first <span className="text-gold">Yu-Gi-Oh!</span> simulator with a{" "}
          <span className="inline-block bg-cyan px-[.12em] text-cyan-on">real automatic</span> tournament system
        </h1>
        <div className="mt-11 flex flex-wrap items-end gap-6.5 border-t border-line pt-8 sm:gap-10 xl:flex-nowrap">
          <p className="max-w-140 text-ink-dim lead">
            Official TCG and OCG rulings, every card unlocked, Elo ranking, and Swiss tournaments. No install beyond the launcher. Free.
          </p>
          <div className="shrink-0">
            <Button size="lg" shadow href={DOWNLOAD_URL}>Download free</Button>
            <p className="mt-3.5 font-mono text-[11px] tracking-[.06em] text-ink-muted">No credit card. Install takes under 2 minutes.</p>
          </div>
        </div>
      </div>

      {/* Below xl the tiles keep their aspect ratios; from xl the two image rows share the height left over. */}
      <div className="grid grid-cols-2 max-xl:border-t max-xl:border-line xl:w-[min(700px,42vw)] xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <ArtTile lead wash="cyan" label="Mitsurugi" src={CARD_ART_URL(13332685)} alt="Ame no Habakiri no Mitsurugi card artwork" width={960} height={480} sizes="(min-width: 1280px) 42vw, 100vw" className="col-span-2 aspect-2/1 border-b border-line xl:aspect-auto" />
        <ArtTile wash="gold" src={CARD_ART_URL(26077387)} alt="Sky Striker Ace Raye card artwork" width={480} height={480} sizes="(min-width: 1280px) 21vw, 50vw" className="aspect-square border-r border-b border-line xl:aspect-auto" />
        <ArtTile wash="indigo" src={CARD_ART_URL(68468459)} alt="Fallen of Albaz card artwork" width={480} height={480} sizes="(min-width: 1280px) 21vw, 50vw" className="aspect-square border-b border-line xl:aspect-auto" />
        <Figure value="$0" label="No currency, no crafting, no packs" className="border-r border-line px-5 py-5.5 text-gold" />
        <Figure value="Elo" label="A rating that moves with your results" className="px-5 py-5.5 text-ink" />
      </div>
    </div>

    <FormatTicker />
  </section>
)
