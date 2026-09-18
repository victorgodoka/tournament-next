'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Avatar, type Messenger } from "@omega/messenger";
import { contactHandle, contactName } from "@utils/messenger";
import type { Identity, Relation } from "@utils/types";
import { relative } from "@utils/welcome";
import { MICRO_LABEL, SMALL_BUTTON } from "./ui";

const OTHER: Record<Relation, Relation> = { friend: 'rival', rival: 'friend' }
const KIND_TEXT: Record<Relation, string> = { friend: 'text-cyan', rival: 'text-indigo-lift' }

const Row = ({ who, meta, children }: { who: Identity; meta: React.ReactNode; children: React.ReactNode }) => (
  <li className="border-b border-line px-3.5 py-3">
    <div className="flex items-center gap-2.5">
      <Avatar src={who.avatar} sizes="32px" className="size-8" />
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${who.id}`} className="block truncate text-ink body-strong hover:text-gold">{contactName(who)}</Link>
        <p className="truncate text-ink-muted mono-handle">{contactHandle(who)} {meta}</p>
      </div>
    </div>
    <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>
  </li>
)

const Group = ({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) => (
  <section>
    <h3 className={twMerge(MICRO_LABEL, "border-b border-line bg-ground-soft px-3.5 py-2.5")}>{title} {count}</h3>
    {count ? <ul>{children}</ul> : <p className="px-3.5 py-4 text-ink-muted caption">{empty}</p>}
  </section>
)

/** Pending requests both ways, plus who the viewer blocks. Live updates come from the stream. */
export const Requests = ({ messenger }: { messenger: Messenger }) => {
  const { requests, blocks, loadRequests, loadBlocks } = messenger
  const [now] = useState(Date.now)

  useEffect(() => {
    loadRequests()
    loadBlocks()
  }, [loadRequests, loadBlocks])

  if (!requests || !blocks) return <p className="px-3.5 py-8 text-center text-ink-muted caption">Loading…</p>

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Group title="Incoming" count={requests.incoming.length} empty="Nobody is waiting on you.">
        {requests.incoming.map((request) => (
          <Row key={request.id} who={request} meta={`, ${relative(request.requestedAt, now)}`}>
            <button type="button" onClick={() => messenger.accept(request.id, 'friend')} className={twMerge(SMALL_BUTTON, "border-cyan bg-cyan text-cyan-on hover:bg-transparent hover:text-cyan")}>
              Accept as friend
            </button>
            <button type="button" onClick={() => messenger.accept(request.id, 'rival')} className={twMerge(SMALL_BUTTON, "border-indigo bg-indigo text-indigo-on hover:bg-transparent hover:border-indigo-lift hover:text-indigo-lift")}>
              Accept as rival
            </button>
            <button type="button" onClick={() => messenger.decline(request.id)} className={twMerge(SMALL_BUTTON, "border-surface-400 text-ink-muted hover:border-line-strong hover:text-ink")}>
              Decline
            </button>
            <button type="button" onClick={() => messenger.block(request.id)} className={twMerge(SMALL_BUTTON, "border-gold text-gold hover:bg-gold hover:text-gold-on")}>
              Block
            </button>
          </Row>
        ))}
      </Group>

      <Group title="Sent" count={requests.outgoing.length} empty="No requests waiting on anyone.">
        {requests.outgoing.map((request) => (
          <Row key={request.id} who={request} meta={<span className={KIND_TEXT[request.kind]}>as {request.kind}</span>}>
            <button type="button" onClick={() => messenger.setRequestKind(request.id, OTHER[request.kind])} className={twMerge(SMALL_BUTTON, "border-surface-400 text-ink-muted hover:border-line-strong hover:text-ink")}>
              Change to {OTHER[request.kind]}
            </button>
            <button type="button" onClick={() => messenger.cancel(request.id)} className={twMerge(SMALL_BUTTON, "border-gold text-gold hover:bg-gold hover:text-gold-on")}>
              Cancel
            </button>
          </Row>
        ))}
      </Group>

      <Group title="Blocked" count={blocks.length} empty="You aren't blocking anyone.">
        {blocks.map((blocked) => (
          <Row key={blocked.id} who={blocked} meta={`, blocked ${relative(blocked.blockedAt, now)}`}>
            <button type="button" onClick={() => messenger.unblock(blocked.id)} className={twMerge(SMALL_BUTTON, "border-line-strong text-ink hover:bg-ink hover:text-ink-on")}>
              Unblock
            </button>
          </Row>
        ))}
      </Group>
    </div>
  )
}
