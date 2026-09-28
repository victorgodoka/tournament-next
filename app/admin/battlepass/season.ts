import type { ChipTone } from '@ui/index'
import { count, fromBrt } from '@utils/format'
import type { BattlepassSeason, XpSource } from '@utils/panel'

export const passState = (s: BattlepassSeason, now: number): { label: string; tone: ChipTone; running: boolean } => {
  if (!s.active) return { label: 'Hidden', tone: 'neutral', running: false }
  if (Date.parse(s.startsAt) > now) return { label: 'Active · upcoming', tone: 'indigo', running: false }
  if (Date.parse(s.endsAt) < now) return { label: 'Active · ended', tone: 'gold', running: false }
  return { label: 'Active · running', tone: 'cyan', running: true }
}

export const premiumLabel = (s: BattlepassSeason) =>
  [s.premiumOmegaPass && 'Omega pass', s.premiumPrice !== null && `${count(s.premiumPrice)} DP`].filter(Boolean).join(' or ') || 'Not available'

/** `<input type="datetime-local">` value read as BRT. */
export const brtLocal = (value: string) => fromBrt(value.slice(0, 10), value.slice(11, 16))

export const XP_SOURCES: { key: XpSource; label: string }[] = [
  { key: 'ranked_win', label: 'Ranked win' },
  { key: 'ranked_loss', label: 'Ranked loss' },
  { key: 'ranked_draw', label: 'Ranked draw' },
  { key: 'tournament_entry', label: 'Tournament entry' },
  { key: 'tournament_match_win', label: 'Tournament match win' },
  { key: 'daily_login', label: 'Daily login' },
]
