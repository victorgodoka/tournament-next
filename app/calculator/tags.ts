import type { IconName } from '@ui/icon'
import { subjectCopies } from '@utils/combo/atoms'
import type { DeckCard } from '@utils/combo/deck-cards'
import { normalizeRole, sameRole } from '@utils/combo/roles'
import { DEFAULT_ROLES, type Hand, type Roles, type Rule } from '@utils/combo/types'

/** `tone` is a CSS colour; `suggest` the rule a new tag proposes; `slug` the key under `Calculator.tags.desc` (`null` for a custom tag). */
export type TagMeta = { icon: IconName; tone: string; suggest: 'need' | 'avoid' | null; slug: string | null }

const CUSTOM: TagMeta = { icon: 'tag', tone: 'var(--color-ink-muted)', suggest: 'need', slug: null }

/** The default roles' look, in `DEFAULT_ROLES` order. */
const DEFAULTS: Record<string, TagMeta> = {
  Starter: { icon: 'play', tone: 'var(--color-win)', suggest: 'need', slug: 'starter' },
  Extender: { icon: 'extend', tone: 'var(--color-series-1)', suggest: null, slug: 'extender' },
  'Hand Trap': { icon: 'hand', tone: 'var(--color-series-2)', suggest: null, slug: 'handTrap' },
  'Board Breaker': { icon: 'burst', tone: 'var(--color-series-3)', suggest: null, slug: 'boardBreaker' },
  Brick: { icon: 'brick', tone: 'var(--color-loss)', suggest: 'avoid', slug: 'brick' },
  'Non-Engine': { icon: 'ring', tone: 'var(--color-series-4)', suggest: null, slug: 'nonEngine' },
  Searcher: { icon: 'search', tone: 'var(--color-series-5)', suggest: null, slug: 'searcher' },
  'Needs Normal Summon': { icon: 'summon', tone: 'var(--color-series-6)', suggest: null, slug: 'needsNormalSummon' },
}

/** The default's meta for any spelling of its name, else the custom tag's. */
export const tagMeta = (role: string): TagMeta => {
  const name = DEFAULT_ROLES.find((d) => sameRole(d, role))
  return (name === undefined ? undefined : DEFAULTS[name]) ?? CUSTOM
}

/** The rule a tag proposes in a playable hand: `need` is at least one, `avoid` is none; `null` when it proposes nothing. */
export const suggestedRule = (role: string): Rule | null => {
  const name = normalizeRole(role)
  const { suggest } = tagMeta(role)
  if (name === null || suggest === null) return null
  return { subject: { kind: 'role', role: name }, min: suggest === 'need' ? 1 : 0, max: suggest === 'need' ? null : 0 }
}

/** `palette` split into the roles some rule of some hand names (`used`) and the rest (`labels`), each in palette order. */
export const tagGroups = (palette: readonly string[], hands: readonly Hand[]): { used: string[]; labels: string[] } => {
  const named = hands.flatMap((hand) => hand.rules.flatMap((rule) => (rule.subject.kind === 'role' ? [rule.subject.role] : [])))
  const used = palette.filter((role) => named.some((n) => sameRole(n, role)))
  return { used, labels: palette.filter((role) => !used.includes(role)) }
}

/** Cards in the deck (rows with a copy) that carry no role. */
export const untaggedCount = (rows: readonly DeckCard[], roles: Roles): number => rows.filter((row) => row.copies > 0 && !roles.get(row.id)?.length).length

/** Copies in the deck carrying `role` (any spelling). */
export const roleCopies = (rows: readonly DeckCard[], roles: Roles, role: string): number => subjectCopies(rows, roles, { kind: 'role', role })
