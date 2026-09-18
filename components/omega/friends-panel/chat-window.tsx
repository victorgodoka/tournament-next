'use client'

import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { ChatThread, type Messenger } from "@omega/messenger";
import { contactName } from "@utils/messenger";
import type { RosterEntry } from "@utils/types";
import { PRESENCE } from "./presence";

type ChatWindowProps = {
  contact: RosterEntry
  messenger: Messenger
  onClose: () => void
}

/** Floating conversation beside the dock. On phones it covers the dock instead. */
export const ChatWindow = ({ contact, messenger, onClose }: ChatWindowProps) => {
  const presence = PRESENCE[contact.presence]
  const name = contactName(contact)

  return (
    <aside
      aria-label={`Conversation with ${name}`}
      className="fixed right-2.5 bottom-2.5 left-2.5 z-(--z-dock-window) flex h-100 max-h-[calc(100dvh-2.5rem)] flex-col border border-line-strong bg-surface-000 shadow-offset-void sm:right-93 sm:bottom-5 sm:left-auto sm:w-80"
    >
      <div className="flex min-h-10.5 shrink-0 items-center gap-2.25 bg-ink pr-2 pl-3 text-ink-on">
        <span aria-hidden className={twMerge("size-2.5 shrink-0", presence.dot)} />
        <span className="min-w-0 flex-1 truncate window-title">{name}</span>
        <Link
          href={`/messenger?with=${contact.id}`}
          className="border border-ink-on px-1.75 py-1 font-mono text-[9px] tracking-[.12em] text-ink-on uppercase hover:bg-ink-on hover:text-ink"
        >
          Expand
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close conversation"
          className="size-6.5 cursor-pointer font-mono text-sm font-bold hover:bg-cyan hover:text-cyan-on"
        >
          ×
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-ground-soft px-3 py-2">
        <span className="font-mono text-[9px] tracking-[.14em] text-ink-muted uppercase">{presence.label}</span>
        <span className="flex-1" />
        {contact.status ? <span className="min-w-0 truncate text-xs text-ink-muted italic">{contact.status}</span> : null}
      </div>
      <ChatThread
        key={contact.id}
        compact
        contactId={contact.id}
        emptyText="No messages yet. They'll see yours the next time they open the chat."
        onRead={messenger.markRead}
        onSent={(message) => messenger.sent(contact, message)}
      />
    </aside>
  )
}
