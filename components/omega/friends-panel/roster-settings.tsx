'use client'

import { useState } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import type { Messenger } from "@omega/messenger";
import { Button, Modal } from "@ui/index";
import { contactHandle, NICKNAME_MAX, NOTE_MAX } from "@utils/messenger";
import type { RosterEntry } from "@utils/types";
import { RELATION_ACTIVE } from "./presence";

const LABEL = "text-ink-muted signal-sm"
const FIELD = "mt-2 block w-full border border-surface-400 bg-surface-200 px-2.75 py-2.25 text-sm text-ink placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"

type RosterSettingsProps = {
  entry: RosterEntry
  messenger: Messenger
  onClose: () => void
}

/** Portaled to body: the panel's z-(--z-dock) stacking context would otherwise sit the modal under the header. */
export const RosterSettings = ({ entry, messenger, onClose }: RosterSettingsProps) => {
  const [kind, setKind] = useState(entry.kind)
  const [nickname, setNickname] = useState(entry.nickname ?? '')
  const [note, setNote] = useState(entry.note ?? '')
  const name = entry.displayName ?? entry.username ?? 'Duelist'

  /** One route per field, so only what changed is sent. */
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (kind !== entry.kind) messenger.setKind(entry.id, kind)
    if (nickname.trim() !== (entry.nickname ?? '')) messenger.setNickname(entry.id, nickname)
    if (note.trim() !== (entry.note ?? '')) messenger.setNote(entry.id, note)
    onClose()
  }

  return createPortal(
    <Modal isOpen onClose={onClose} aria-labelledby="roster-settings-title">
      <form
        onSubmit={save}
        className="w-full max-w-md border border-line-strong bg-surface-000 p-6 shadow-offset-void"
      >
        <h2 id="roster-settings-title" className="text-ink display-4">{name}</h2>
        <p className="mt-1.5 text-ink-muted mono-handle">{contactHandle(entry)}</p>

        <fieldset className="mt-6">
          <legend className={LABEL}>List</legend>
          <div className="mt-2 flex border-b border-line">
            {(['friend', 'rival'] as const).map((option) => (
              <label
                key={option}
                className={twMerge(
                  "flex min-h-11 flex-1 cursor-pointer items-center justify-center signal-tab has-focus-visible:shadow-focus",
                  kind === option ? RELATION_ACTIVE[option] : "text-ink-muted hover:text-ink-dim",
                )}
              >
                <input type="radio" name="kind" checked={kind === option} onChange={() => setKind(option)} className="sr-only" />
                {option === 'friend' ? 'Friend' : 'Rival'}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 block">
          <span className={LABEL}>Nickname</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={NICKNAME_MAX} className={FIELD} />
        </label>

        <label className="mt-5 block">
          <span className="flex justify-between">
            <span className={LABEL}>Note</span>
            <span className="text-ink-muted mono-handle">{note.length}/{NOTE_MAX}</span>
          </span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} rows={4} className={twMerge(FIELD, "resize-none")} />
        </label>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm">Save</Button>
        </div>
      </form>
    </Modal>,
    document.body,
  )
}
