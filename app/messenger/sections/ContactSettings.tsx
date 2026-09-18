'use client'

import { useState } from "react";
import { twMerge } from "tailwind-merge";
import type { Messenger } from "@omega/messenger";
import { NICKNAME_MAX, NOTE_MAX } from "@utils/messenger";
import type { Relation, RosterEntry } from "@utils/types";
import { FIELD, HINT, MICRO_LABEL, SMALL_BUTTON } from "./ui";

type ContactSettingsProps = {
  contact: RosterEntry
  messenger: Messenger
  /** Follows the contact to the tab they moved to. */
  onKindChange: (kind: Relation) => void
}

const CELL = "border-b border-line px-5 py-4"
const DANGER = "min-h-10 cursor-pointer border px-3.5 text-left signal-chip"

const KINDS = [
  { kind: 'friend', label: 'Friend', active: 'bg-cyan text-cyan-on' },
  { kind: 'rival', label: 'Rival', active: 'bg-indigo text-indigo-on' },
] as const

/** Nickname, note, kind, block and remove. All of it is private to the viewer. Key it by contact id. */
export const ContactSettings = ({ contact, messenger, onKindChange }: ContactSettingsProps) => {
  const [nickname, setNickname] = useState(contact.nickname ?? '')
  const [note, setNote] = useState(contact.note ?? '')
  const [confirming, setConfirming] = useState<'block' | 'remove' | null>(null)
  const name = contact.displayName ?? contact.username ?? 'Duelist'

  const saveNickname = (value: string) => value.trim() !== (contact.nickname ?? '') && messenger.setNickname(contact.id, value)

  const danger = (action: 'block' | 'remove') => {
    if (confirming !== action) return setConfirming(action)
    messenger[action](contact.id)
  }

  return (
    <div className="lg:grid lg:grid-cols-2 xl:block">
      <div className={CELL}>
        <label htmlFor="contact-nickname" className={MICRO_LABEL}>Nickname</label>
        <input
          id="contact-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onBlur={() => saveNickname(nickname)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          maxLength={NICKNAME_MAX}
          placeholder={name}
          className={twMerge(FIELD, "mt-2 text-sm font-bold")}
        />
        <div className="mt-1.75 flex items-center justify-between gap-2.5">
          <span className={HINT}>Only you see it</span>
          <button
            type="button"
            onClick={() => {
              setNickname('')
              saveNickname('')
            }}
            className={twMerge(SMALL_BUTTON, "border-surface-400 px-2 py-0.75 text-[9px] text-ink-muted hover:border-line-strong hover:text-ink")}
          >
            Reset
          </button>
        </div>
      </div>

      <div className={CELL}>
        <label htmlFor="contact-note" className={MICRO_LABEL}>Private note</label>
        <textarea
          id="contact-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note.trim() !== (contact.note ?? '') && messenger.setNote(contact.id, note)}
          rows={4}
          maxLength={NOTE_MAX}
          placeholder="Decks they play, ruling disputes, anything worth remembering."
          className={twMerge(FIELD, "mt-2 resize-y text-[13px] leading-normal")}
        />
        <p className={twMerge(HINT, "mt-1.5")}>{NOTE_MAX - note.length} characters left</p>
      </div>

      <div className={CELL}>
        <p className={MICRO_LABEL}>Relationship</p>
        <div className="mt-2.25 flex gap-px border border-line bg-line">
          {KINDS.map(({ kind, label, active }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={contact.kind === kind}
              onClick={() => {
                if (contact.kind === kind) return
                messenger.setKind(contact.id, kind)
                onKindChange(kind)
              }}
              className={twMerge(
                "min-h-10 flex-1 cursor-pointer action-xs",
                contact.kind === kind ? active : "bg-surface-000 text-ink-muted hover:bg-surface-300 hover:text-ink-dim",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2.25 text-ink-muted micro">
          Only decides which tab they sit under for you. They are never told which one you picked.
        </p>
      </div>

      <div className="px-5 py-4">
        <p className={twMerge(MICRO_LABEL, "text-gold")}>Danger zone</p>
        <div className="mt-2.5 flex flex-col gap-2.25">
          <button
            type="button"
            onClick={() => danger('block')}
            className={twMerge(DANGER, confirming === 'block' ? "border-gold bg-gold text-gold-on" : "border-gold text-gold hover:bg-ground-gold")}
          >
            {confirming === 'block' ? 'Tap again to block' : 'Block duelist'}
          </button>
          <button
            type="button"
            onClick={() => danger('remove')}
            className={twMerge(DANGER, confirming === 'remove' ? "border-ink bg-ink text-ink-on" : "border-line-strong text-ink hover:bg-surface-300")}
          >
            {confirming === 'remove' ? 'Tap again to remove' : 'Remove from list'}
          </button>
        </div>
        <p className="mt-2.25 text-ink-muted micro">
          {confirming === 'block'
            ? "Blocking is silent: to them it looks like a removal, and they can't message you or send requests."
            : "Removing ends the link for both of you and deletes your nickname and note. Chat history stays readable."}
        </p>
      </div>
    </div>
  )
}
