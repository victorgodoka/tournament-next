'use client'

import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { Equalizer } from "@omega/friends-panel/now-playing";
import { PRESENCE, SELECTABLE_PRESENCE } from "@omega/friends-panel/presence";
import { Avatar, type Messenger } from "@omega/messenger";
import { contactName, MessengerApiError, STATUS_MAX } from "@utils/messenger";
import type { ChosenPresence, Panel } from "@utils/types";
import { FIELD, HINT, MICRO_LABEL, SMALL_BUTTON } from "./ui";

type YouStripProps = {
  me: Panel['me']
  messenger: Messenger
}

/** Saves on blur (Enter blurs): every save notifies all contacts and counts against the rate limit. */
const StatusField = ({ status, onSave }: { status: string | null; onSave: (status: string) => void }) => {
  const [draft, setDraft] = useState(status ?? '')

  return (
    <label className="block">
      <span className={MICRO_LABEL}>Status message</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== (status ?? '') && onSave(draft)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        maxLength={STATUS_MAX}
        placeholder="Type a personal message…"
        className={twMerge(FIELD, "mt-2 text-sm italic")}
      />
      <span className={twMerge(HINT, "mt-1.75 block")}>{STATUS_MAX - draft.length} characters left, shown to friends and rivals</span>
    </label>
  )
}

const SongField = ({ song, onSave }: { song: Panel['me']['song']; onSave: Messenger['setSong'] }) => {
  const [url, setUrl] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (next: string | null) => {
    setIsPending(true)
    setError(null)
    try {
      await onSave(next)
      setUrl('')
    } catch (failure) {
      setError(failure instanceof MessengerApiError && failure.status === 400
        ? 'Paste a YouTube video link (youtube.com/watch or youtu.be).'
        : "Couldn't save the song. Try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Equalizer active={!!song} />
        <p className="text-cyan signal-sm">Now playing</p>
      </div>
      {song ? (
        <div className="mt-2 flex items-center gap-2">
          <a href={`https://youtu.be/${song.videoId}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-ink body-strong hover:text-cyan">
            {song.title ?? 'Unknown title'}
          </a>
          <button type="button" disabled={isPending} onClick={() => save(null)} className={twMerge(SMALL_BUTTON, "border-surface-400 text-ink-muted hover:border-line-strong hover:text-ink")}>
            Clear
          </button>
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (url.trim()) save(url.trim())
        }}
        className="mt-2 flex gap-2"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">YouTube link</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={song ? 'Swap for another YouTube link' : 'Paste a YouTube link'}
            className={twMerge(FIELD, "text-sm")}
          />
        </label>
        <button type="submit" disabled={isPending || !url.trim()} className={twMerge(SMALL_BUTTON, "border-cyan text-cyan hover:bg-cyan hover:text-cyan-on")}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {error ? <p role="alert" className="mt-1.5 text-gold micro">{error}</p> : null}
    </div>
  )
}

export const YouStrip = ({ me, messenger }: YouStripProps) => (
  <section className="grid grid-cols-1 border-b border-line-strong lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
    <div className="flex gap-3.5 px-5.5 py-4.5 lg:px-11">
      <Avatar src={me.avatar} sizes="58px" className="size-14.5" />
      <div className="min-w-0 flex-1">
        <p className={MICRO_LABEL}>Your status</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span aria-hidden className={twMerge("size-2.5 shrink-0", PRESENCE[me.presence].dot)} />
          <span className="truncate text-ink display-6">{contactName(me)}</span>
        </div>
        <label>
          <span className="sr-only">Your presence</span>
          <select
            value={me.presence}
            onChange={(e) => messenger.setPresence(e.target.value as ChosenPresence)}
            className="mt-2 w-full border border-surface-400 bg-surface-200 px-2 py-1.5 text-ink signal hover:border-ink-muted"
          >
            {SELECTABLE_PRESENCE.map((option) => <option key={option} value={option}>{PRESENCE[option].label}</option>)}
          </select>
        </label>
      </div>
    </div>
    <div className="border-t border-line px-5.5 py-4.5 lg:border-t-0 lg:border-l lg:px-6">
      {/* Remounts when the saved status changes elsewhere (another tab, a reconnect). */}
      <StatusField key={me.status ?? ''} status={me.status} onSave={messenger.setStatus} />
    </div>
    <div className="border-t border-line bg-ground-cyan px-5.5 py-4.5 lg:border-t-0 lg:border-l lg:pr-11 lg:pl-6">
      <SongField song={me.song} onSave={messenger.setSong} />
    </div>
  </section>
)
