import type { ChosenPresence, Presence, Relation } from '@utils/types'

/** TabBar selection for anything that picks between the two lists: friends read positive, rivals negative. */
export const RELATION_ACTIVE: Record<Relation, string> = {
  friend: 'bg-ground-positive text-ink shadow-tab-active-positive',
  rival: 'bg-ground-negative text-ink shadow-tab-active-negative',
}

/**
 * Presence looks the same to every viewer. `short` is for roster rows, `label` for the picker.
 * Fixed colors: ready (duel) gold, online positive, busy negative, away indigo-lift, offline and
 * invisible ink-muted. Color never carries the state alone; the word always sits beside the square.
 * `invisible` only ever shows in the viewer's own picker: to others it is plain `offline`.
 */
export const PRESENCE: Record<Presence | 'invisible', { label: string; short: string; dot: string; text: string }> = {
  ready: { label: 'Ready to Duel', short: 'Ready', dot: 'bg-gold', text: 'text-gold' },
  online: { label: 'Online', short: 'Online', dot: 'bg-positive', text: 'text-positive' },
  busy: { label: 'Busy', short: 'Busy', dot: 'bg-negative', text: 'text-negative' },
  away: { label: 'Away', short: 'Away', dot: 'bg-indigo-lift', text: 'text-indigo-lift' },
  offline: { label: 'Offline', short: 'Offline', dot: 'bg-ink-muted', text: 'text-ink-muted' },
  invisible: { label: 'Appear offline', short: 'Hidden', dot: 'bg-ink-muted', text: 'text-ink-muted' },
}

/** `online`, `away` and `offline` are computed by the server and can't be picked. */
export const SELECTABLE_PRESENCE: ChosenPresence[] = ['ready', 'busy', 'invisible']
