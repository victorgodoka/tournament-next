'use client'

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { MESSAGE_MAX, messageTime, messenger, MessengerApiError, mergeMessages } from "@utils/messenger";
import type { ChatMessage } from "@utils/types";

/** Chat is not real time: an open conversation re-fetches its first page at most this often. */
const REFRESH_MS = 30_000

type ChatThreadProps = {
  contactId: string
  /** The gadget's chat window: smaller type and wider bubbles. */
  compact?: boolean
  emptyText: string
  /** Fetching the first page marks the conversation read. */
  onRead: (contactId: string) => void
  onSent: (message: ChatMessage) => void
  className?: string
}

const sendError = (error: unknown) =>
  error instanceof MessengerApiError && error.status === 429
    ? 'Too many messages at once. Wait a moment and try again.'
    : 'Message not sent. Try again.'

/** One conversation with its composer. Key it by `contactId` so switching duelists starts clean. */
export const ChatThread = ({ contactId, compact, emptyText, onRead, onSent, className }: ChatThreadProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNotLinked, setIsNotLinked] = useState(false)

  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  /** Distance from the bottom before older messages were prepended, to keep the reader in place. */
  const olderAnchor = useRef<number | null>(null)

  useEffect(() => {
    let isCancelled = false
    const fetchLatest = (isFirst: boolean) => messenger.messages(contactId)
      .then((page) => {
        if (isCancelled) return
        setMessages((current) => mergeMessages(current, page.messages))
        if (isFirst) setCursor(page.nextCursor)
        onRead(contactId)
      })
      .catch((failure) => {
        console.error(failure)
        if (isFirst && !isCancelled) setError("Couldn't load this conversation.")
      })
      .finally(() => !isCancelled && setIsLoading(false))

    fetchLatest(true)
    const onFocus = () => fetchLatest(false)
    const timer = setInterval(() => document.visibilityState === 'visible' && fetchLatest(false), REFRESH_MS)
    window.addEventListener('focus', onFocus)
    return () => {
      isCancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [contactId, onRead])

  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    if (olderAnchor.current !== null) {
      element.scrollTop = element.scrollHeight - olderAnchor.current
      olderAnchor.current = null
    } else if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [messages])

  const loadOlder = async () => {
    const element = scroller.current
    if (!cursor || !element) return
    try {
      const page = await messenger.messages(contactId, cursor)
      olderAnchor.current = element.scrollHeight - element.scrollTop
      setMessages((current) => mergeMessages(current, page.messages))
      setCursor(page.nextCursor)
    } catch (failure) {
      console.error(failure)
    }
  }

  const send = async () => {
    if (!draft.trim() || isSending) return
    setIsSending(true)
    setError(null)
    try {
      const message = await messenger.send(contactId, draft)
      stickToBottom.current = true
      setMessages((current) => mergeMessages(current, [message]))
      setDraft('')
      onSent(message)
    } catch (failure) {
      if (failure instanceof MessengerApiError && failure.code === 'NOT_LINKED') setIsNotLinked(true)
      else setError(sendError(failure))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className={twMerge("flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scroller}
        onScroll={(e) => {
          const element = e.currentTarget
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40
        }}
        className={twMerge("flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-200", compact ? "gap-2.75 px-3 py-3.5" : "gap-3.5 px-5.5 py-5")}
      >
        {cursor ? (
          <button
            type="button"
            onClick={loadOlder}
            className="mx-auto cursor-pointer border border-surface-400 px-2.5 py-1 font-mono text-[9px] tracking-[.14em] text-ink-muted uppercase hover:border-line-strong hover:text-ink"
          >
            Load older
          </button>
        ) : null}

        {!messages.length ? (
          <p className={twMerge("m-auto max-w-[34ch] text-center text-ink-muted", compact ? "micro" : "caption")}>
            {isLoading ? 'Loading…' : emptyText}
          </p>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={twMerge("flex flex-col gap-1", message.mine ? "items-end" : "items-start")}>
            <p
              className={twMerge(
                "border whitespace-pre-wrap wrap-break-word text-ink",
                compact ? "max-w-[88%] px-2.75 py-2.25 text-[13px] leading-[1.45]" : "max-w-[72%] px-3.5 py-3 text-sm leading-normal",
                message.mine ? "border-gold bg-ground-gold" : "border-line bg-surface-100",
              )}
            >
              {message.body}
            </p>
            <span className="font-mono text-[9px] tracking-[.18em] text-ink-muted uppercase">
              {message.mine ? 'You, ' : ''}{messageTime(message.createdAt)}
            </span>
          </div>
        ))}
      </div>

      {error ? <p role="alert" className="shrink-0 border-t border-gold bg-ground-gold px-3 py-2 text-ink-dim micro">{error}</p> : null}

      {isNotLinked ? (
        <p className="shrink-0 border-t border-line px-5 py-3.5 text-ink-muted caption">
          You can only message friends and rivals.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className={twMerge("flex shrink-0 items-end border-t border-line", compact ? "gap-2 px-3 py-2.5" : "gap-3 px-5.5 py-3.5")}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Message</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey) return
                e.preventDefault()
                send()
              }}
              rows={2}
              maxLength={MESSAGE_MAX}
              placeholder={compact ? 'Enter to send' : 'Write a message. Enter to send'}
              className={twMerge(
                "block w-full resize-none border border-surface-400 bg-surface-200 text-ink placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan",
                compact ? "px-2.25 py-2 text-[13px] leading-[1.4]" : "px-3 py-2.75 text-sm leading-[1.45]",
              )}
            />
          </label>
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className={twMerge(
              "cursor-pointer bg-gold text-gold-on hover:bg-cyan hover:text-cyan-on disabled:cursor-not-allowed disabled:bg-surface-400 disabled:text-ink-muted",
              compact ? "min-h-9.5 px-3.25 action-xs" : "min-h-11 px-5 action-sm",
            )}
          >
            Send
          </button>
        </form>
      )}
    </div>
  )
}
