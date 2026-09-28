import { count, reais } from '@utils/format'
import type { ScheduledTournament } from '@utils/panel'

export const MODES = ['Single', 'Match', 'Tag']
export const SYSTEMS = ['Swiss', 'Single elimination']
/** Short form for dense tables. */
export const SYSTEMS_SHORT = ['Swiss', 'Single elim.']

type Params = Pick<
  ScheduledTournament,
  | 'banlistId' | 'banlistName' | 'mode' | 'masterRule' | 'region' | 'timer' | 'drawCount' | 'startHand' | 'startLp'
  | 'duelRule' | 'relFrom' | 'relUntil' | 'extraRules' | 'budgetCents' | 'requiresPass' | 'rewardTp' | 'tournyMode'
>

/** `extraRules` is a uint64 string: bits read with BigInt, never Number. */
export const bitsOf = (value: string) => {
  let mask: bigint
  try {
    mask = BigInt(value.trim() || '0')
  } catch {
    return null
  }
  // BigInt() rather than `0n` literals: the compile target is ES2017.
  const zero = BigInt(0)
  const one = BigInt(1)
  if (mask < zero) return null
  const bits: number[] = []
  for (let bit = 0; mask > zero; bit++, mask >>= one) if (mask & one) bits.push(bit)
  return bits
}

/** "Bit 46", "Bits 34, 36", "Bits 19–21, 23–26, 37" — runs collapse. */
export const bitsLabel = (bits: number[] | null) => {
  if (!bits) return 'Invalid'
  if (bits.length === 0) return 'None'
  const runs: string[] = []
  for (let i = 0; i < bits.length; ) {
    let j = i
    while (j + 1 < bits.length && bits[j + 1] === bits[j]! + 1) j++
    runs.push(j - i >= 2 ? `${bits[i]}–${bits[j]}` : bits.slice(i, j + 1).join(', '))
    i = j + 1
  }
  return `${bits.length === 1 ? 'Bit' : 'Bits'} ${runs.join(', ')}`
}

export const poolLabel = (from: string | null, until: string | null) =>
  from && until ? `${from} → ${until}` : until ? `Until ${until}` : from ? `From ${from}` : 'Any date'

export const rulesLabel = (t: Pick<Params, 'requiresPass' | 'rewardTp'>) =>
  [t.requiresPass && 'Pass', t.rewardTp && 'TP'].filter(Boolean).join(' · ') || '—'

/** The 16 `createtourny` arguments, in the command's order, for display. The server builds the real command. */
export const commandOrder = (t: Params) => [
  { label: 'Banlist', value: String(t.banlistId) },
  { label: 'Mode', value: MODES[t.mode] ?? String(t.mode) },
  { label: 'Master rule', value: `MR${t.masterRule}` },
  { label: 'Region', value: String(t.region) },
  { label: 'Timer', value: String(t.timer) },
  { label: 'Draw count', value: String(t.drawCount) },
  { label: 'Start hand', value: String(t.startHand) },
  { label: 'Start LP', value: String(t.startLp) },
  { label: 'Duel rule', value: String(t.duelRule) },
  { label: 'Released from', value: t.relFrom ?? 'Any' },
  { label: 'Released until', value: t.relUntil ?? 'Any' },
  { label: 'Extra rules', value: bitsLabel(bitsOf(t.extraRules)) },
  { label: 'Budget', value: String(t.budgetCents) },
  { label: 'Requires pass', value: t.requiresPass ? 'Yes' : 'No' },
  { label: 'Reward TP', value: t.rewardTp ? 'Yes' : 'No' },
  { label: 'System', value: SYSTEMS[t.tournyMode] ?? String(t.tournyMode) },
]

/** The same 16, read by a person: units and names. */
export const paramFacts = (t: Params) => [
  { label: 'Banlist', value: `${t.banlistName ?? '—'} · #${t.banlistId}` },
  { label: 'Mode', value: MODES[t.mode] ?? String(t.mode) },
  { label: 'Master rule', value: `MR${t.masterRule}` },
  { label: 'Region', value: String(t.region) },
  { label: 'Timer', value: `${t.timer} s` },
  { label: 'Draw count', value: String(t.drawCount) },
  { label: 'Start hand', value: String(t.startHand) },
  { label: 'Start LP', value: count(t.startLp) },
  { label: 'Duel rule', value: String(t.duelRule) },
  { label: 'Released from', value: t.relFrom ?? 'Any date' },
  { label: 'Released until', value: t.relUntil ?? 'Any date' },
  { label: 'Extra rules', value: bitsLabel(bitsOf(t.extraRules)) },
  { label: 'Budget', value: reais(t.budgetCents) },
  { label: 'Requires pass', value: t.requiresPass ? 'Yes' : 'No' },
  { label: 'Reward TP', value: t.rewardTp ? 'Yes' : 'No' },
  { label: 'System', value: SYSTEMS[t.tournyMode] ?? String(t.tournyMode) },
]
