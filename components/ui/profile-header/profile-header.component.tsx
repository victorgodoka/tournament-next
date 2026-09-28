import { twMerge } from 'tailwind-merge'
import type { Cosmetics, Tier } from '@utils/types'
import { Avatar, type Status } from '@ui/avatar'
import { StatGrid, type Stat } from '@ui/stat-grid'
import { TierBadge } from '@ui/tier-badge'

/** surface-100 with a faint cyan haze in the notched corner; profiles have no cover image. */
export const PROFILE_FILL = {
  '--fill': 'radial-gradient(ellipse 45% 140% at 100% 0%, rgba(0, 253, 255, 0.07), rgba(0, 0, 0, 0) 70%), var(--color-surface-100)',
} as React.CSSProperties

type ProfileHeaderProps = {
  /** The API's `displayName`. `null` reads "Unknown duelist". */
  name: string | null
  handle?: string | null
  avatar?: string | null
  cosmetics?: Cosmetics | null
  status?: Status
  tier?: Tier
  /** Short mono facts: region, last seen. */
  meta?: React.ReactNode[]
  /** Chips: vip, pass, admin. Only what's true. */
  badges?: React.ReactNode
  /** One primary: Edit profile on your own page, the relation action on someone else's. */
  actions?: React.ReactNode
  /** Leave out on a private profile. */
  stats?: Stat[]
  className?: string
}

/** The top of a duelist's page: square avatar, facts, Anton name, handle and badges, actions, StatGrid. */
export const ProfileHeader = ({ name, handle, avatar, cosmetics, status, tier, meta, badges, actions, stats, className }: ProfileHeaderProps) => {
  const facts = (meta ?? []).filter(Boolean)

  return (
    <section aria-label={`${name ?? 'Duelist'} profile`} style={PROFILE_FILL} className={twMerge('cut notch [--cut:var(--cut-lg)]', className)}>
      <div className="flex flex-wrap items-center gap-6 p-6">
        <Avatar name={name ?? '?'} src={avatar} cosmetics={cosmetics} size="xl" status={status} />
        <div className="flex min-w-60 flex-1 flex-col gap-2.5">
          {facts.length ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ink-muted signal-sm">
              {facts.map((fact, i) => (
                <span key={i} className="flex items-center gap-4">
                  {i ? <span aria-hidden className="size-1 bg-line-mid" /> : null}
                  {fact}
                </span>
              ))}
            </div>
          ) : null}
          <h1 className="wrap-anywhere text-ink display-1">{name ?? 'Unknown duelist'}</h1>
          {handle || tier || badges ? (
            <div className="flex flex-wrap items-center gap-3">
              {handle ? <span className="text-ink-dim data">{handle}</span> : null}
              {tier ? <TierBadge tier={tier} /> : null}
              {badges ? <span className="flex flex-wrap gap-1.5">{badges}</span> : null}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex gap-3 self-end">{actions}</div> : null}
      </div>
      {stats ? <StatGrid items={stats} className="mx-px mb-px border-x-0 border-b-0" /> : null}
    </section>
  )
}
