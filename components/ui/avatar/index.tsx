import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import type { Cosmetics, Presence as Status } from '@utils/types'

/** Presence as the messenger API reports it. The server computes it; never derive it on the client. */
export type { Status }

const STATUS_LABEL: Record<Status, string> = { ready: 'Ready to Duel', online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline' }

/** Away is a crescent and busy a barred dot, so the state never rides on color alone. */
const DOT: Record<Status, string> = {
  ready: 'bg-presence-ready shadow-[0_0_6px_color-mix(in_srgb,var(--color-presence-ready)_70%,transparent)]',
  online: 'bg-presence-online',
  away: '[background:radial-gradient(circle_at_28%_28%,var(--color-space-000)_0_3px,var(--color-presence-away)_3.5px)]',
  busy: '[background:linear-gradient(var(--color-space-000),var(--color-space-000))_center/6px_2px_no-repeat,var(--color-presence-busy)]',
  offline: 'bg-surface-300 shadow-[inset_0_0_0_2px_var(--color-presence-offline)]',
}

type PresenceProps = {
  status: Status
  /** Adds the mono word after the dot. */
  showLabel?: boolean
  /** Replaces the status word, shown or read out: "Appear offline". */
  label?: string
  className?: string
}

/** Presence as a round dot: ready cyan with a glow, online azure, away a gold crescent, busy barred crimson, offline hollow. */
export const Presence = ({ status, showLabel, label, className }: PresenceProps) =>
  showLabel ? (
    <span className={twMerge('inline-flex items-center gap-2 whitespace-nowrap text-ink-dim signal-sm', className)}>
      <span aria-hidden className={twMerge('size-2.5 shrink-0 rounded-round', DOT[status])} />
      {label ?? STATUS_LABEL[status]}
    </span>
  ) : (
    <span
      role="img"
      aria-label={label ?? STATUS_LABEL[status]}
      className={twMerge('inline-block size-2.5 box-content rounded-round border-2 border-space-000', DOT[status], className)}
    />
  )

const SIZE = {
  sm: { box: 'size-7 text-xs', px: 28 },
  md: { box: 'size-10 text-base', px: 40 },
  lg: { box: 'size-16 text-2xl', px: 64 },
  xl: { box: 'size-32 text-[52px]', px: 128 },
}

const initialsOf = (name: string) =>
  name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

type AvatarProps = {
  name: string
  src?: string | null
  /** sm 28 · md 40 · lg 64 · xl 128 */
  size?: keyof typeof SIZE
  status?: Status | null
  /** Equipped cosmetics from the API; the `WEBDECO` frame is drawn over the portrait. */
  cosmetics?: Cosmetics | null
  /** Above the fold and likely the LCP, like a profile's header portrait. */
  eager?: boolean
  className?: string
}

/** The equipped `WEBDECO` frame over a `relative` portrait box. Nothing when none is equipped. */
export const AvatarFrame = ({ cosmetics }: { cosmetics?: Cosmetics | null }) => {
  const frame = cosmetics?.WEBDECO?.assetUrl
  // ponytail: fixed 12% bleed around the portrait; read geometry from `data` if frames ever need it.
  // Small shop asset: skips Next's optimiser.
  return frame ? <Image src={frame} alt="" fill unoptimized className="pointer-events-none -inset-[12%]! size-[124%]! max-w-none border-0! object-contain!" /> : null
}

/** Square portrait on a hairline edge, shown as uploaded. No image: Anton initials on azure. */
export const Avatar = ({ name, src, size = 'md', status, cosmetics, eager, className }: AvatarProps) => (
  <span className={twMerge('relative inline-block shrink-0', SIZE[size].box, className)}>
    {src ? (
      <Image src={src} alt={name} fill sizes={`${SIZE[size].px}px`} loading={eager ? 'eager' : undefined} className="border border-line-mid object-cover" />
    ) : (
      <span role="img" aria-label={name} className="grid size-full place-items-center border border-line-mid bg-azure font-display leading-none text-ink">
        {initialsOf(name)}
      </span>
    )}
    <AvatarFrame cosmetics={cosmetics} />
    {status ? <Presence status={status} className="absolute -right-0.75 -bottom-0.75" /> : null}
  </span>
)
