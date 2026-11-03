import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import type { Cosmetics } from '@utils/types'
import { Avatar, type Status } from '@ui/avatar'
import { StatGrid, type Stat } from '@ui/stat-grid'

/** surface-100 with a faint cyan haze in the notched corner, for a profile with no cover. */
const PROFILE_FILL = {
  '--fill': 'radial-gradient(ellipse 45% 140% at 100% 0%, rgba(0, 253, 255, 0.07), rgba(0, 0, 0, 0) 70%), var(--color-surface-100)',
} as React.CSSProperties

/** The API sends the cover untransformed: Cloudinary resizes it on the way out. */
const sizedCover = (url: string) => url.replace('/image/upload/', '/image/upload/c_limit,w_2560,f_auto,q_auto/')

type ProfileHeaderProps = {
  /** The API's `displayName`. `null` reads "Unknown duelist". */
  name: string | null
  handle?: string | null
  avatar?: string | null
  cosmetics?: Cosmetics | null
  status?: Status
  /** VIP cover image. The avatar then overlaps its bottom-left corner. */
  cover?: string | null
  /** Short mono facts over the name: last seen, "Your profile". */
  meta?: React.ReactNode[]
  /** Chips after the handle: VIP, region, pass. Only what's true. */
  badges?: React.ReactNode
  /** One primary: Edit profile on your own page, the relation action on someone else's. */
  actions?: React.ReactNode
  /** Leave out on a private profile. */
  stats?: Stat[]
  /** Shorter figures for phones (two columns, no hints). Defaults to `stats`. */
  mobileStats?: Stat[]
  className?: string
}

const Facts = ({ facts }: { facts: React.ReactNode[] }) =>
  facts.length ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] leading-3 tracking-[0.14em] text-ink-muted uppercase">
      {facts.map((fact, i) => (
        <span key={i} className="flex items-center gap-4">
          {i ? <span aria-hidden className="size-1 bg-line-mid" /> : null}
          {fact}
        </span>
      ))}
    </div>
  ) : null

/**
 * The top of a duelist's page. Without a cover: square avatar, facts, Anton name, handle and chips,
 * actions, StatGrid. With one (VIP): the cover on top and the avatar lifted onto its edge.
 */
export const ProfileHeader = ({ name, handle, avatar, cosmetics, status, cover, meta, badges, actions, stats, mobileStats, className }: ProfileHeaderProps) => {
  const facts = (meta ?? []).filter(Boolean)
  const label = name ?? 'Unknown duelist'

  return (
    <section
      aria-label={`${name ?? 'Duelist'} profile`}
      style={cover ? undefined : PROFILE_FILL}
      // Phones: full bleed, square, a hairline above and below; the notch from 768px.
      className={twMerge('cut notch [--cut:var(--cut-lg)] max-md:-mx-4 max-md:[--cut:0px] max-md:[--edge:var(--color-line)]', className)}
    >
      {cover ? (
        <div
          role="img"
          aria-label={`Cover image chosen by ${label}`}
          className="relative h-37.5 overflow-hidden bg-[#0a1430] md:mx-px md:mt-px md:h-75 md:[clip-path:polygon(0_0,calc(100%-15px)_0,100%_15px,100%_100%,0_100%)]"
        >
          <Image src={sizedCover(cover)} alt="" fill unoptimized priority className="object-cover object-center" />
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,18,34,0)_45%,rgba(14,18,34,0.95)_100%)]" />
        </div>
      ) : null}

      {/* Phone: avatar and chips on one line, then the name; the actions split the width. */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-4 md:hidden">
        <div className={twMerge('flex items-end gap-3', cover && '-mt-15')}>
          <span className={twMerge(cover && 'relative bg-surface-100 p-0.75')}>
            <Avatar name={label} src={avatar} cosmetics={cosmetics} size="lg" status={status} eager />
          </span>
          {badges ? <span className="flex flex-wrap gap-1.5 pb-1">{badges}</span> : null}
        </div>
        <Facts facts={facts} />
        <h1 className="wrap-anywhere font-display text-4xl leading-none text-ink uppercase">{label}</h1>
        {handle ? <span className="text-ink-dim data">{handle}</span> : null}
        {actions ? <div className="grid grid-cols-2 gap-3 *:w-full">{actions}</div> : null}
      </div>

      <div className={twMerge('flex flex-wrap items-center gap-6 p-6 max-md:hidden', cover && 'items-end pt-0')}>
        <span className={twMerge(cover && 'relative z-1 -mt-16 bg-surface-100 p-1')}>
          <Avatar name={label} src={avatar} cosmetics={cosmetics} size="xl" status={status} eager />
        </span>
        <div className={twMerge('flex min-w-60 flex-1 flex-col gap-2.5', cover && 'pt-5')}>
          <Facts facts={facts} />
          <h1 className="wrap-anywhere font-display text-5xl leading-none text-ink uppercase">{label}</h1>
          {handle || badges ? (
            <div className="flex flex-wrap items-center gap-3">
              {handle ? <span className="text-ink-dim data">{handle}</span> : null}
              {badges ? <span className="flex flex-wrap gap-1.5">{badges}</span> : null}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex gap-3 self-end">{actions}</div> : null}
      </div>

      {stats ? (
        <>
          <StatGrid items={mobileStats ?? stats} columns={2} className="border-x-0 border-b-0 md:hidden" />
          <StatGrid items={stats} columns={stats.length} className="mx-px mb-px border-x-0 border-b-0 max-md:hidden" />
        </>
      ) : null}
    </section>
  )
}
