import type { CardMap, Deck } from '@utils/deck/types'
import { canonicalOf } from './deck-cards'
import { DEFAULT_ROLES, LIMITS, type Roles } from './types'

/** Trimmed, inner whitespace collapsed, a default role in its own spelling; `null` when empty or over 24 characters. */
export const normalizeRole = (raw: string): string | null => {
  const role = raw.trim().replace(/\s+/g, ' ')
  if (role.length < 1 || role.length > LIMITS.roleLength) return null
  return DEFAULT_ROLES.find((d) => d.toLowerCase() === role.toLowerCase()) ?? role
}

export const sameRole = (a: string, b: string): boolean => (normalizeRole(a) ?? '').toLowerCase() === (normalizeRole(b) ?? '').toLowerCase()

/** `list` plus `role` unless a spelling of it is there already; capped at 8. */
const union = (list: readonly string[], role: string): readonly string[] => {
  const clean = normalizeRole(role)
  if (clean === null || list.some((r) => sameRole(r, clean)) || list.length >= LIMITS.rolesPerCard) return list
  return [...list, clean]
}

/** A saved deck's `tags` (passcode → labels) as roles by canonical id; labels under two prints merge. */
export const rolesFromTags = (tags: Record<string, string[]>, cards: CardMap): Roles => {
  const roles = new Map<number, readonly string[]>()
  for (const [key, labels] of Object.entries(tags)) {
    const id = canonicalOf(Number(key), cards)
    roles.set(id, labels.reduce(union, roles.get(id) ?? []))
  }
  for (const [id, list] of roles) if (!list.length) roles.delete(id)
  return roles
}

/** Roles as the deck's `tags`: each card keyed by its first print in the deck (the server wants a passcode it holds). */
export const tagsFromRoles = (roles: Roles, deck: Deck, cards: CardMap): Record<string, string[]> => {
  const tags: Record<string, string[]> = {}
  const prints = [...deck.main, ...deck.extra, ...deck.side]
  for (const [id, list] of roles) {
    if (!list.length) continue
    const passcode = prints.find((p) => canonicalOf(p, cards) === id)
    if (passcode !== undefined) tags[String(passcode)] = [...list]
  }
  return tags
}

const replace = (roles: Roles, id: number, list: readonly string[]): Roles => {
  const next = new Map(roles)
  if (list.length) next.set(id, list)
  else next.delete(id)
  return next
}

/** Adds `role` to the card unless it has it (any spelling); the same map back when nothing changes. */
export const addRole = (roles: Roles, id: number, role: string): Roles => {
  const list = roles.get(id) ?? []
  const next = union(list, role)
  return next === list ? roles : replace(roles, id, next)
}

/** Removes `role` (any spelling) when the card has it; the same map back when it does not. */
export const removeRole = (roles: Roles, id: number, role: string): Roles => {
  const list = roles.get(id) ?? []
  return list.some((r) => sameRole(r, role)) ? replace(roles, id, list.filter((r) => !sameRole(r, role))) : roles
}

/** Removes `role` (any spelling) when the card has it, else adds it; the same map back when nothing changes. */
export const toggleRole = (roles: Roles, id: number, role: string): Roles => {
  const removed = removeRole(roles, id, role)
  return removed === roles ? addRole(roles, id, role) : removed
}

/** The default roles, then every other role in use, sorted. */
export const palette = (roles: Roles): string[] => {
  const out = [...DEFAULT_ROLES]
  const extra = new Set<string>()
  for (const list of roles.values()) for (const role of list) if (!out.some((r) => sameRole(r, role)) && ![...extra].some((r) => sameRole(r, role))) extra.add(role)
  return [...out, ...[...extra].sort((a, b) => a.localeCompare(b))]
}
