'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Avatar, type Status } from '@ui/avatar'
import { Button } from '@ui/button'
import { FIELD } from '@ui/field'
import { Icon } from '@ui/icon'

/** Wraps ConversationRows in one bordered list. */
export const ConversationList = ({ label = 'Conversations', className, children }: { label?: string; className?: string; children: React.ReactNode }) => (
  <div role="listbox" aria-label={label} className={twMerge('border border-line bg-surface-100', className)}>
    {children}
  </div>
)

type ConversationRowProps = {
  name: string
  /** Your own last message starts with "You: ". */
  last: React.ReactNode
  time: React.ReactNode
  avatar?: string | null
  status?: Status
  unread?: number
  /** The open conversation: ground-cyan and a 2px cyan bar. */
  selected?: boolean
  onClick?: () => void
}

/** One conversation: avatar with presence, name, last line, mono time, unread count. */
export const ConversationRow = ({ name, last, time, avatar, status, unread, selected, onClick }: ConversationRowProps) => (
  <div
    role="option"
    tabIndex={0}
    aria-selected={!!selected}
    onClick={onClick}
    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick?.())}
    className={twMerge(
      'flex min-w-0 cursor-pointer items-center gap-3 border-b border-line px-4 py-3 text-ink-dim last:border-b-0 focus-visible:shadow-focus-ring focus-visible:outline-none',
      selected ? 'bg-ground-cyan shadow-selected' : 'bg-surface-100 hover:bg-surface-300',
    )}
  >
    <Avatar name={name} src={avatar} status={status} />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className="truncate font-bold text-ink">{name}</span>
        <span className="ml-auto font-mono text-[10px] leading-3 tracking-[0.1em] whitespace-nowrap text-ink-muted">{time}</span>
      </div>
      <div className={twMerge('truncate body-sm', unread && 'font-bold text-ink')}>{last}</div>
    </div>
    {unread ? (
      <span aria-label={`${unread} unread`} className="inline-grid h-4.5 min-w-4.5 place-items-center bg-cyan px-1.25 font-mono text-[10px] leading-none font-bold text-cyan-on">
        {unread}
      </span>
    ) : null}
  </div>
)

/** Mono day mark between groups of bubbles. */
export const DayMark = ({ children }: { children: React.ReactNode }) => (
  <div className="my-2 flex items-center gap-3 text-ink-muted signal-sm before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
    {children}
  </div>
)

type MessageBubbleProps = {
  /** Yours: steel, bottom-right cut, right-aligned. Theirs: surface-200, bottom-left cut. */
  mine?: boolean
  time?: React.ReactNode
  /** A shared deck shows as an attachment row, never a deck code. */
  deck?: React.ReactNode
  children: React.ReactNode
}

/** A chat message, at most 72% wide. */
export const MessageBubble = ({ mine, time, deck, children }: MessageBubbleProps) => (
  <div className={twMerge('max-w-[72%] px-3.5 py-2.5 text-sm leading-5.25 text-ink', mine ? 'bubble-cut-mine self-end bg-steel' : 'bubble-cut self-start bg-surface-200')}>
    {children}
    {deck ? (
      <div className="mt-1.5 flex items-center gap-2 bg-space-000/50 px-2.5 py-2 text-[13px]">
        <Icon name="deck" size={16} className="text-cyan" />
        <b>{deck}</b>
      </div>
    ) : null}
    {time ? <span className={twMerge('mt-1 block font-mono text-[10px] leading-3 tracking-[0.08em]', mine ? 'text-right text-ink-dim' : 'text-ink-muted')}>{time}</span> : null}
  </div>
)

type ComposerProps = {
  onSend: (text: string) => void
  onShareDeck?: () => void
  /** Names the recipient: "Message godoka". */
  placeholder?: string
}

/** The input bar under a thread: share a deck, the field, a primary square Send. Enter sends. */
export const Composer = ({ onSend, onShareDeck, placeholder = 'Message' }: ComposerProps) => {
  const [text, setText] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        onSend(text)
        setText('')
      }}
      className="flex items-center gap-2 border border-line bg-surface-100 p-3"
    >
      {onShareDeck ? (
        <Button variant="ghost" size="icon" aria-label="Share a deck" onClick={onShareDeck}>
          <Icon name="deck" />
        </Button>
      ) : null}
      <label className={twMerge(FIELD, 'min-w-0 flex-1')}>
        <span className="sr-only">Message</span>
        <input value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} className="min-w-0 flex-1 bg-transparent text-ink body outline-none placeholder:text-ink-muted" />
      </label>
      <Button type="submit" size="icon" aria-label="Send">
        <Icon name="send" />
      </Button>
    </form>
  )
}
