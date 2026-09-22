'use client'

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Avatar, useMessenger } from "@omega/messenger";
import { TabBar, tabPanelProps } from "@ui/tab-bar";
import { contactName, STATUS_MAX } from "@utils/messenger";
import type { ChosenPresence, Relation } from "@utils/types";
import { ChatWindow } from "./chat-window";
import { NowPlaying } from "./now-playing";
import { PRESENCE, SELECTABLE_PRESENCE } from "./presence";
import { RosterList } from "./roster-list";

/** Docked messenger: own presence, status and song, the friends / rivals lists, and a chat window. Hidden when signed out. */
export const FriendsPanel = () => {
  const messenger = useMessenger()
  const { panel, chats, loadChats } = messenger
  const [isOpen, setIsOpen] = useState(true)
  const [tab, setTab] = useState<Relation>('friend')
  const [statusDraft, setStatusDraft] = useState<string | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const statusInput = useRef<HTMLInputElement>(null)
  const cancelStatus = useRef(false)
  const listId = useId()

  const signedIn = !!panel
  // Unread counts per contact come from the chat list: refetch it whenever the dock opens.
  useEffect(() => {
    if (signedIn && isOpen) loadChats()
  }, [signedIn, isOpen, loadChats])

  if (!panel) return null

  const { me, roster } = panel
  const friends = roster.filter((entry) => entry.kind === 'friend')
  const rivals = roster.filter((entry) => entry.kind === 'rival')
  const entries = tab === 'friend' ? friends : rivals
  const readyCount = roster.filter((entry) => entry.presence === 'ready').length
  const unread = new Map(chats?.map((chat) => [chat.id, chat.unread]))
  const chatContact = roster.find((entry) => entry.id === chatId)

  const isEditing = statusDraft !== null
  /** Blur is the single save path: Enter and Done blur the input, Escape discards first. */
  const finishStatus = () => {
    if (statusDraft !== null && !cancelStatus.current && statusDraft.trim() !== (me.status ?? '')) messenger.setStatus(statusDraft)
    cancelStatus.current = false
    setStatusDraft(null)
  }

  return (
    <>
      {chatContact ? <ChatWindow contact={chatContact} messenger={messenger} onClose={() => setChatId(null)} /> : null}

      <aside className="fixed right-2.5 bottom-2.5 left-2.5 z-(--z-dock) flex max-h-[calc(100dvh-2.5rem)] flex-col border border-line-strong bg-surface-000 shadow-offset-void sm:right-5 sm:bottom-5 sm:left-auto sm:w-85">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex min-h-11.5 shrink-0 cursor-pointer items-center gap-2.5 border-b border-line bg-gold px-3.5 text-left text-gold-on dock-title hover:bg-cyan hover:text-cyan-on"
        >
          <span aria-hidden className="size-2.25 bg-current" />
          <span>Friends / Rivals</span>
          <span className="flex-1" />
          {messenger.unreadChats ? (
            <span className="bg-surface-000 px-1.5 py-0.5 text-ink signal-count">{messenger.unreadChats} unread</span>
          ) : null}
          <span className="signal-tab">{readyCount} ready</span>
          <span aria-hidden className="mono-data font-bold">{isOpen ? '-' : '+'}</span>
        </button>

        {isOpen ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 gap-3 border-b border-line p-3.5">
              <div className="flex shrink-0 flex-col gap-1.5">
                <Avatar src={me.avatar} sizes="52px" className="size-13" />
                <button
                  type="button"
                  aria-pressed={isEditing}
                  // Keeps focus in the input so its blur, not this click, saves.
                  onMouseDown={(e) => isEditing && e.preventDefault()}
                  onClick={() => (isEditing ? statusInput.current?.blur() : setStatusDraft(me.status ?? ''))}
                  className="cursor-pointer border border-line py-0.5 text-ink-muted signal-sm font-bold hover:border-gold hover:text-gold"
                >
                  {isEditing ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span aria-hidden className={twMerge("size-2.5 shrink-0", PRESENCE[me.presence].dot)} />
                  <span className="truncate text-ink window-title">{contactName(me)}</span>
                  <label className="ml-auto">
                    <span className="sr-only">Your presence</span>
                    <select
                      value={me.presence}
                      onChange={(e) => messenger.setPresence(e.target.value as ChosenPresence)}
                      className="border border-surface-400 bg-surface-200 px-1 py-0.5 text-ink-dim signal hover:border-ink-muted"
                    >
                      {SELECTABLE_PRESENCE.map((option) => (
                        <option key={option} value={option}>{PRESENCE[option].label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {isEditing ? (
                  <label>
                    <span className="sr-only">Your personal message</span>
                    <input
                      ref={statusInput}
                      autoFocus
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      onBlur={finishStatus}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelStatus.current = true
                        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
                      }}
                      placeholder="Type a personal message…"
                      maxLength={STATUS_MAX}
                      className="mt-2 w-full border border-cyan bg-surface-200 px-2 py-1.5 text-ink caption italic placeholder:text-ink-muted"
                    />
                  </label>
                ) : (
                  <p className={twMerge("mt-2 px-2 py-1.5 caption wrap-break-word italic", me.status ? "text-ink" : "text-ink-muted")}>
                    {me.status || 'No personal message'}
                  </p>
                )}
              </div>
            </div>

            {me.song ? <NowPlaying song={me.song} /> : null}

            <TabBar
              label="Duelist list"
              idPrefix={listId}
              active={tab}
              onSelect={setTab}
              tabs={[
                { id: 'friend', label: `Friends ${friends.length}` },
                { id: 'rival', label: `Rivals ${rivals.length}` },
              ]}
            />

            <div {...tabPanelProps(listId, tab)} className="flex min-h-0 flex-1 flex-col">
              <RosterList entries={entries} kind={tab} unread={unread} messenger={messenger} onChat={setChatId} />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2.5 border-t border-line px-3.5 py-2.5 signal">
              {panel.incomingRequests ? (
                <Link href="/messenger?tab=requests" className="text-gold hover:text-cyan">
                  {panel.incomingRequests} {panel.incomingRequests === 1 ? 'request' : 'requests'}
                </Link>
              ) : (
                <span className="text-ink-muted">{entries.length ? 'Click a name to chat' : 'Nothing to show'}</span>
              )}
              <Link href="/messenger" className="text-gold hover:text-cyan">
                Full list
              </Link>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  )
}
