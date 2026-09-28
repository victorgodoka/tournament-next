'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@hooks/index";
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
const CHAT_REFRESH_MS = 30_000
/** How long a tab may sit hidden before its event stream is dropped. */
const HIDDEN_CLOSE_MS = 5 * 60_000

let audioContext: AudioContext | null = null

const isNewerMessage = (next: ChatMessage, previous: ChatMessage) => {
  try {
    return BigInt(next.id) > BigInt(previous.id)
  } catch {
    return next.id !== previous.id
  }
}

const hasNewIncomingMessage = (previous: ChatSummary[] | null, next: ChatSummary[]) => {
  if (!previous) return false

  const previousById = new Map(previous.map((chat) => [chat.id, chat]))
  return next.some((chat) => {
    if (chat.lastMessage.mine) return false

    const old = previousById.get(chat.id)
    return old ? isNewerMessage(chat.lastMessage, old.lastMessage) : chat.unread > 0
  })
}

const playMessageSound = () => {
  if (typeof window === 'undefined') return

  const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  audioContext ??= new AudioContextClass()
  const context = audioContext
  const play = () => {
    const now = context.currentTime
    const gain = context.createGain()
    const tone = context.createOscillator()

    tone.type = 'triangle'
    tone.frequency.setValueAtTime(720, now)
    tone.frequency.exponentialRampToValueAtTime(980, now + 0.08)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

    tone.connect(gain).connect(context.destination)
    tone.start(now)
    tone.stop(now + 0.24)
  }

  if (context.state === 'suspended') context.resume().then(play).catch(() => {})
  else play()
}

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
  const chatsRef = useRef<ChatSummary[] | null>(null)

  const fail = useCallback((error: unknown) => {
    if (error instanceof MessengerApiError && error.status === 401) setPanel(null)
    else console.error(error)
  }, [])

  const replaceChats = useCallback((next: ChatSummary[]) => {
    if (hasNewIncomingMessage(chatsRef.current, next)) playMessageSound()
    chatsRef.current = next
    setChats(next)
  }, [])

  const patchChats = useCallback((patch: (current: ChatSummary[]) => ChatSummary[]) => {
    if (!chatsRef.current) return
    const next = patch(chatsRef.current)
    chatsRef.current = next
    setChats(next)
  }, [])

  const loadPanel = useCallback(() => messenger.panel().then(setPanel).catch(fail), [fail])
  const loadChats = useCallback(() => messenger.chats().then(replaceChats).catch(fail), [fail, replaceChats])
  const loadRequests = useCallback(() => messenger.requests().then(setRequests).catch(fail), [fail])
  const loadBlocks = useCallback(() => messenger.blocks().then(setBlocks).catch(fail), [fail])

  const signedIn = !!panel

  useEffect(() => {
    let stream: EventSource | undefined
    let hiddenTimer: number | undefined
    let cancelled = false
    /** The stream carries deltas only, so every open after the first starts from a fresh panel. */
    let resyncOnOpen = false

    const attach = () => {
      if (stream || cancelled) return

      const source = new EventSource(messenger.streamUrl, { withCredentials: true })
      stream = source

      source.addEventListener('open', () => {
        if (resyncOnOpen) loadPanel()
        resyncOnOpen = true
      })
      source.addEventListener('error', () => {
        // Only a stream we still hold counts as a sign-out: `detach` drops its own first.
        if (stream === source && source.readyState === EventSource.CLOSED) setPanel(null)
      })
      source.addEventListener('presence', (event) => {
        const { id, presence, status, song }: PresenceEvent = JSON.parse(event.data)
        setPanel((current) => current && current.roster.some((entry) => entry.id === id)
          ? { ...current, roster: sortRoster(current.roster.map((entry) => entry.id === id ? { ...entry, presence, status, song } : entry)) }
          : current)
      })
      source.addEventListener('cosmetics', (event) => {
        const { id, cosmetics }: Pick<Identity, 'id' | 'cosmetics'> = JSON.parse(event.data)
        setPanel((current) => current && current.roster.some((entry) => entry.id === id)
          ? { ...current, roster: current.roster.map((entry) => entry.id === id ? { ...entry, cosmetics } : entry) }
          : current)
        patchChats((current) => current.map((chat) => chat.id === id ? { ...chat, cosmetics } : chat))
      })
      source.addEventListener('request', (event) => {
        const from: Identity = JSON.parse(event.data)
        setPanel((current) => current && { ...current, incomingRequests: current.incomingRequests + 1 })
        setRequests((current) => current && {
          ...current,
          incoming: [{ ...from, requestedAt: new Date().toISOString() }, ...current.incoming.filter((request) => request.id !== from.id)],
        })
      })
      source.addEventListener('relation', (event) => {
        const { id }: { id: string } = JSON.parse(event.data)
        setRequests((current) => current && {
          incoming: current.incoming.filter((request) => request.id !== id),
          outgoing: current.outgoing.filter((request) => request.id !== id),
        })
        // Linked needs their roster entry, and none may change the request count: both refetch.
        loadPanel()
      })
    }

    const detach = () => {
      if (!stream) return
      const source = stream
      stream = undefined
      source.close()
    }

    /**
     * The open connection *is* the presence (the API reads a missing one as offline), so a
     * tab left in the background holds a socket on the proxy for a duelist nobody can reach.
     * Drop it once they have been away a while; they read as offline, which is what they are.
     */
    const onVisibility = () => {
      window.clearTimeout(hiddenTimer)
      if (document.visibilityState === 'visible') attach()
      else hiddenTimer = window.setTimeout(detach, HIDDEN_CLOSE_MS)
    }

    messenger.panel().then((first) => {
      if (cancelled) return
      setPanel(first)
      attach()
      document.addEventListener('visibilitychange', onVisibility)
    }).catch((error) => !cancelled && fail(error))

    return () => {
      cancelled = true
      window.clearTimeout(hiddenTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      detach()
    }
  }, [fail, loadPanel, patchChats])

  // The stream never echoes the viewer's own equip; the auth refresh after it does, so refetch `me`.
  const ownCosmetics = JSON.stringify(useAuth().user?.cosmetics ?? null)
  const seenCosmetics = useRef(ownCosmetics)
  useEffect(() => {
    if (seenCosmetics.current === ownCosmetics) return
    seenCosmetics.current = ownCosmetics
    if (signedIn) loadPanel()
  }, [ownCosmetics, signedIn, loadPanel])

  useEffect(() => {
    if (!signedIn) return

    loadChats()
    const refresh = () => document.visibilityState === 'visible' && loadChats()
    const timer = window.setInterval(refresh, CHAT_REFRESH_MS)
    window.addEventListener('focus', loadChats)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', loadChats)
    }
  }, [signedIn, loadChats])

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
        patchChats((current) => current.filter((chat) => chat.id !== id))
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

      clearChat: (id: string) => {
        patchChats((current) => current.filter((chat) => chat.id !== id))
        return messenger.clearChat(id).catch(fail)
      },

      /** The first page of a conversation marks it read on the server. */
      markRead: (id: string) =>
        patchChats((current) => current.map((chat) => (chat.id === id ? { ...chat, unread: 0 } : chat))),
      /** Moves the conversation to the top of the list with the sent message as its preview. */
      sent: (contact: Identity & { nickname: string | null }, message: ChatMessage) =>
        patchChats((current) => [
          { ...(current.find((chat) => chat.id === contact.id) ?? { ...contact, unread: 0 }), lastMessage: message },
          ...current.filter((chat) => chat.id !== contact.id),
        ]),
    }
  }, [fail, loadPanel, optimistic, patchChats])

  /** Once the chat list is loaded it is fresher than the panel's count. */
  const unreadChats = chats ? chats.filter((chat) => chat.unread > 0).length : panel?.unreadChats ?? 0

  return { panel, chats, requests, blocks, unreadChats, loadChats, loadRequests, loadBlocks, ...actions }
}

export type Messenger = ReturnType<typeof useMessenger>
