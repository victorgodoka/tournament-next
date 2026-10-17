import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { LocalTime } from '@omega/profile/local-time'
import { TIME_ONLY, banlistLabel, formatTone } from '@omega/tournament/labels'
import { Chip } from '@ui/chip/chip.component'
import { calendarHref } from '@utils/tournaments'
import type { CalendarEntry } from '@utils/types'

const META = 'signal-sm text-ink-muted'

/** Stable key: ids repeat across sources, and the game's recurring tournaments have none. */
export const calendarKey = (entry: CalendarEntry) => `${entry.source}-${entry.id ?? entry.startsAt}`

/**
 * One calendar entry: date block, format, settings and where to sign up. The whole row links to
 * the tournament (`omega`) or its pre-registration page (`panel`); the game's recurring
 * tournaments (`scheduler`) have no page, so theirs is plain.
 */
export const CalendarRow = ({ entry }: { entry: CalendarEntry }) => {
  const t = useTranslations('Calendar')
  const tt = useTranslations('Tournaments')
  const format = useFormatter()
  const { format: name, banlist, startsAt, status } = entry
  const href = calendarHref(entry)

  const body = (
    <>
      <span className="flex flex-col items-center justify-center gap-1 border-r border-line pr-4">
        <span className="font-display text-[28px] leading-none text-ink">
          <LocalTime iso={startsAt} options={{ day: '2-digit' }} />
        </span>
        <span className={META}>
          <LocalTime iso={startsAt} options={{ month: 'short' }} />
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Chip tone={name ? formatTone(name) : 'neutral'}>{name ?? t('fallbackFormat')}</Chip>
          {banlist && banlist !== name ? <b className="truncate text-sm">{name ? banlistLabel({ banlist, format: name }) : banlist}</b> : null}
        </span>
        <span className={META}>
          <LocalTime iso={startsAt} options={TIME_ONLY} /> · {tt(`mode.short.${entry.mode}`)}
          {entry.structure ? <> · {t(`structure.${entry.structure}`)}</> : null}
          {entry.players !== null ? (
            <> · {t(entry.source === 'panel' ? 'preRegistered' : 'players', { count: entry.players })}</>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {status === 'scheduled' ? (
            <span className="text-gold signal-sm">{format.relativeTime(new Date(startsAt))}</span>
          ) : (
            <Chip tone={status === 'live' ? 'live' : 'neutral'}>{tt(`status.${status}`)}</Chip>
          )}
          {entry.requiresPass ? <Chip tone="pass">{t('pass')}</Chip> : null}
          {entry.rewardTp ? <Chip tone="gold">{t('tp')}</Chip> : null}
          {entry.registration ? <span className={META}>{t(`registration.${entry.registration}`)}</span> : null}
        </span>
      </span>
    </>
  )

  const row = 'grid grid-cols-[52px_minmax(0,1fr)] gap-4 bg-surface-100 px-4 py-3.5'
  return (
    <li className={href ? 'flex' : undefined}>
      {href ? (
        <Link href={href} className={`${row} w-full transition-colors hover:bg-surface-200 focus-visible:bg-surface-200`}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  )
}
