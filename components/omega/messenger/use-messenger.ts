'use client'

import { useCallback, useEffect, useMemo, useState } from "react";
import { messenger, MessengerApiError, msSinceLastRequest, sortRoster } from "@utils/messenger";
import type {
  BlockedDuelist,
  ChatMessage,
  ChatSummary,
  ChosenPresence,
  Identity,
  Panel,
  PresenceEvent,
  Relation,
  Requests,
  RosterEntry,
} from "@utils/types";

const HEARTBEAT_MS = 60_000

/**
 * The whole messenger for one mounted surface (the gadget or /messenger): first paint from
 * `GET /messenger`, then kept true by the event stream. Opening the stream is what makes the
 * viewer visible, so mount it once per page.
 */
export const useMessenger = () => {
  /** `undefined` while loading, `null` when signed out. */
  const [panel, setPanel] = useState<Panel | null | undefined>(undefined)
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const [requests, setRequests] = useState<Requests | null>(null)
  const [blocks, setBlocks] = useState<BlockedDuelist[] | null>(null)

  const fail = useCallback((error: unknown) => {
    if (error instanceof MessengerApiError && error.status === 401) setPanel(null)
    else console.error(error)
  }, [])

  const loadPanel = useCallback(() => messenger.panel().then(setPanel).catch(fail), [fail])
  const loadChats = useCallback(() => messenger.chats().then(setChats).catch(fail), [fail])
  const loadRequests = useCallback(() => messenger.requests().then(setRequests).catch(fail), [fail])
  const loadBlocks = useCallback(() => messenger.blocks().then(setBlocks).catch(fail), [fail])

  const signedIn = !!panel

  useEffect(() => {
    let stream: EventSource | undefined
    let cancelled = false

    messenger.panel().then((first) => {
      if (cancelled) return
      setPanel(first)

      stream = new EventSource(messenger.streamUrl, { withCredentials: true })
      let opened = false
      // Deltas sent while disconnected are lost, so a reconnect starts from a fresh panel.
      stream.addEventListener('open', () => {
        if (opened) loadPanel()
        opened = true
      })
      stream.addEventListener('error', () => {
        if (stream?.readyState === EventSource.CLOSED) setPanel(null)
      })
      stream.addEventListener('presence', (event) => {
        const { id, presence, status, song }: PresenceEvent = JSON.parse(event.data)
        setPanel((current) => current && current.roster.some((entry) => entry.id === id)
          ? { ...current, roster: sortRoster(current.roster.map((entry) => entry.id === id ? { ...entry, presence, status, song } : entry)) }
          : current)
      })
      stream.addEventListener('request', (event) => {
        const from: Identity = JSON.parse(event.data)
        setPanel((current) => current && { ...current, incomingRequests: current.incomingRequests + 1 })
        setRequests((current) => current && {
          ...current,
          incoming: [{ ...from, requestedAt: new Date().toISOString() }, ...current.incoming.filter((request) => request.id !== from.id)],
        })
      })
      stream.addEventListener('relation', (event) => {
        const { id }: { id: string } = JSON.parse(event.data)
        setRequests((current) => current && {
          incoming: current.incoming.filter((request) => request.id !== id),
          outgoing: current.outgoing.filter((request) => request.id !== id),
        })
        // Linked needs their roster entry, and none may change the request count: both refetch.
        loadPanel()
      })
    }).catch((error) => !cancelled && fail(error))

    return () => {
      cancelled = true
      stream?.close()
    }
  }, [fail, loadPanel])

  // Scrolling and client-side navigation make no request, so real interaction sends a heartbeat.
  useEffect(() => {
    if (!signedIn) return
    const beat = () => msSinceLastRequest() > HEARTBEAT_MS && messenger.activity().catch(() => {})
    const events = ['pointerdown', 'keydown', 'focus'] as const
    events.forEach((name) => window.addEventListener(name, beat))
    return () => events.forEach((name) => window.removeEventListener(name, beat))
  }, [signedIn])

  /** Safe to apply before the response. On failure the panel refetches instead of guessing a rollback. */
  const optimistic = useCallback((apply: (panel: Panel) => Panel, request: Promise<unknown>) => {
    setPanel((current) => current && apply(current))
    return request.catch((error) => {
      fail(error)
      loadPanel()
    })
  }, [fail, loadPanel])

  const actions = useMemo(() => {
    const patchContact = (id: string, patch: Partial<RosterEntry>) => (current: Panel) => ({
      ...current,
      roster: current.roster.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    })
    const dropContact = (id: string) => (current: Panel) => ({
      ...current,
      roster: current.roster.filter((entry) => entry.id !== id),
    })
    const dropRequest = (id: string) => setRequests((current) => current && {
      incoming: current.incoming.filter((request) => request.id !== id),
      outgoing: current.outgoing.filter((request) => request.id !== id),
    })

    return {
      setPresence: (presence: ChosenPresence) =>
        optimistic((current) => ({ ...current, me: { ...current.me, presence } }), messenger.setPresence(presence)),
      setStatus: (text: string) => {
        const status = text.trim() || null
        return optimistic((current) => ({ ...current, me: { ...current.me, status } }), messenger.setStatus(status))
      },
      /** Waits for the title lookup: render the song the server saved. Throws on a rejected link. */
      setSong: async (url: string | null) => {
        const { song } = await messenger.setSong(url)
        setPanel((current) => current && { ...current, me: { ...current.me, song } })
      },
      setKind: (id: string, kind: Relation) => optimistic(patchContact(id, { kind }), messenger.setKind(id, kind)),
      setNickname: (id: string, text: string) => {
        const nickname = text.trim() || null
        return optimistic(patchContact(id, { nickname }), messenger.setNickname(id, nickname))
      },
      setNote: (id: string, text: string) => {
        const note = text.trim() || null
        return optimistic(patchContact(id, { note }), messenger.setNote(id, note))
      },
      remove: (id: string) => optimistic(dropContact(id), messenger.remove(id)),
      block: (id: string) => {
        dropRequest(id)
        setChats((current) => current && current.filter((chat) => chat.id !== id))
        return optimistic(dropContact(id), messenger.block(id))
      },
      unblock: (id: string) => {
        setBlocks((current) => current && current.filter((blocked) => blocked.id !== id))
        return messenger.unblock(id).catch(fail)
      },

      /** Not optimistic: accepting needs the new roster entry. A 404 means they just cancelled. */
      accept: async (id: string, kind: Relation) => {
        try {
          await messenger.accept(id, kind)
        } catch (error) {
          if (!(error instanceof MessengerApiError && error.status === 404)) return fail(error)
        }
        dropRequest(id)
        loadPanel()
      },
      decline: (id: string) => {
        dropRequest(id)
        return optimistic((current) => ({ ...current, incomingRequests: Math.max(0, current.incomingRequests - 1) }), messenger.remove(id))
      },
      cancel: (id: string) => {
        dropRequest(id)
        return messenger.remove(id).catch(fail)
      },
      setRequestKind: (id: string, kind: Relation) => {
        setRequests((current) => current && {
          ...current,
          outgoing: current.outgoing.map((request) => (request.id === id ? { ...request, kind } : request)),
        })
        return messenger.setKind(id, kind).catch(fail)
      },

      /** The first page of a conversation marks it read on the server. */
      markRead: (id: string) =>
        setChats((current) => current && current.map((chat) => (chat.id === id ? { ...chat, unread: 0 } : chat))),
      /** Moves the conversation to the top of the list with the sent message as its preview. */
      sent: (contact: Identity & { nickname: string | null }, message: ChatMessage) =>
        setChats((current) => current && [
          { ...(current.find((chat) => chat.id === contact.id) ?? { ...contact, unread: 0 }), lastMessage: message },
          ...current.filter((chat) => chat.id !== contact.id),
        ]),
    }
  }, [fail, loadPanel, optimistic])

  /** Once the chat list is loaded it is fresher than the panel's count. */
  const unreadChats = chats ? chats.filter((chat) => chat.unread > 0).length : panel?.unreadChats ?? 0

  return { panel, chats, requests, blocks, unreadChats, loadChats, loadRequests, loadBlocks, ...actions }
}

export type Messenger = ReturnType<typeof useMessenger>
