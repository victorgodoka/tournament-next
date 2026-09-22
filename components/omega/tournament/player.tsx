import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import type { TournamentPlayer } from '@utils/types'

/**
 * `name` is `null` when the game has no Discord data for the duelist, and empty for a few rows
 * the game stored blank — both have to fall back, or the cell renders as nothing at all.
 */
export const playerName = (player: TournamentPlayer | undefined) => player?.name?.trim() || 'Unknown duelist'

type AvatarProps = { player: TournamentPlayer | undefined; size?: number; className?: string }

/** Square portrait, or the initial on a plate when Discord has no picture. Decorative: the name carries it. */
export const PlayerAvatar = ({ player, size = 28, className }: AvatarProps) => {
  const box = { width: size, height: size }

  if (player?.avatar) {
    return (
      <Image
        src={player.avatar}
        alt=""
        width={size}
        height={size}
        style={box}
        className={twMerge('shrink-0 border border-line object-cover', className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={box}
      className={twMerge('inline-flex shrink-0 items-center justify-center border border-line bg-surface-200 text-ink-dim signal-chip', className)}
    >
      {player?.name?.trim() ? player.name.trim().slice(0, 1) : '?'}
    </span>
  )
}

type PlayerCellProps = {
  player: TournamentPlayer | undefined
  /** Handle, byes, "dropped" — whatever qualifies the row. */
  note?: React.ReactNode
  size?: number
  className?: string
}

/** Avatar plus a link to the duelist's profile. An unknown duelist keeps the plate but loses the link. */
export const PlayerCell = ({ player, note, size, className }: PlayerCellProps) => (
  <span className={twMerge('flex min-w-0 items-center gap-2.5', className)}>
    <PlayerAvatar player={player} size={size} />
    <span className="min-w-0">
      {player ? (
        <Link
          href={`/profile/${player.id}`}
          className={twMerge('block truncate body-strong hover:text-gold', player.name?.trim() ? 'text-ink' : 'text-ink-muted')}
        >
          {playerName(player)}
        </Link>
      ) : (
        <span className="block truncate text-ink-muted body-strong">Unknown duelist</span>
      )}
      {note ? <span className="block truncate text-ink-muted signal">{note}</span> : null}
    </span>
  </span>
)
