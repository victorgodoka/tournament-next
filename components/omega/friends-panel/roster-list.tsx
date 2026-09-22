import { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { twMerge } from "tailwind-merge";
import type { Messenger } from "@omega/messenger";
import { contactHandle, contactName } from "@utils/messenger";
import type { Relation, RosterEntry } from "@utils/types";
import { PRESENCE } from "./presence";
import { RosterSettings } from "./roster-settings";

const EMPTY_COPY: Record<Relation, { title: string; body: string; cta: string; mark: string }> = {
  friend: {
    title: 'No friends yet',
    body: 'Add duelists from their profile or straight after a duel. They show up here with status and presence.',
    cta: 'Find duelists',
    mark: 'bg-cyan',
  },
  rival: {
    title: 'No rivals yet',
    body: 'Name a duelist your rival and their ladder runs stay in sight. Nobody is on the list right now.',
    cta: 'Browse ladder',
    mark: 'bg-indigo-lift',
  },
}

/** `w-0` instead of `hidden` keeps the buttons tabbable, so focus can reveal them too. */
const ACTIONS = "flex w-0 shrink-0 overflow-hidden group-focus-within:w-auto group-hover:w-auto"
const ACTION = "flex w-8 cursor-pointer items-center justify-center text-base"

type RosterRowProps = {
  entry: RosterEntry
  unread: number
  onChat: () => void
  onSettings: () => void
  onRemove: () => void
  onBlock: () => void
}

const RosterRow = ({ entry, unread, onChat, onSettings, onRemove, onBlock }: RosterRowProps) => {
  const presence = PRESENCE[entry.presence]
  const name = entry.displayName ?? entry.username ?? 'Duelist'
  const confirm = (verb: string, action: () => void) => window.confirm(`${verb} ${contactName(entry)}?`) && action()

  return (
    <li className="group flex items-stretch border-b border-line hover:bg-surface-300">
      <div className={twMerge(ACTIONS, "bg-gold text-gold-on")}>
        <button type="button" aria-label={`Settings for ${name}`} onClick={onSettings} className={twMerge(ACTION, "hover:bg-cyan hover:text-cyan-on")}>
          <Icon icon="mdi:cog-outline" />
        </button>
      </div>

      <button type="button" onClick={onChat} aria-label={`Message ${contactName(entry)}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left">
        <span aria-hidden className={twMerge("size-2 shrink-0", presence.dot)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink">
            {name}
            {entry.nickname ? <span className="font-normal text-ink-dim"> ({entry.nickname})</span> : null}
          </span>
          <span className="block truncate text-ink-muted mono-handle group-hover:text-ink-dim">{contactHandle(entry)}</span>
          {entry.status ? <span className="mt-0.5 block truncate text-ink-muted micro group-hover:text-ink-dim">{entry.status}</span> : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.25">
          {unread ? (
            <span className="min-w-5 bg-cyan px-1.5 py-0.5 text-center text-cyan-on signal-count">
              {unread}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            {entry.note ? (
              <span role="img" aria-label={`Note: ${entry.note}`} title={entry.note} className="cursor-help text-sm text-gold">
                <Icon icon="mdi:note-text-outline" />
              </span>
            ) : null}
            <span className="text-ink-muted signal-sm group-hover:text-ink-dim">
              {presence.short}
            </span>
          </span>
        </span>
      </button>

      <div className={twMerge(ACTIONS, "bg-gold-deep text-ink")}>
        <button type="button" aria-label={`Remove ${name}`} onClick={() => confirm('Remove', onRemove)} className={twMerge(ACTION, "hover:bg-gold hover:text-gold-on")}>
          <Icon icon="mdi:trash-can-outline" />
        </button>
        <button type="button" aria-label={`Block ${name}`} onClick={() => confirm('Block', onBlock)} className={twMerge(ACTION, "hover:bg-gold hover:text-gold-on")}>
          <Icon icon="mdi:block-helper" />
        </button>
      </div>
    </li>
  )
}

const RosterEmpty = ({ kind }: { kind: Relation }) => {
  const copy = EMPTY_COPY[kind]

  return (
    <div className="shrink-0 px-4 pt-6.5 pb-7 text-center">
      <span aria-hidden className={twMerge("inline-block size-2.5", copy.mark)} />
      <p className="mt-3.5 text-ink display-6">{copy.title}</p>
      <p className="mx-auto mt-2 max-w-[30ch] text-ink-muted caption">{copy.body}</p>
      <Link
        href="https://tournament.duelistsunite.org/"
        className="mt-4 inline-flex min-h-10 items-center border border-line-strong px-4.5 text-ink action-xs hover:bg-ink hover:text-ink-on"
      >
        {copy.cta}
      </Link>
    </div>
  )
}

type RosterListProps = {
  entries: RosterEntry[]
  kind: Relation
  unread: Map<string, number>
  messenger: Messenger
  onChat: (id: string) => void
}

export const RosterList = ({ entries, kind, unread, messenger, onChat }: RosterListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = entries.find((entry) => entry.id === editingId)

  if (!entries.length) return <RosterEmpty kind={kind} />

  return (
    <>
      <ul className="max-h-57.5 min-h-0 flex-1 overflow-y-auto">
        {entries.map((entry) => (
          <RosterRow
            key={entry.id}
            entry={entry}
            unread={unread.get(entry.id) ?? 0}
            onChat={() => onChat(entry.id)}
            onSettings={() => setEditingId(entry.id)}
            onRemove={() => messenger.remove(entry.id)}
            onBlock={() => messenger.block(entry.id)}
          />
        ))}
      </ul>
      {editing ? <RosterSettings entry={editing} messenger={messenger} onClose={() => setEditingId(null)} /> : null}
    </>
  )
}
