/**
 * Messenger endpoints on omega-server-v3 (see its MESSENGER.md).
 * Browser only: every route needs the session cookie, and the rate limit is per IP.
 */
import { API_URL } from './auth'
import type {
  BlockedDuelist,
  ChatMessage,
  ChatPage,
  ChatSummary,
  ChosenPresence,
  Panel,
  Presence,
  Relation,
  RelationStatus,
  Requests,
  RosterEntry,
  Song,
} from './types'

export class MessengerApiError extends Error {
  status: number
  /** `NOT_FOUND`, `NOT_LINKED`, `BLOCKED`... Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Messenger API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

let lastRequestAt = 0

/** Any session request counts as activity, so the heartbeat can skip a minute that already had one. */
export const msSinceLastRequest = () => Date.now() - lastRequestAt

const call = async <T = void>(method: string, path: string, body?: unknown): Promise<T> => {
  lastRequestAt = Date.now()
  const res = await fetch(`${API_URL}/messenger${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    // A JSON content-type with no body is a 400, so only send it with one.
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new MessengerApiError(res.status, error.error, error.message)
  }
  return (res.status === 204 ? undefined : res.json()) as T
}

const user = (id: string) => encodeURIComponent(id)

export const messenger = {
  streamUrl: `${API_URL}/messenger/stream`,
  panel: () => call<Panel>('GET', ''),
  activity: () => call('POST', '/activity'),
  setPresence: (presence: ChosenPresence) => call('PUT', '/me/presence', { presence }),
  setStatus: (status: string | null) => call('PUT', '/me/status', { status }),
  setSong: (url: string | null) => call<{ song: Song | null }>('PUT', '/me/song', { url }),
  requests: () => call<Requests>('GET', '/requests'),
  request: (id: string, kind: Relation) => call<RelationStatus>('PUT', `/roster/${user(id)}`, { kind }),
  accept: (id: string, kind: Relation) => call<RelationStatus>('POST', `/roster/${user(id)}/accept`, { kind }),
  setKind: (id: string, kind: Relation) => call<RelationStatus>('PATCH', `/roster/${user(id)}`, { kind }),
  setNickname: (id: string, nickname: string | null) => call('PUT', `/roster/${user(id)}/nickname`, { nickname }),
  setNote: (id: string, note: string | null) => call('PUT', `/roster/${user(id)}/note`, { note }),
  /** Cancel, decline and remove are all this one call. */
  remove: (id: string) => call('DELETE', `/roster/${user(id)}`),
  blocks: () => call<BlockedDuelist[]>('GET', '/blocks'),
  block: (id: string) => call('PUT', `/blocks/${user(id)}`),
  unblock: (id: string) => call('DELETE', `/blocks/${user(id)}`),
  chats: () => call<ChatSummary[]>('GET', '/chats'),
  /** The first page (no cursor) also marks the conversation read. */
  messages: (id: string, cursor?: string | null) =>
    call<ChatPage>('GET', `/chats/${user(id)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  send: (id: string, body: string) => call<ChatMessage>('POST', `/chats/${user(id)}`, { body }),
}

export const STATUS_MAX = 70
export const NICKNAME_MAX = 32
export const NOTE_MAX = 200
export const MESSAGE_MAX = 1000

type Named = { nickname?: string | null; displayName: string | null; username: string | null }

export const contactName = (entry: Named) => entry.nickname || entry.displayName || entry.username || 'Duelist'
export const contactHandle = (entry: { username: string | null }) => (entry.username ? `@${entry.username}` : '')

const PRESENCE_ORDER: Record<Presence, number> = { ready: 0, online: 1, busy: 2, away: 3, offline: 4 }

/** The server's own order: presence, then name. Re-apply after a presence change. */
export const sortRoster = (roster: RosterEntry[]) =>
  [...roster].sort((a, b) =>
    PRESENCE_ORDER[a.presence] - PRESENCE_ORDER[b.presence] || contactName(a).localeCompare(contactName(b)))

/** Oldest first, deduped by id: pages and refreshes can overlap. */
export const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0))
}

/** `20:41` today, `Wed 20:41` this week, a date otherwise. */
export const messageTime = (iso: string, now = Date.now()) => {
  const date = new Date(iso)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (new Date(now).toDateString() === date.toDateString()) return time
  if (now - date.getTime() < 6 * 86_400_000) return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}
