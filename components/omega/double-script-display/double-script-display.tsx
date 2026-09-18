import { twMerge } from "tailwind-merge"
import { ArtTile } from "@omega/art-tile"
import { CARD_ART_URL } from "@utils/const"

interface DoubleScriptDisplayProps {
  id: number
  name: string
  effects: EffectDesc[]
  isPreErrata: boolean
}

interface EffectDesc {
  title: string
  description: string
}

const TERMS_LIB = {
  preErrata: ["Pre-errata text", "Current text"],
  difference: ["TCG text", "OCG text"]
}

const ScriptCard = ({ title, description, label, second }: EffectDesc & { label: string, second: boolean }) => (
  <div className={twMerge("px-5.5 py-9 md:px-8.5 md:py-11", second ? "bg-ground-cyan" : "border-line md:border-r")}>
    <p className={twMerge("signal tracking-[.2em]", second ? "text-cyan" : "text-gold")}>{label}</p>
    <p className="mt-4.5 font-display text-[clamp(28px,3vw,44px)] leading-[.95] text-ink uppercase">{title}</p>
    <p className="mt-4.5 text-ink-dim body leading-[1.65]">{description}</p>
  </div>
)

/** One worked example: the card's art with its name, then the two scripts side by side. */
export const DoubleScriptDisplay = ({ id, name, effects, isPreErrata }: DoubleScriptDisplayProps) => {
  const labels = TERMS_LIB[isPreErrata ? "preErrata" : "difference"]
  return (
    <li className="grid grid-cols-1 border-t border-line md:grid-cols-2 xl:grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative min-h-75 border-line max-xl:col-span-full max-xl:border-b xl:border-r">
        <ArtTile wash="indigo" src={CARD_ART_URL(id)} alt={`${name} card artwork`} width={640} height={640} sizes="(min-width: 1280px) 320px, 100vw" className="absolute inset-0" />
        <span aria-hidden className="absolute inset-0 bg-surface-000 opacity-35" />
        <div className="absolute bottom-0 left-0 px-6 py-5.5">
          <h3 className="font-display text-3xl text-ink uppercase">{name}</h3>
          <p className="mt-1.5 text-gold signal">Worked example</p>
        </div>
      </div>
      {effects.map((effect, i) => (
        <ScriptCard key={effect.title} {...effect} label={labels[i] ?? ""} second={i === 1} />
      ))}
    </li>
  )
}
