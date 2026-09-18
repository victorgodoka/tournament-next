'use client'

import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { PRESENCE } from "@omega/friends-panel/presence";
import { ChatThread, type Messenger } from "@omega/messenger";
import { buttonClasses } from "@ui/button";
import { Chip } from "@ui/chip";
import { contactHandle, contactName } from "@utils/messenger";
import type { RosterEntry } from "@utils/types";

const KIND_TAG = {
  friend: { label: 'Friend', tone: 'cyan' },
  rival: { label: 'Rival', tone: 'indigo' },
} as const

export const Conversation = ({ contact, messenger }: { contact: RosterEntry; messenger: Messenger }) => {
  const presence = PRESENCE[contact.presence]
  const name = contactName(contact)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3.5 border-b border-line px-5.5 py-4">
        <span aria-hidden className={twMerge("size-2.5 shrink-0", presence.dot)} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.25">
            <h2 className="truncate text-ink display-5">{name}</h2>
            <span className="text-ink-muted mono-handle">{contactHandle(contact)}</span>
          </div>
          <p className="mt-1 text-ink-muted caption">
            <span className="text-ink-dim">{presence.label}</span>
            {contact.status ? <span className="italic">, {contact.status}</span> : null}
          </p>
        </div>
        <span className="flex-[1_1_40px]" />
        <Chip tone={KIND_TAG[contact.kind].tone}>{KIND_TAG[contact.kind].label}</Chip>
        <Link
          href={`/profile/${contact.id}`}
          className={buttonClasses({ variant: 'secondary', size: 'mono' })}
        >
          Profile
        </Link>
      </div>

      {contact.note ? (
        <div className="flex shrink-0 gap-2.5 border-b border-gold bg-ground-gold px-5.5 py-2.75">
          <span aria-hidden className="mt-1 size-2.25 shrink-0 bg-gold" />
          <p className="text-ink-dim caption">{contact.note}</p>
        </div>
      ) : null}

      <ChatThread
        key={contact.id}
        contactId={contact.id}
        emptyText={`Say something to ${name}. They'll see it the next time they open the chat.`}
        onRead={messenger.markRead}
        onSent={(message) => messenger.sent(contact, message)}
      />
    </div>
  )
}
