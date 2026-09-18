import Image from "next/image";
import { Button } from "@ui/index";
import { CARD_ART_URL, DOWNLOAD_URL } from "@utils/const";

/** Last band: a dimmed duotone art ground behind the closing headline and the one download action. */
export const ClosingCta = () => (
  <section className="relative isolate overflow-hidden border-b border-line-strong px-5.5 py-26 md:px-11">
    <Image src={CARD_ART_URL(19652159)} alt="" fill sizes="100vw" className="-z-10 object-cover grayscale contrast-130 brightness-[.42]" />
    <span aria-hidden className="-z-10 duotone-wash bg-gold" />
    <span aria-hidden className="absolute inset-0 -z-10 bg-surface-000 opacity-55" />
    <div className="max-w-260">
      <Image src="/logo.png" alt="" width={52} height={52} className="size-13" />
      <h2 className="mt-6.5 font-display text-[clamp(34px,5.4vw,84px)] leading-[.88] tracking-[-.012em] text-ink uppercase">
        Free automatic Yu-Gi-Oh! simulator. Ranked, scripted, judged by the <span className="text-gold">engine</span>.
      </h2>
      <div className="mt-10 flex flex-wrap items-center gap-6.5">
        <Button size="lg" shadow href={DOWNLOAD_URL} className="min-h-16 px-10.5">Download free</Button>
        <p className="font-mono text-[11px] tracking-[.08em] text-ink uppercase">No credit card.<br />Install takes under 2 minutes.</p>
      </div>
      <p className="mt-8.5 text-ink-dim signal-nav tracking-[.16em]">Windows / macOS / Linux / Android</p>
    </div>
  </section>
)
