import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AvatarFrame } from '@ui/avatar'
import type { TournamentPlayer } from '@utils/types'

/**
 * `name` is `null` when the game has no Discord data for the duelist, and empty for a few rows
 * the game stored blank — both have to fall back, or the cell renders as nothing at all.
 */
export const playerName = (player: TournamentPlayer | undefined, fallback = 'Unknown duelist') =>
  player?.name?.trim() || fallback

type AvatarProps = { player: TournamentPlayer | undefined; size?: number; className?: string }

/** Square portrait, or the initial on a plate when Discord has no picture, under the equipped frame. Decorative: the name carries it. */
export const PlayerAvatar = ({ player, size = 28, className }: AvatarProps) => {
  const box = { width: size, height: size }

  return (
    <span aria-hidden style={box} className={twMerge('relative inline-flex shrink-0', className)}>
      {player?.avatar ? (
        <Image src={player.avatar} alt="" width={size} height={size} style={box} className="border border-line-mid object-cover" />
      ) : (
        <span className="inline-flex size-full items-center justify-center border border-line-mid bg-azure font-display text-xs leading-none text-ink uppercase">
          {player?.name?.trim() ? player.name.trim().slice(0, 1) : '?'}
        </span>
      )}
      <AvatarFrame cosmetics={player?.cosmetics} />
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
export const PlayerCell = ({ player, note, size, className }: PlayerCellProps) => {
  const t = useTranslations('Tournaments.player')
  return (
  <span className={twMerge('flex min-w-0 items-center gap-2.5', className)}>
    <PlayerAvatar player={player} size={size} />
    <span className="min-w-0">
      {player ? (
        <Link
          href={`/profile/${player.id}`}
          className={twMerge('block truncate body-strong hover:text-cyan', player.name?.trim() ? 'text-ink' : 'text-ink-muted')}
        >
          {playerName(player, t('unknown'))}
        </Link>
      ) : (
        <span className="block truncate text-ink-muted body-strong">{t('unknown')}</span>
      )}
      {note ? <span className="block truncate text-ink-muted signal">{note}</span> : null}
    </span>
  </span>
  )
}
