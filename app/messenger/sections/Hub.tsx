'use client'

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { twMerge } from "tailwind-merge";
import { PRESENCE } from "@omega/friends-panel/presence";
import { useMessenger } from "@omega/messenger";
import { Button } from "@ui/button";
import { signIn } from "@utils/auth";
import { contactHandle, contactName } from "@utils/messenger";
import type { ChatSummary, Relation, RosterEntry } from "@utils/types";
import { ContactSettings } from "./ContactSettings";
import { Conversation } from "./Conversation";
import { Requests } from "./Requests";
import { YouStrip } from "./YouStrip";
import { MICRO_LABEL, tabClass } from "./ui";

export type HubTab = Relation | 'requests'
type Pane = 'messages' | 'settings'

const EMPTY: Record<Relation, { title: string; body: string; mark: string }> = {
  friend: { title: 'No friends yet', body: 'Add duelists from their profile. Once they accept, they show up here with presence and status.', mark: 'bg-cyan' },
  rival: { title: 'No rivals yet', body: 'File a duelist as a rival from their profile to keep them in sight.', mark: 'bg-indigo-lift' },
}

const preview = (entry: RosterEntry, chat: ChatSummary | undefined) => {
  if (chat) return `${chat.lastMessage.mine ? 'You: ' : ''}${chat.lastMessage.body}`
  return entry.status ?? 'No messages yet'
}

const Stat = ({ label, value, className }: { label: string; value: number; className: string }) => (
  <div>
    <p className={twMerge("signal", className)}>{label}</p>
    <p className="mt-1.5 text-ink display-4">{value}</p>
  </div>
)

const Masthead = ({ children }: { children?: React.ReactNode }) => (
  <section className="border-b border-line px-5.5 pt-9 pb-6.5 lg:px-11 lg:pt-9.5 lg:pb-7.5">
    <p className="text-ink-muted signal-lg">Duelist list</p>
    <div className="mt-3 flex flex-wrap items-end gap-x-7 gap-y-4.5">
      <h1 className="text-ink display-1">Friends &amp; rivals</h1>
      {children}
    </div>
  </section>
)

export const Hub = ({ initialId, initialTab }: { initialId?: string; initialTab?: HubTab }) => {
  const messenger = useMessenger()
  const { panel, chats, loadChats } = messenger
  /** `null` until picked: defaults to the tab holding `initialId` (the dock's Expand), else friends. */
  const [pickedTab, setTab] = useState<HubTab | null>(initialTab ?? null)
  const [selectedId, setSelectedId] = useState(initialId ?? null)
  const [query, setQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(!!initialId)
  const [pane, setPane] = useState<Pane>('messages')

  const signedIn = !!panel
  useEffect(() => {
    if (signedIn) loadChats()
  }, [signedIn, loadChats])


  if (panel === undefined) return <Masthead><p className={twMerge(MICRO_LABEL, "pb-2")}>Loading…</p></Masthead>

  if (panel === null) {
    return (
      <Masthead>
        <div className="flex flex-wrap items-center gap-4 pb-1.5">
          <p className="text-ink-dim body-sm">Sign in to see your friends, rivals and messages.</p>
          <Button variant="discord" size="sm" onClick={signIn}>
            <Icon aria-hidden className="text-xl" icon="bi:discord" />
            Login
          </Button>
        </div>
      </Masthead>
    )
  }

  const tab = pickedTab ?? panel.roster.find((entry) => entry.id === initialId)?.kind ?? 'friend'
  const friends = panel.roster.filter((entry) => entry.kind === 'friend')
  const rivals = panel.roster.filter((entry) => entry.kind === 'rival')
  const chatById = new Map(chats?.map((chat) => [chat.id, chat]))
  const needle = query.trim().toLowerCase()
  const list = (tab === 'rival' ? rivals : friends).filter((entry) =>
    !needle || [contactName(entry), entry.displayName, entry.username].join(' ').toLowerCase().includes(needle))
  const selected = panel.roster.find((entry) => entry.id === selectedId)
  const drawerOpen = isDrawerOpen && !!selected

  const select = (id: string) => {
    setSelectedId(id)
    setPane('messages')
    setIsDrawerOpen(true)
  }

  return (
    <>
      <Masthead>
        <div className="flex gap-5.5 pb-2">
          <Stat label="Friends" value={friends.length} className="text-cyan" />
          <Stat label="Rivals" value={rivals.length} className="text-indigo-lift" />
          <Stat label="Unread" value={messenger.unreadChats} className="text-ink-muted" />
        </div>
      </Masthead>

      <YouStrip me={panel.me} messenger={messenger} />

      <section className="grid grid-cols-1 border-b border-line-strong lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[38.75rem] xl:grid-cols-[360px_minmax(0,1fr)_330px]">
        <div className="flex min-h-0 min-w-0 flex-col lg:border-r lg:border-line">
          <div className="flex shrink-0 border-b border-line">
            <button type="button" aria-pressed={tab === 'friend'} onClick={() => setTab('friend')} className={tabClass(tab === 'friend')}>
              Friends {friends.length}
            </button>
            <button type="button" aria-pressed={tab === 'rival'} onClick={() => setTab('rival')} className={tabClass(tab === 'rival')}>
              Rivals {rivals.length}
            </button>
            <button type="button" aria-pressed={tab === 'requests'} onClick={() => setTab('requests')} className={tabClass(tab === 'requests')}>
              Requests{panel.incomingRequests ? <span className="ml-1.5 bg-cyan px-1.5 py-0.5 text-cyan-on signal-count">{panel.incomingRequests}</span> : null}
            </button>
          </div>

          {tab === 'requests' ? <Requests messenger={messenger} /> : (
            <>
              <label className="shrink-0 border-b border-line px-3.5 py-3">
                <span className="sr-only">Search duelists</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, nickname or handle"
                  className="w-full border border-surface-400 bg-surface-200 px-2.75 py-2.25 text-[13px] text-ink placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
                />
              </label>

              {list.length ? (
                <ul className="min-h-0 flex-1 overflow-y-auto">
                  {list.map((entry) => {
                    const presence = PRESENCE[entry.presence]
                    const unread = chatById.get(entry.id)?.unread ?? 0
                    const isActive = entry.id === selected?.id
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          aria-current={isActive || undefined}
                          onClick={() => select(entry.id)}
                          className={twMerge(
                            "group flex w-full cursor-pointer items-center gap-2.75 border-b border-line px-3.5 py-3 text-left hover:bg-surface-300",
                            isActive && "bg-surface-200 shadow-selected",
                          )}
                        >
                          <span aria-hidden className={twMerge("size-2.5 shrink-0", presence.dot)} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.75">
                              <span className="truncate text-sm font-bold text-ink">{contactName(entry)}</span>
                              <span className="whitespace-nowrap text-ink-muted mono-handle group-hover:text-ink-dim">{contactHandle(entry)}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-ink-muted micro group-hover:text-ink-dim">{preview(entry, chatById.get(entry.id))}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1.25">
                            {unread ? (
                              <span className="min-w-5 bg-cyan px-1.5 py-0.5 text-center text-cyan-on signal-count">
                                {unread}<span className="sr-only"> unread</span>
                              </span>
                            ) : null}
                            <span className="font-mono text-[9px] tracking-[.1em] whitespace-nowrap text-ink-muted uppercase group-hover:text-ink-dim">{presence.short}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="flex-1 px-5 py-8.5 text-center">
                  <span aria-hidden className={twMerge("inline-block size-2.5", EMPTY[tab].mark)} />
                  <p className="mt-3.5 text-ink display-6">{needle ? 'No match' : EMPTY[tab].title}</p>
                  <p className="mx-auto mt-2 max-w-[30ch] text-ink-muted caption">
                    {needle ? `Nobody on this list matches “${query.trim()}”.` : EMPTY[tab].body}
                  </p>
                </div>
              )}

              <p className="shrink-0 border-t border-line px-3.5 py-2.75 text-ink-muted signal-nav text-[10px]">
                {list.length ? `${list.length} ${tab === 'friend' ? 'friends' : 'rivals'}, sorted by presence` : 'Nothing to show'}
              </p>
            </>
          )}
        </div>

        {/* Below lg the conversation and settings open as one drawer; from lg up the wrapper dissolves into the grid. */}
        <div
          role={drawerOpen ? 'dialog' : undefined}
          aria-label={selected ? contactName(selected) : undefined}
          className={twMerge(
            "max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-(--z-scrim) max-lg:flex max-lg:w-[min(420px,92vw)] max-lg:flex-col max-lg:border-l max-lg:border-line-strong max-lg:bg-surface-100 lg:contents",
            !drawerOpen && "max-lg:hidden",
          )}
        >
          <div className="shrink-0 border-b border-line bg-ground-soft lg:hidden">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-ink-muted signal">
                {selected ? contactName(selected) : ''}
              </span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex min-h-8 cursor-pointer items-center gap-2 border border-surface-400 px-2.75 text-ink signal-nav text-[10px] hover:bg-ink hover:text-ink-on"
              >
                Close <span aria-hidden className="text-[13px] font-bold">×</span>
              </button>
            </div>
            <div className="flex border-t border-line">
              <button type="button" aria-pressed={pane === 'messages'} onClick={() => setPane('messages')} className={tabClass(pane === 'messages')}>
                Messages
              </button>
              <button type="button" aria-pressed={pane === 'settings'} onClick={() => setPane('settings')} className={tabClass(pane === 'settings')}>
                Duelist settings
              </button>
            </div>
          </div>

          <div className={twMerge("flex min-h-0 min-w-0 flex-col max-lg:flex-1", pane !== 'messages' && "max-lg:hidden")}>
            {selected ? <Conversation contact={selected} messenger={messenger} /> : (
              <div className="flex min-h-105 flex-1 flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
                <span aria-hidden className="size-2.5 bg-cyan" />
                <p className="mt-2 text-ink display-6">Pick a duelist</p>
                <p className="max-w-[38ch] text-ink-muted body-sm">
                  Select someone from the list to read your conversation and manage the relationship.
                </p>
              </div>
            )}
          </div>

          <aside
            className={twMerge(
              "min-w-0 overflow-y-auto border-line max-lg:min-h-0 max-lg:flex-1 lg:col-span-full lg:border-t xl:col-span-1 xl:border-t-0 xl:border-l",
              pane !== 'settings' && "max-lg:hidden",
            )}
          >
            {selected ? (
              <ContactSettings key={selected.id} contact={selected} messenger={messenger} onKindChange={setTab} />
            ) : (
              <div className="px-5 py-5.5">
                <p className={MICRO_LABEL}>Manage</p>
                <p className="mt-2.5 text-ink-muted caption">
                  Nickname, private note, friend or rival, block and remove all live here once a duelist is selected.
                </p>
              </div>
            )}
          </aside>
        </div>

        {drawerOpen ? <button type="button" aria-label="Close" onClick={() => setIsDrawerOpen(false)} className="fixed inset-0 z-(--z-scrim) cursor-pointer bg-scrim lg:hidden" /> : null}
      </section>
    </>
  )
}
