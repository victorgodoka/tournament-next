'use client'

import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@hooks/index";
import { signIn } from "@utils/auth";
import { messenger, MessengerApiError } from "@utils/messenger";
import type { Relation, RelationStatus } from "@utils/types";

type AddToListProps = {
  /** Whose profile this is. */
  id: string
  /** Shown in the prompt. */
  handle: string
  status?: RelationStatus
}

const KIND = {
  friend: {
    verb: 'Friend',
    linked: 'On friends list',
    requested: 'Friend request sent',
    button: 'border-cyan bg-cyan text-cyan-on',
    dot: 'bg-cyan',
    hover: 'hover:bg-cyan hover:text-cyan-on',
  },
  rival: {
    verb: 'Rival',
    linked: 'On rivals list',
    requested: 'Rival request sent',
    button: 'border-indigo bg-indigo text-indigo-on',
    dot: 'bg-indigo-lift',
    hover: 'hover:bg-indigo hover:text-indigo-on',
  },
} satisfies Record<Relation, Record<string, string>>

const OTHER: Record<Relation, Relation> = { friend: 'rival', rival: 'friend' }

const OPTION = "flex w-full cursor-pointer items-center gap-2.5 border-b border-line px-3.5 py-3 text-left text-ink dock-title"
const MINOR = "block w-full cursor-pointer border-b border-line px-3.5 py-2.5 text-left text-ink-muted signal-nav hover:bg-surface-300 hover:text-ink-dim"

const buttonLabel = (status: RelationStatus) => {
  switch (status.state) {
    case 'none': return 'Add player to list'
    case 'outgoing': return KIND[status.kind].requested
    case 'incoming': return 'Wants to add you'
    case 'linked': return KIND[status.kind].linked
  }
}

const buttonSkin = (status: RelationStatus) => {
  switch (status.state) {
    case 'none': return "border-line-strong text-ink hover:bg-ink hover:text-ink-on"
    case 'outgoing': return "border-line text-ink-muted"
    case 'incoming': return "border-gold bg-gold text-gold-on"
    case 'linked': return KIND[status.kind].button
  }
}

const promptTitle = (status: RelationStatus, handle: string) => {
  switch (status.state) {
    case 'none': return `Ask ${handle} to be`
    case 'outgoing': return `Waiting on ${handle} to accept`
    case 'incoming': return `${handle} asked you first. Accept as`
    case 'linked': return `Move ${handle} to`
  }
}

/**
 * Friend / rival control. Filing someone needs both sides to agree, so picking a kind sends a
 * request and the link only exists once the other duelist accepts. The kind stays private.
 */
export const AddToList = ({ id, handle, status: initialStatus = { state: 'none' } }: AddToListProps) => {
  const { user } = useAuth()
  const [status, setStatus] = useState<RelationStatus>(initialStatus)
  /** The profile doesn't say whether the viewer blocks this duelist; a `409 BLOCKED` does. */
  const [isBlocked, setIsBlocked] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const run = async (request: () => Promise<RelationStatus | void>, fallback: RelationStatus = { state: 'none' }) => {
    setIsOpen(false)
    setIsPending(true)
    try {
      setStatus((await request()) ?? fallback)
    } catch (error) {
      if (error instanceof MessengerApiError && error.code === 'BLOCKED') setIsBlocked(true)
      else if (error instanceof MessengerApiError && error.status === 404) setStatus({ state: 'none' })
      else console.error(error)
    } finally {
      setIsPending(false)
    }
  }

  const block = () => run(async () => {
    await messenger.block(id)
    setIsBlocked(true)
  })

  if (isBlocked) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(async () => {
          await messenger.unblock(id)
          setIsBlocked(false)
        })}
        className="inline-flex min-h-11 cursor-pointer items-center border border-gold px-4.5 text-gold signal-tab hover:bg-gold hover:text-gold-on disabled:cursor-wait disabled:opacity-(--opacity-dim)"
      >
        Unblock
      </button>
    )
  }

  return (
    <div
      className="relative"
      onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setIsOpen(false)}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={isPending}
        onClick={() => (user ? setIsOpen((open) => !open) : signIn())}
        className={twMerge(
          "inline-flex min-h-11 cursor-pointer items-center gap-2.5 border px-4.5 signal-tab disabled:cursor-wait disabled:opacity-(--opacity-dim)",
          buttonSkin(status),
        )}
      >
        {buttonLabel(status)}
      </button>

      {isOpen ? (
        <div role="menu" className="absolute top-[calc(100%+8px)] left-0 z-(--z-dropdown) w-66 border border-line-strong bg-surface-000 shadow-offset-void-sm">
          <p className="border-b border-line bg-ground-soft px-3.5 py-3 leading-normal text-ink-muted signal">
            {promptTitle(status, handle)}
          </p>

          {status.state === 'none' || status.state === 'incoming' ? (
            (['friend', 'rival'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => run(() => (status.state === 'incoming' ? messenger.accept(id, kind) : messenger.request(id, kind)))}
                className={twMerge(OPTION, KIND[kind].hover)}
              >
                <span aria-hidden className={twMerge("size-2.25 shrink-0", KIND[kind].dot)} />
                <span>{KIND[kind].verb}</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => run(() => messenger.setKind(id, OTHER[status.kind]))}
              className={twMerge(OPTION, KIND[OTHER[status.kind]].hover)}
            >
              <span aria-hidden className={twMerge("size-2.25 shrink-0", KIND[OTHER[status.kind]].dot)} />
              <span>{status.state === 'outgoing' ? `Change to ${KIND[OTHER[status.kind]].verb}` : KIND[OTHER[status.kind]].verb}</span>
            </button>
          )}

          {status.state !== 'none' ? (
            <button type="button" role="menuitem" onClick={() => run(() => messenger.remove(id))} className={MINOR}>
              {{ incoming: 'Decline', outgoing: 'Cancel request', linked: 'Remove from list' }[status.state]}
            </button>
          ) : null}

          {status.state !== 'outgoing' ? (
            <button type="button" role="menuitem" onClick={block} className={twMerge(MINOR, "hover:text-gold")}>
              Block
            </button>
          ) : null}

          <button type="button" role="menuitem" onClick={() => setIsOpen(false)} className={twMerge(MINOR, "border-b-0")}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  )
}
