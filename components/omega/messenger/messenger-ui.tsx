'use client'

/**
 * The Messenger page and dock, ported from the Omega Hub design bundle
 * (https://claude.ai/artifact/LVYHG1jb949H7GYT4ikJYw, MessengerPage / MessengerDock) and wired to
 * the real API through `useMessenger`. Class names and markup follow the bundle one to one; the
 * styles live in ./messenger.css.
 */

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatBubble } from "@omega/bubble";
import { AvatarFrame } from "@ui/avatar";
import { bubbleOf } from "@utils/bubble";
import { mergeMessages, messenger as api, MessengerApiError } from "@utils/messenger";
import type {
  BlockedDuelist,
  ChatMessage,
  ChatPage,
  ChatSummary,
  ChosenPresence,
  Cosmetics,
  Identity,
  Presence,
  Relation,
  Requests,
  RosterEntry,
  Song,
} from "@utils/types";
import { useMessenger, type Messenger } from "./use-messenger";
import "./messenger.css";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ")

/* ---------- Icon ---------- */
const PATHS = {
  close: "M5.3 3.9 12 10.6l6.7-6.7 1.4 1.4-6.7 6.7 6.7 6.7-1.4 1.4-6.7-6.7-6.7 6.7-1.4-1.4 6.7-6.7-6.7-6.7z",
  search: "M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  chat: "M4 4h16v12H9l-5 4z",
  mail: "M2 5h20v14H2zm2 2v.6l8 5.4 8-5.4V7zm16 3-8 5.4L4 10v7h16z",
  user: "M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm-8 18c0-4 3.6-7 8-7s8 3 8 7z",
  host: "M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM2 20c0-3.5 3.1-6 7-6s7 2.5 7 6zM18 7h2v3h3v2h-3v3h-2v-3h-3v-2h3z",
  send: "M3 20.5V14l9-2-9-2V3.5L22 12z",
  down: "M5 9l1.4-1.4 5.6 5.6 5.6-5.6L19 9l-7 7z",
  right: "M9 5l7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6z",
  left: "M15 5l1.4 1.4-5.6 5.6 5.6 5.6L15 19l-7-7z",
  up: "M5 15l1.4 1.4 5.6-5.6 5.6 5.6L19 15l-7-7z",
  more: "M10 4h4v4h-4zm0 6h4v4h-4zm0 6h4v4h-4z",
  minus: "M4 11h16v2H4z",
  expand: "M4 4h7v2H6v12h12v-5h2v7H4zm10 0h6v6h-2V7.4l-6.3 6.3-1.4-1.4L16.6 6H14z",
  music: "M8 5l12-2v12.5a3 3 0 1 1-2-2.83V5.4l-8 1.33v11.77a3 3 0 1 1-2-2.83z",
  block: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM5.99 7.41 7.41 5.99 18.01 16.59 16.59 18.01z",
  edit: "M16 3l5 5L9.5 19.5 4 20l.5-5.5z",
  refresh: "M12 4a8 8 0 0 1 7.3 4.7L21 7v6h-6l2.6-2.6A6 6 0 1 0 18 13h2a8 8 0 1 1-8-9z",
  check: "M9.5 16.2 4.8 11.5l-1.4 1.4 6.1 6.1L21 7.5l-1.4-1.4z",
  swap: "M7 3l1.4 1.4L6.8 6H20v2H6.8l1.6 1.6L7 11 3 7zm10 10 4 4-4 4-1.4-1.4 1.6-1.6H4v-2h13.2l-1.6-1.6z",
}
type IconName = keyof typeof PATHS

export const Icon = ({ name, size, className }: { name: IconName; size?: number; className?: string }) => (
  <svg className={cx("oh-icon", className)} viewBox="0 0 24 24" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
    <path d={PATHS[name]} fillRule="evenodd" />
  </svg>
)

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
  icon?: IconName
  iconOnly?: boolean
  /** Renders a link. */
  href?: string
}
export const Button = ({ variant = "secondary", size = "md", icon, iconOnly, href, className, children, type, ...rest }: ButtonProps) => {
  const cls = cx("oh-cut oh-btn", variant !== "secondary" && `oh-btn-${variant}`, size !== "md" && `oh-btn-${size}`, iconOnly && "oh-btn-icon", className)
  const label = rest["aria-label"] ?? (iconOnly ? (typeof children === "string" ? children : icon) : undefined)
  const inner = <>{icon ? <Icon name={icon} /> : null}{iconOnly ? null : children}</>
  if (href) return <Link href={href} className={cls} aria-label={label}>{inner}</Link>
  return <button type={type ?? "button"} {...rest} className={cls} aria-label={label}>{inner}</button>
}

/* ---------- Tabs / ModeTabs / Eyebrow / SearchField / Chip ---------- */
type TabItem<T extends string> = { id: T; label: string; count?: number | null }
function Tabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="oh-tabs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" className="oh-tab" aria-selected={it.id === value} onClick={() => onChange(it.id)}>
          {it.label}{it.count != null ? <span className="oh-count">{it.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
function ModeTabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="oh-segs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={it.id === value} className="oh-cut oh-seg" onClick={() => onChange(it.id)}>{it.label}</button>
      ))}
    </div>
  )
}
export const Eyebrow = ({ tone = "gold", children }: { tone?: "gold" | "cyan"; children: ReactNode }) => (
  <div className={cx("oh-eyebrow", tone !== "gold" && `oh-eyebrow-${tone}`)}>
    <span className="oh-eyebrow-sq" aria-hidden="true" />
    <span className="oh-eyebrow-label">{children}</span>
    <span className="oh-eyebrow-rule" aria-hidden="true" />
  </div>
)
const SearchField = ({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <label className="oh-cut oh-field">
    <Icon name="search" size={16} />
    <span className="oh-sr">{label || props.placeholder || "Search"}</span>
    <input type="search" {...props} />
  </label>
)
const Chip = ({ tone, children }: { tone: Relation; children: ReactNode }) => <span className={`oh-cut oh-chip oh-chip-${tone}`}>{children}</span>

/* ---------- Avatar / Presence ---------- */
type Status = Presence | ChosenPresence
const PRES: Record<Status, string> = { ready: "Ready to Duel", online: "Online", away: "Away", busy: "Busy", offline: "Offline", invisible: "Appear offline" }
const presKey = (s?: Status | null): Status => (s && PRES[s] ? s : "offline")

const PresenceDot = ({ status, showLabel }: { status: Status; showLabel?: boolean }) => {
  const s = presKey(status), cls = `oh-presence oh-presence-${s === "invisible" ? "offline" : s}`
  if (showLabel) return <span className="oh-presence-label"><span className={cls} aria-hidden="true" />{PRES[s]}</span>
  return <span className={cls} role="img" aria-label={PRES[s]} />
}
export const Avatar = ({ name, src, size = "md", status, cosmetics }: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; status?: Status | null; cosmetics?: Cosmetics | null }) => {
  const initials = (name || "?").replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"
  const px = size === "sm" ? "28px" : size === "lg" ? "64px" : "40px"
  return (
    <span className={cx("oh-avatar", size !== "md" && `oh-avatar-${size}`)}>
      {src ? <Image src={src} alt={name} fill sizes={px} /> : <span className="oh-avatar-fallback" role="img" aria-label={name}>{initials}</span>}
      <AvatarFrame cosmetics={cosmetics} />
      {status ? <PresenceDot status={status} /> : null}
    </span>
  )
}

/* ---------- time: 24-hour clock, short dates ---------- */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const pad2 = (n: number) => (n < 10 ? "0" : "") + n
const hm = (d: Date) => pad2(d.getHours()) + ":" + pad2(d.getMinutes())
const dayDiff = (a: Date, b: Date) =>
  Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 864e5)
const shortWhen = (iso: string, now: string) => {
  const d = new Date(iso), dd = dayDiff(d, new Date(now))
  if (dd <= 0) return hm(d)
  if (dd === 1) return "Yesterday"
  if (dd < 7) return DAYS[d.getDay()]
  return d.getDate() + " " + MONTHS[d.getMonth()]
}
const dayLabel = (iso: string, now: string) => {
  const d = new Date(iso), dd = dayDiff(d, new Date(now))
  if (dd <= 0) return "Today"
  if (dd === 1) return "Yesterday"
  return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]
}
const ago = (iso: string, now: string) => {
  const m = Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 6e4))
  if (m < 1) return "just now"
  if (m < 60) return m + " min ago"
  if (m < 24 * 60) return Math.round(m / 60) + " h ago"
  return shortWhen(iso, now)
}
const ytId = (url: string) => {
  try {
    const u = new URL(url.trim()), host = u.hostname.replace(/^(www|m)\./, "")
    if (u.protocol !== "https:" && u.protocol !== "http:") return null
    let id: string | null = null
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null
    else if ((host === "youtube.com" || host === "music.youtube.com") && u.pathname === "/watch") id = u.searchParams.get("v")
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/* ---------- names ---------- */
type Named = { nickname?: string | null; displayName?: string | null; username?: string | null }
const nameOf = (x: Named | null | undefined) => (x ? x.nickname || x.displayName || x.username || "Unknown duelist" : "")
const handleOf = (x: Named) => (x.username ? "@" + x.username : "")
const isVisible = (s?: Status | null) => !!s && s !== "offline" && s !== "invisible"
const portal = (node: ReactNode) => createPortal(node, document.body)

/* ---------- Menu ---------- */
type MenuItem = { label?: string; icon?: IconName; dot?: Status; hint?: string; tone?: "danger"; checked?: boolean; divider?: boolean; onSelect?: () => void }
type Trigger = { open: boolean; props: { "aria-haspopup": "menu"; "aria-expanded": boolean; onClick: (e: { currentTarget: Element }) => void } }

const Menu = ({ items, label, title, align, trigger }: { items: (MenuItem | null | false)[]; label?: string; title?: string; align?: "left" | "right"; trigger?: (t: Trigger) => ReactNode }) => {
  const anchor = useRef<HTMLSpanElement>(null), pop = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const open = style !== null
  const list = items.filter((it): it is MenuItem => !!it)

  const place = (el: Element | null | undefined): CSSProperties | null => {
    if (!el) return null
    const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight
    const up = vh - r.bottom < 260 && r.top > vh - r.bottom
    const s: CSSProperties = { position: "fixed" }
    if (align === "left" || r.right < 296) s.left = Math.max(8, Math.min(r.left, vw - 288))
    else s.right = Math.max(8, vw - r.right)
    if (up) s.bottom = vh - r.top + 6
    else s.top = r.bottom + 6
    return s
  }
  const toggle = (e: { currentTarget: Element }) => setStyle(open ? null : place(e.currentTarget.closest(".oh-menu-anchor")))

  useEffect(() => {
    if (!open) return
    const first = pop.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? pop.current?.querySelector<HTMLElement>("[role^=menuitem]")
    first?.focus()
    const onDown = (e: MouseEvent) => {
      if (pop.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node)) return
      setStyle(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setStyle(null)
      anchor.current?.querySelector("button")?.focus()
    }
    const onScroll = (e: Event) => { if (!pop.current?.contains(e.target as Node)) setStyle(null) }
    const onResize = () => setStyle(place(anchor.current))
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("resize", onResize)
    document.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("scroll", onScroll, true)
    }
    // place reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onKeyDown = (e: KeyboardEvent) => {
    const els = pop.current ? Array.from(pop.current.querySelectorAll<HTMLElement>("[role^=menuitem]")) : []
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
    else if (e.key === "Home") { e.preventDefault(); els[0]?.focus() }
    else if (e.key === "End") { e.preventDefault(); els[els.length - 1]?.focus() }
    else if (e.key === "Tab") setStyle(null)
  }

  const t: Trigger = { open, props: { "aria-haspopup": "menu", "aria-expanded": open, onClick: toggle } }
  return (
    <span className="oh-menu-anchor" ref={anchor}>
      {trigger ? trigger(t) : <Button variant="ghost" size="sm" iconOnly icon="more" aria-label={label || "More actions"} {...t.props} />}
      {style ? portal(
        <div className="oh-cut oh-menu" role="menu" aria-label={label || "Actions"} ref={pop} style={style} onKeyDown={onKeyDown}>
          {title ? <div className="oh-menu-title">{title}</div> : null}
          {list.map((it, i) => {
            if (it.divider) return <div key={"d" + i} className="oh-menu-sep" role="separator" />
            const radio = it.checked !== undefined
            return (
              <button
                key={i}
                type="button"
                role={radio ? "menuitemradio" : "menuitem"}
                aria-checked={radio ? !!it.checked : undefined}
                tabIndex={-1}
                className={cx("oh-menu-item", it.tone === "danger" && "is-danger")}
                onClick={() => { setStyle(null); it.onSelect?.() }}
              >
                {it.dot ? <PresenceDot status={it.dot} /> : it.icon ? <Icon name={it.icon} size={16} /> : null}
                <span className="oh-menu-text"><span>{it.label}</span>{it.hint ? <small>{it.hint}</small> : null}</span>
                {radio && it.checked ? <Icon name="check" size={16} className="oh-menu-check" /> : null}
              </button>
            )
          })}
        </div>,
      ) : null}
    </span>
  )
}

/* ---------- PresencePicker / StatusInput / SongLine / MeCard ---------- */
const CHOICES: { id: ChosenPresence; label: string; hint: string }[] = [
  { id: "ready", label: "Ready to Duel", hint: "Ready now; Online, then Away as you idle" },
  { id: "busy", label: "Busy", hint: "Stays Busy however long you idle" },
  { id: "invisible", label: "Appear offline", hint: "You look offline to everyone. You can still chat" },
]
const PresencePicker = ({ value, onChange }: { value: ChosenPresence; onChange: (v: ChosenPresence) => void }) => (
  <Menu
    label="Your presence"
    align="left"
    title="Show me as"
    trigger={(t) => (
      <button type="button" className="oh-cut oh-picker" aria-label={"Presence: " + PRES[value]} {...t.props}>
        <PresenceDot status={value} showLabel />
        <Icon name="down" size={14} />
      </button>
    )}
    items={CHOICES.map((c) => ({ label: c.label, hint: c.hint, dot: c.id, checked: c.id === value, onSelect: () => { if (c.id !== value) onChange(c.id) } }))}
  />
)

/** 70 chars, saves on blur or Enter, Escape reverts. The draft only exists while focused. */
const StatusInput = ({ value, onSave, maxLength = 70 }: { value: string | null; onSave: (v: string | null) => void; maxLength?: number }) => {
  const [draft, setDraft] = useState<string | null>(null)
  const cancel = useRef(false)
  const focused = draft !== null
  const shown = focused ? draft : value || ""
  const commit = () => {
    const next = (draft ?? "").trim() || null
    setDraft(null)
    if (cancel.current) { cancel.current = false; return }
    if ((value || null) !== next) onSave(next)
  }
  return (
    <label className={cx("oh-cut oh-status-in", focused && "is-focus")}>
      <span className="oh-sr">Status message</span>
      <input
        value={shown}
        maxLength={maxLength}
        placeholder="Set a status message"
        onFocus={() => setDraft(value || "")}
        onBlur={commit}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") { cancel.current = true; e.currentTarget.blur() }
        }}
      />
      {focused ? <span className="oh-status-count" aria-hidden="true">{maxLength - shown.length}</span> : null}
    </label>
  )
}

const SongLine = ({ song, editable, onSave }: { song: Song | null; editable?: boolean; onSave?: (url: string | null) => Promise<unknown> | void }) => {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = (e: FormEvent) => {
    e.preventDefault()
    const link = url.trim()
    if (!ytId(link)) { setError("Paste a YouTube video link: youtube.com/watch, music.youtube.com or youtu.be"); return }
    setError(null)
    setBusy(true)
    Promise.resolve(onSave?.(link)).then(
      () => { setBusy(false); setEditing(false); setUrl("") },
      () => { setBusy(false); setError("YouTube didn't accept that link. Try another.") },
    )
  }
  if (editing) return (
    <form className="oh-song-edit" onSubmit={save}>
      <label className="oh-cut oh-field">
        <Icon name="music" size={16} />
        <span className="oh-sr">YouTube link</span>
        <input value={url} autoFocus placeholder="Paste a YouTube link" onChange={(e) => { setUrl(e.target.value); setError(null) }} onKeyDown={(e) => { if (e.key === "Escape") setEditing(false) }} />
      </label>
      <div className="oh-row" style={{ gap: "var(--space-2)" }}>
        <Button type="submit" size="sm" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setError(null) }}>Cancel</Button>
        {song ? <Button size="sm" variant="ghost" onClick={() => { setEditing(false); onSave?.(null) }}>Remove song</Button> : null}
      </div>
      {error ? <p className="oh-song-err" role="alert">{error}</p> : null}
    </form>
  )
  const body = song
    ? <a className="oh-song" href={"https://youtu.be/" + song.videoId} target="_blank" rel="noreferrer"><Icon name="music" size={14} /><span>{song.title || "Unknown title"}</span></a>
    : editable ? <span className="oh-song is-empty"><Icon name="music" size={14} /><span>No song</span></span> : null
  return (
    <div className="oh-song-line">
      {body}
      {editable ? <button type="button" className="oh-linkbtn" onClick={() => setEditing(true)}>{song ? "Change" : "Add a song"}</button> : null}
    </div>
  )
}

type Me = Identity & { presence: ChosenPresence; status: string | null; song: Song | null }
const MeCard = ({ me, compact, m }: { me: Me; compact?: boolean; m: MessengerView }) => (
  <section className={cx("oh-me", compact && "is-compact")} aria-label="You">
    <div className="oh-me-top">
      <Avatar name={nameOf(me)} src={me.avatar} cosmetics={me.cosmetics} size={compact ? "md" : "lg"} status={me.presence === "invisible" ? "offline" : me.presence} />
      <div className="oh-me-id">
        <span className="oh-me-name">{nameOf(me)}</span>
        <PresencePicker value={me.presence} onChange={m.setPresence} />
      </div>
    </div>
    <StatusInput value={me.status} onSave={m.setStatus} />
    <SongLine song={me.song} editable onSave={m.setSong} />
  </section>
)

/* ---------- ContactRow / ContactEditor / RequestRow ---------- */
const ContactRow = ({ entry: e, unread, selected, onOpen, menu }: { entry: RosterEntry; unread?: number; selected?: boolean; onOpen: () => void; menu: (MenuItem | null)[] }) => {
  const off = !isVisible(e.presence)
  const sub = off ? PRES.offline : e.status || PRES[presKey(e.presence)]
  return (
    <div className={cx("oh-contact", off && "is-off", selected && "is-selected")} role="listitem">
      <button type="button" className="oh-contact-hit" onClick={onOpen} aria-current={selected ? "true" : undefined} aria-label={nameOf(e) + ", " + PRES[presKey(e.presence)] + (unread ? ", " + unread + " unread" : "")}>
        <Avatar name={nameOf(e)} src={e.avatar} cosmetics={e.cosmetics} status={e.presence} />
        <span className="oh-contact-main">
          <span className="oh-contact-top">
            <span className="oh-contact-name">{nameOf(e)}</span>
            {e.nickname && e.username ? <span className="oh-contact-handle">{handleOf(e)}</span> : null}
          </span>
          <span className={cx("oh-contact-sub", !off && e.status && "is-status")}>{sub}</span>
          {!off && e.song ? <span className="oh-contact-song"><Icon name="music" size={12} /><span>{e.song.title || "Unknown title"}</span></span> : null}
        </span>
        {unread ? <span className="oh-unread">{unread}</span> : null}
      </button>
      <Menu label={"Actions for " + nameOf(e)} items={menu} />
    </div>
  )
}

/** Nickname 32, note 200. Private to the viewer. */
const ContactEditor = ({ entry: e, onSave, onCancel }: { entry: RosterEntry; onSave: (v: { nickname: string | null; note: string | null }) => void; onCancel: () => void }) => {
  const [nickname, setNickname] = useState(e.nickname || "")
  const [note, setNote] = useState(e.note || "")
  return (
    <form className="oh-editor" onSubmit={(ev) => { ev.preventDefault(); onSave({ nickname: nickname.trim() || null, note: note.trim() || null }) }} aria-label={"Nickname and note for " + (e.displayName || e.username)}>
      <div className="oh-editor-title">Private to you</div>
      <label>
        <span className="oh-field-label">Nickname</span>
        <span className="oh-cut oh-field">
          <input value={nickname} maxLength={32} autoFocus placeholder={e.displayName || e.username || ""} onChange={(x) => setNickname(x.target.value)} />
          <span className="oh-field-count">{32 - nickname.length}</span>
        </span>
      </label>
      <label>
        <span className="oh-field-label">Note</span>
        <span className="oh-cut oh-field oh-field-area">
          <textarea value={note} maxLength={200} rows={3} placeholder="Deck, habits, where you met" onChange={(x) => setNote(x.target.value)} />
          <span className="oh-field-count">{200 - note.length}</span>
        </span>
      </label>
      <div className="oh-row" style={{ gap: "var(--space-2)" }}>
        <Button type="submit" size="sm" variant="primary">Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

type Incoming = Requests["incoming"][number]
type Outgoing = Requests["outgoing"][number]
const RequestRow = ({ request: r, direction, now, onAccept, onDecline, onBlock, onCancel, onChangeKind }: {
  request: Incoming | Outgoing; direction: "incoming" | "outgoing"; now: string
  onAccept?: (kind: Relation) => void; onDecline?: () => void; onBlock?: () => void; onCancel?: () => void; onChangeKind?: (kind: Relation) => void
}) => {
  const incoming = direction !== "outgoing", nm = r.displayName || r.username || "Unknown duelist"
  const kind = "kind" in r ? r.kind : null
  return (
    <div className="oh-request" role="listitem">
      <div className="oh-request-top">
        <Avatar name={nm} src={r.avatar} cosmetics={r.cosmetics} />
        <div className="oh-contact-main">
          <span className="oh-contact-top"><span className="oh-contact-name">{nm}</span>{r.username ? <span className="oh-contact-handle">@{r.username}</span> : null}</span>
          <span className="oh-contact-sub">{(incoming ? "Wants to add you" : "Request sent") + (r.requestedAt ? " · " + ago(r.requestedAt, now) : "")}</span>
        </div>
        {kind ? <Chip tone={kind}>{kind === "rival" ? "Rival" : "Friend"}</Chip> : null}
        <Menu
          label={"More for " + nm}
          items={incoming
            ? [{ label: "Decline", icon: "close", onSelect: onDecline }, { label: "Block", icon: "block", tone: "danger", onSelect: onBlock }]
            : [{ label: kind === "rival" ? "Change to friend" : "Change to rival", icon: "swap", onSelect: () => onChangeKind?.(kind === "rival" ? "friend" : "rival") }, { label: "Cancel request", icon: "close", onSelect: onCancel }]}
        />
      </div>
      {incoming ? (
        <div className="oh-request-acts" role="group" aria-label={"Accept " + nm + " as"}>
          <span className="oh-request-label">Accept as</span>
          <Button size="sm" onClick={() => onAccept?.("friend")}>Friend</Button>
          <Button size="sm" onClick={() => onAccept?.("rival")}>Rival</Button>
        </div>
      ) : null}
    </div>
  )
}

/* ---------- ChatThread / Composer / ChatWindow ---------- */
type Bubble = ReturnType<typeof bubbleOf>
/** The sender's equipped MSGBUBBLE when they have one, the messenger's own style otherwise. */
const MessageBubble = ({ mine, time, bubble, children }: { mine: boolean; time: string; bubble: Bubble; children: ReactNode }) =>
  bubble ? (
    <ChatBubble style={bubble.style} sticker={bubble.sticker} mine={mine}>{children}<span className="oh-bubble-meta">{time}</span></ChatBubble>
  ) : (
    <div className={cx("oh-bubble", mine && "is-mine")}>{children}<span className="oh-bubble-meta">{time}</span></div>
  )

/** Plain text, 1–1000 chars, newlines kept. Enter sends, Shift+Enter breaks the line. */
const Composer = ({ onSend, placeholder, locked, autoFocus, maxLength = 1000 }: { onSend: (text: string) => Promise<unknown>; placeholder: string; locked?: boolean; autoFocus?: boolean; maxLength?: number }) => {
  const [value, setValue] = useState("")
  const ta = useRef<HTMLTextAreaElement>(null)
  const can = value.trim().length > 0 && value.length <= maxLength
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 132) + "px"
  }, [value])
  useEffect(() => { if (autoFocus) ta.current?.focus({ preventScroll: true }) }, [autoFocus])
  if (locked) return (
    <div className="oh-composer is-locked" role="status"><Icon name="block" size={16} /><span>You can only message friends and rivals</span></div>
  )
  const send = (e?: SyntheticEvent) => {
    e?.preventDefault()
    if (!can) return
    const text = value
    setValue("")
    // Put the text back if it didn't go through.
    onSend(text).catch(() => setValue((current) => current || text))
  }
  return (
    <form className="oh-composer" onSubmit={send}>
      <label className="oh-cut oh-field oh-field-area">
        <span className="oh-sr">Message</span>
        <textarea
          ref={ta}
          rows={1}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e) }}
        />
        {value.length > maxLength - 200 ? <span className="oh-field-count">{value.length}/{maxLength}</span> : null}
      </label>
      <Button type="submit" variant="primary" iconOnly icon="send" aria-label="Send" disabled={!can} />
    </form>
  )
}

/** Messages come newest first (API order) and render oldest first with day marks and an "N new" rule. */
const ChatThread = ({ messages, nextCursor, onLoadOlder, loadingOlder, newCount, now, peerName, peerId, myBubble, peerBubble }: {
  messages: ChatMessage[]; nextCursor: string | null; onLoadOlder: (cursor: string) => void; loadingOlder?: boolean; newCount?: number; now: string; peerName: string; peerId: string
  myBubble: Bubble; peerBubble: Bubble
}) => {
  const box = useRef<HTMLDivElement>(null), anchor = useRef<number | null>(null)
  const list = messages.slice().reverse()
  const newestId = list.at(-1)?.id ?? null, oldestId = list[0]?.id ?? null
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    if (anchor.current != null) { el.scrollTop = el.scrollHeight - anchor.current; anchor.current = null }
    else el.scrollTop = el.scrollHeight
  }, [newestId, oldestId, peerId])
  let newAt = -1
  if (newCount && newCount > 0) {
    let c = 0
    for (let i = list.length - 1; i >= 0; i--) if (!list[i]?.mine && ++c === newCount) { newAt = i; break }
  }
  const rows: ReactNode[] = []
  let lastDay: string | null = null
  list.forEach((m, i) => {
    const d = new Date(m.createdAt), k = d.toDateString()
    if (k !== lastDay) { rows.push(<div key={"d" + k} className="oh-daymark">{dayLabel(m.createdAt, now)}</div>); lastDay = k }
    if (i === newAt) rows.push(<div key="new" className="oh-newmark">{newCount} new</div>)
    rows.push(<MessageBubble key={m.id} mine={m.mine} time={hm(d)} bubble={m.mine ? myBubble : peerBubble}>{m.body}</MessageBubble>)
  })
  return (
    <div className="oh-chat-scroll" ref={box} role="log" aria-label={"Messages with " + peerName}>
      {nextCursor ? (
        <div className="oh-chat-older">
          <Button size="sm" variant="ghost" disabled={loadingOlder} onClick={() => {
            if (box.current) anchor.current = box.current.scrollHeight - box.current.scrollTop
            onLoadOlder(nextCursor)
          }}>{loadingOlder ? "Loading…" : "Load older messages"}</Button>
        </div>
      ) : list.length ? <div className="oh-chat-start">Start of your conversation</div> : null}
      {list.length ? rows : <div className="oh-chat-empty"><Icon name="chat" size={28} /><p>No messages yet. Say hi to {peerName}.</p></div>}
    </div>
  )
}

type Peer = Identity & { nickname?: string | null; status?: string | null; song?: Song | null }
type ChatWindowProps = {
  variant: "dock" | "sheet" | "page"; peer: Peer; presence: Presence | null
  /** The viewer's own cosmetics, for the bubble on their messages. */
  me?: Cosmetics | null
  thread: Thread; loadingOlder?: boolean; newCount?: number; now: string; updatedAt: string; locked: boolean; unread?: number; autoFocus?: boolean
  minimized?: boolean; expandHref?: string; menu?: (MenuItem | null)[] | null; actions?: ReactNode
  onSend: (body: string) => Promise<unknown>; onLoadOlder: (cursor: string) => void; onRefresh: () => void
  onMinimize?: () => void; onRestore?: () => void; onClose?: () => void; onBack?: (() => void) | null
}
const ChatWindow = (p: ChatWindowProps) => {
  const { peer, variant, presence: pres } = p
  const nm = nameOf(peer)
  const sub = !pres ? "Not on your list" : !isVisible(pres) ? PRES.offline : peer.status || PRES[presKey(pres)]
  const body = (
    <div className="oh-chatwin-body">
      <ChatThread
        messages={p.thread.messages} nextCursor={p.thread.nextCursor} onLoadOlder={p.onLoadOlder} loadingOlder={p.loadingOlder} newCount={p.newCount} now={p.now} peerName={nm} peerId={peer.id}
        myBubble={bubbleOf(p.me?.MSGBUBBLE)} peerBubble={bubbleOf(peer.cosmetics?.MSGBUBBLE)}
      />
      <div className="oh-chat-stamp">
        <span>Not live · updated {hm(new Date(p.updatedAt))}</span>
        <button type="button" className="oh-linkbtn" onClick={p.onRefresh}><Icon name="refresh" size={14} />Refresh</button>
      </div>
      <Composer onSend={p.onSend} locked={p.locked} autoFocus={p.autoFocus} placeholder={"Message " + nm} />
    </div>
  )
  if (variant === "dock") {
    const min = !!p.minimized
    return (
      <section className={cx("oh-chatwin", min && "is-min")} aria-label={"Chat with " + nm}>
        <div className="oh-chatwin-head">
          <button type="button" className="oh-chatwin-title" onClick={min ? p.onRestore : p.onMinimize} aria-expanded={!min} aria-label={(min ? "Open" : "Minimize") + " chat with " + nm}>
            <Avatar name={nm} src={peer.avatar} cosmetics={peer.cosmetics} size="sm" status={pres} />
            <span className="oh-chatwin-id"><b>{nm}</b><span>{sub}</span></span>
            {min && p.unread ? <span className="oh-unread">{p.unread}</span> : null}
          </button>
          {!min && p.expandHref ? <Button href={p.expandHref} variant="ghost" size="sm" iconOnly icon="expand" aria-label="Open in Messenger" /> : null}
          {!min ? <Button variant="ghost" size="sm" iconOnly icon="minus" aria-label="Minimize" onClick={p.onMinimize} /> : null}
          <Button variant="ghost" size="sm" iconOnly icon="close" aria-label={"Close chat with " + nm} onClick={p.onClose} />
        </div>
        {min ? null : body}
      </section>
    )
  }
  const head = variant === "sheet" ? (
    <div className="oh-chatpane-head is-sheet">
      <Button variant="ghost" iconOnly icon="left" aria-label="Back" onClick={p.onBack ?? undefined} />
      <Avatar name={nm} src={peer.avatar} cosmetics={peer.cosmetics} size="sm" status={pres} />
      <span className="oh-chatwin-id"><b>{nm}</b><span>{sub}</span></span>
      {p.menu ? <Menu label={"Actions for " + nm} items={p.menu} /> : null}
    </div>
  ) : (
    <div className="oh-chatpane-head">
      {p.onBack ? <Button variant="ghost" iconOnly icon="left" aria-label="Back to conversations" onClick={p.onBack} /> : null}
      <Avatar name={nm} src={peer.avatar} cosmetics={peer.cosmetics} size="lg" status={pres} />
      <div className="oh-chatpane-id">
        <div className="oh-row" style={{ gap: "var(--space-2) var(--space-3)" }}>
          <h2 className="oh-chatpane-name">{nm}</h2>
          {peer.nickname && peer.username ? <span className="oh-contact-handle">{handleOf(peer)}</span> : null}
        </div>
        <div className="oh-chatpane-sub">
          {pres ? <PresenceDot status={pres} showLabel /> : <span className="oh-presence-label">Not on your list</span>}
          {isVisible(pres) && peer.status ? <span className="oh-chatpane-status">{peer.status}</span> : null}
        </div>
        {isVisible(pres) && peer.song ? <SongLine song={peer.song} /> : null}
      </div>
      <div className="oh-chatpane-acts">{p.actions}{p.menu ? <Menu label={"Actions for " + nm} items={p.menu} /> : null}</div>
    </div>
  )
  return <section className={cx("oh-chatpane", variant === "sheet" && "is-sheet")} aria-label={"Chat with " + nm}>{head}{body}</section>
}

/* ---------- state: the live panel plus the open conversations ---------- */
type Thread = ChatPage
const EMPTY_THREAD: Thread = { messages: [], nextCursor: null }
const EMPTY_REQUESTS: Requests = { incoming: [], outgoing: [] }
const NO_CHATS: ChatSummary[] = []
const NO_BLOCKS: BlockedDuelist[] = []

const nowIso = () => new Date().toISOString()
/** A minute clock for relative times. */
const useNow = () => {
  const [now, setNow] = useState(nowIso)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowIso()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/** One `useMessenger` (and so one event stream) per tab, shared by the dock, the page and the header mailbox. */
const MessengerContext = createContext<Messenger | null>(null)

export const MessengerProvider = ({ children }: { children: ReactNode }) => (
  <MessengerContext.Provider value={useMessenger()}>{children}</MessengerContext.Provider>
)

const useMessengerView = () => {
  const x = useContext(MessengerContext)
  if (!x) throw new Error("MessengerProvider is missing")
  const now = useNow()
  const [threads, setThreads] = useState<Record<string, Thread>>({})
  const [fresh, setFresh] = useState<Record<string, string>>({})
  const [newCounts, setNewCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [unlinked, setUnlinked] = useState<Record<string, boolean>>({})

  const panel = x.panel
  const roster = panel?.roster ?? []
  const chats = x.chats ?? NO_CHATS
  const inRoster = (id: string) => roster.find((r) => r.id === id) ?? null
  const peer = (id: string): Peer & { presence?: Presence } =>
    inRoster(id) ?? chats.find((c) => c.id === id) ?? { id, displayName: null, username: null, avatar: null, cosmetics: {} }
  const setThread = (id: string, fn: (cur: Thread | undefined) => Thread) => setThreads((t) => ({ ...t, [id]: fn(t[id]) }))
  const fail = (error: unknown) => console.error(error)

  const view = {
    panel,
    now,
    S: {
      me: panel?.me,
      roster,
      chats,
      requests: x.requests ?? EMPTY_REQUESTS,
      blocks: x.blocks ?? NO_BLOCKS,
      threads,
      fresh,
      newCounts,
      loading,
    },
    inRoster,
    peer,
    locked: (id: string) => !inRoster(id) || !!unlinked[id],
    unreadChats: x.unreadChats,
    incoming: x.requests ? x.requests.incoming.length : panel?.incomingRequests ?? 0,
    loadRequests: () => { x.loadRequests(); x.loadBlocks() },
    setPresence: (v: ChosenPresence) => { x.setPresence(v) },
    setStatus: (v: string | null) => { x.setStatus(v ?? "") },
    setSong: (url: string | null) => x.setSong(url),
    /** Opening (or refreshing) fetches the first page, which marks the conversation read. */
    open: (id: string) => {
      const chat = chats.find((c) => c.id === id)
      setNewCounts((n) => ({ ...n, [id]: chat?.unread ?? 0 }))
      setFresh((f) => ({ ...f, [id]: nowIso() }))
      x.markRead(id)
      api.messages(id).then((page) => setThread(id, (cur) => cur && cur.messages.length
        ? { messages: mergeMessages(cur.messages, page.messages).reverse(), nextCursor: cur.nextCursor }
        : page)).catch(fail)
    },
    loadOlder: (id: string, cursor: string) => {
      setLoading((l) => ({ ...l, [id]: true }))
      api.messages(id, cursor)
        .then((page) => setThread(id, (cur) => ({ messages: (cur?.messages ?? []).concat(page.messages), nextCursor: page.nextCursor })))
        .catch(fail)
        .finally(() => setLoading((l) => ({ ...l, [id]: false })))
    },
    send: (id: string, body: string) => api.send(id, body).then((msg) => {
      setThread(id, (cur) => ({ messages: [msg, ...(cur?.messages ?? [])], nextCursor: cur?.nextCursor ?? null }))
      const p = peer(id)
      x.sent({ id, displayName: p.displayName, username: p.username, avatar: p.avatar, cosmetics: p.cosmetics, nickname: p.nickname ?? null }, msg)
    }, (error) => {
      if (error instanceof MessengerApiError && error.code === "NOT_LINKED") setUnlinked((u) => ({ ...u, [id]: true }))
      throw error
    }),
    accept: (id: string, kind: Relation) => { x.accept(id, kind) },
    decline: (id: string) => { x.decline(id) },
    cancel: (id: string) => { x.cancel(id) },
    remove: (id: string) => { x.remove(id) },
    changeKind: (id: string, kind: Relation) => { if (inRoster(id)) x.setKind(id, kind); else x.setRequestKind(id, kind) },
    edit: (id: string, v: { nickname?: string | null; note?: string | null }) => {
      if ("nickname" in v) x.setNickname(id, v.nickname ?? "")
      if ("note" in v) x.setNote(id, v.note ?? "")
    },
    block: (id: string) => { x.block(id).then(() => { if (x.blocks) x.loadBlocks() }) },
    unblock: (id: string) => { x.unblock(id) },
    clear: (id: string) => {
      setThreads((t) => { const next = { ...t }; delete next[id]; return next })
      x.clearChat(id)
    },
  }
  return view
}
type MessengerView = ReturnType<typeof useMessengerView>

const profileHref = (id: string) => `/profile/${id}`
const pageHref = "/messenger"

const contactMenu = (m: MessengerView, e: RosterEntry, extra: { message?: () => void; edit?: () => void } | null): (MenuItem | null)[] => {
  const kindTo: Relation = e.kind === "rival" ? "friend" : "rival"
  return [
    extra?.message ? { label: "Message", icon: "chat", onSelect: extra.message } : null,
    { label: "View profile", icon: "user", onSelect: () => window.location.assign(profileHref(e.id)) },
    extra?.edit ? { label: "Nickname and note", icon: "edit", onSelect: extra.edit } : null,
    { label: kindTo === "rival" ? "Move to rivals" : "Move to friends", icon: "swap", onSelect: () => m.changeKind(e.id, kindTo) },
    { divider: true },
    { label: "Remove", icon: "close", onSelect: () => m.remove(e.id) },
    { label: "Block", icon: "block", tone: "danger", onSelect: () => m.block(e.id) },
  ]
}

/* ---------- list body shared by the dock and the page ---------- */
type Tab = "chats" | "friends" | "rivals" | "requests"

const MessengerList = ({ m, tab, query, selected, onOpen, editing, onEdit }: {
  m: MessengerView; tab: Tab; query: string; selected?: string | null; onOpen: (id: string) => void; editing: string | null; onEdit: (id: string | null) => void
}) => {
  const S = m.S, q = query.trim().toLowerCase()
  const match = (x: Named) => !q || [x.nickname, x.displayName, x.username].some((v) => v && v.toLowerCase().includes(q))
  const empty = (t: string) => <div className="oh-msgr-empty">{t}</div>
  if (tab === "chats") {
    const chats = S.chats.filter(match)
    if (!S.chats.length) return empty("No conversations yet. Open a friend or rival to start one.")
    if (!chats.length) return empty("No one matches “" + query + "”.")
    return (
      <div className="oh-convos" role="listbox" aria-label="Conversations">
        {chats.map((c) => {
          const r = m.inRoster(c.id), lm = c.lastMessage
          const name = nameOf(r || c)
          return (
            <div
              key={c.id}
              className={cx("oh-convo", c.unread > 0 && "is-unread")}
              role="option"
              tabIndex={0}
              aria-selected={selected === c.id}
              onClick={() => onOpen(c.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c.id) } }}
            >
              <Avatar name={name} src={c.avatar} cosmetics={c.cosmetics} status={r?.presence} />
              <div className="oh-convo-main">
                <div className="oh-convo-top"><span className="oh-convo-name">{name}</span><span className="oh-convo-time">{shortWhen(lm.createdAt, m.now)}</span></div>
                <div className="oh-convo-last">{(lm.mine ? "You: " : "") + lm.body.split("\n")[0]}</div>
              </div>
              {c.unread ? <span className="oh-unread" aria-label={c.unread + " unread"}>{c.unread}</span> : null}
            </div>
          )
        })}
      </div>
    )
  }
  if (tab === "requests") {
    const { incoming, outgoing } = S.requests
    return (
      <div className="oh-msgr-reqs">
        <div className="oh-msgr-group">Incoming · {incoming.length}</div>
        {incoming.length ? (
          <div role="list">
            {incoming.map((r) => <RequestRow key={r.id} request={r} direction="incoming" now={m.now} onAccept={(k) => m.accept(r.id, k)} onDecline={() => m.decline(r.id)} onBlock={() => m.block(r.id)} />)}
          </div>
        ) : empty("No one is waiting on you.")}
        <div className="oh-msgr-group">Sent · {outgoing.length}</div>
        {outgoing.length ? (
          <div role="list">
            {outgoing.map((r) => <RequestRow key={r.id} request={r} direction="outgoing" now={m.now} onCancel={() => m.cancel(r.id)} onChangeKind={(k) => m.changeKind(r.id, k)} />)}
          </div>
        ) : empty("No requests sent.")}
        <div className="oh-msgr-group">Blocked · {S.blocks.length}</div>
        {S.blocks.length ? (
          <div role="list">
            {S.blocks.map((b) => {
              const nm = b.displayName || b.username || "Unknown duelist"
              return (
                <div key={b.id} className="oh-request" role="listitem">
                  <div className="oh-request-top">
                    <Avatar name={nm} src={b.avatar} cosmetics={b.cosmetics} />
                    <div className="oh-contact-main"><span className="oh-contact-name">{nm}</span><span className="oh-contact-sub">Blocked · {ago(b.blockedAt, m.now)}</span></div>
                    <Button size="sm" onClick={() => m.unblock(b.id)}>Unblock</Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : empty("You aren't blocking anyone.")}
        <p className="oh-msgr-hint">To add a duelist, open their profile and choose Add player to list.</p>
      </div>
    )
  }
  const all = S.roster.filter((r) => r.kind === (tab === "rivals" ? "rival" : "friend"))
  const list = all.filter(match)
  if (!all.length) return empty(tab === "rivals" ? "No rivals yet. Open a duelist's profile and choose Add player to list." : "No friends yet. Open a duelist's profile and choose Add player to list.")
  if (!list.length) return empty("No one matches “" + query + "”.")
  const on = list.filter((r) => isVisible(r.presence)), off = list.filter((r) => !isVisible(r.presence))
  const rows = (arr: RosterEntry[]) => arr.map((e) => {
    if (editing === e.id) return <ContactEditor key={e.id} entry={e} onCancel={() => onEdit(null)} onSave={(v) => { m.edit(e.id, v); onEdit(null) }} />
    const chat = S.chats.find((c) => c.id === e.id)
    return <ContactRow key={e.id} entry={e} unread={chat?.unread} selected={selected === e.id} onOpen={() => onOpen(e.id)} menu={contactMenu(m, e, { message: () => onOpen(e.id), edit: () => onEdit(e.id) })} />
  })
  return (
    <div role="list" aria-label={tab === "rivals" ? "Rivals" : "Friends"}>
      {on.length ? <div className="oh-msgr-group" role="presentation">Online · {on.length}</div> : null}
      {rows(on)}
      {off.length ? <div className="oh-msgr-group" role="presentation">Offline · {off.length}</div> : null}
      {rows(off)}
    </div>
  )
}

const msgrTabs = (m: MessengerView): TabItem<Tab>[] => [
  { id: "chats", label: "Chats", count: m.unreadChats || null },
  { id: "friends", label: "Friends" },
  { id: "rivals", label: "Rivals" },
  { id: "requests", label: "Requests", count: m.incoming || null },
]

/** The requests tab is the only place requests and blocks show, so they load when it opens. */
const useTab = (m: MessengerView, initial: Tab) => {
  const [tab, setTab] = useState<Tab>(initial)
  const loadRequests = m.loadRequests
  useEffect(() => { if (initial === "requests") loadRequests() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const change = (next: Tab) => { setTab(next); if (next === "requests") loadRequests() }
  return [tab, change] as const
}

const subscribeResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}
/** 0 on the server: the dock portals into the body, so it only renders in the browser. */
const useViewportWidth = () => useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 0)

/* ---------- MessengerDock: the corner widget ---------- */
type Win = { id: string; min: boolean }

/** Below this the dock gives way to the header's mailbox (`MessengerMailbox`). */
const DOCK_MIN_WIDTH = 640

/** Mounted once in the root layout. Left out on the landing page and on /messenger, which is the dock expanded. */
export const MessengerDock = () => {
  const m = useMessengerView()
  const vw = useViewportWidth()
  const pathname = usePathname()
  // The simulator fills the window; the dock would sit on its End Turn.
  if (pathname === "/" || pathname === "/simulator" || pathname.startsWith(pageHref)) return null
  if (!m.panel || !m.S.me || vw < DOCK_MIN_WIDTH) return null
  return <Dock m={m} vw={vw} me={m.S.me} />
}

/** Phone-only header entry: unread chats plus incoming requests, linking to /messenger. */
export const MessengerMailbox = ({ className }: { className?: string }) => {
  const m = useContext(MessengerContext)
  if (!m?.panel) return null
  const total = (m.unreadChats || 0) + (m.requests ? m.requests.incoming.length : m.panel.incomingRequests)
  return (
    <Link href={pageHref} className={cx("relative", className)} aria-label={"Messenger" + (total ? ", " + total + " new" : "")}>
      <Icon name="mail" size={22} />
      {total ? <span className="oh-unread absolute top-2.5 right-0.5">{total}</span> : null}
    </Link>
  )
}

const Dock = ({ m, vw, me }: { m: MessengerView; vw: number; me: Me }) => {
  const S = m.S
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useTab(m, "chats")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [wins, setWins] = useState<Win[]>([])
  const cap = Math.max(1, Math.min(3, Math.floor((vw - 336 - 48) / 332)))

  const openChat = (id: string) => {
    m.open(id)
    setWins((list) => list.some((w) => w.id === id)
      ? list.map((w) => (w.id === id ? { id, min: false } : w))
      : [{ id, min: false }, ...list].slice(0, cap))
  }
  const setWin = (id: string, v: Partial<Win> | null) =>
    setWins((list) => (v === null ? list.filter((w) => w.id !== id) : list.map((w) => (w.id === id ? { ...w, ...v } : w))))
  const winFor = (id: string, variant: "dock", extra: Partial<ChatWindowProps>) => {
    const r = m.inRoster(id), chat = S.chats.find((c) => c.id === id)
    return (
      <ChatWindow
        key={id}
        variant={variant}
        peer={m.peer(id)}
        me={S.me?.cosmetics}
        presence={r ? r.presence : null}
        thread={S.threads[id] ?? EMPTY_THREAD}
        loadingOlder={S.loading[id]}
        newCount={S.newCounts[id]}
        now={m.now}
        updatedAt={S.fresh[id] || m.now}
        locked={m.locked(id)}
        unread={chat?.unread}
        onSend={(b) => m.send(id, b)}
        onLoadOlder={(c) => m.loadOlder(id, c)}
        onRefresh={() => m.open(id)}
        expandHref={`${pageHref}?with=${id}`}
        {...extra}
      />
    )
  }
  const lists = (
    <>
      <Tabs label="Messenger lists" items={msgrTabs(m)} value={tab} onChange={(v) => { setTab(v); setEditing(null) }} />
      {tab !== "requests" ? (
        <div className="oh-dock-search">
          <SearchField placeholder={tab === "chats" ? "Search chats" : "Search " + tab} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      ) : null}
      <div className="oh-dock-list"><MessengerList m={m} tab={tab} query={query} onOpen={openChat} editing={editing} onEdit={setEditing} /></div>
      <Link className="oh-dock-foot" href={pageHref}>Open Messenger<Icon name="right" size={16} /></Link>
    </>
  )
  const meCard = <MeCard me={me} compact m={m} />

  return portal(
    <div className="oh-dock" role="region" aria-label="Messenger">
      <div className="oh-dock-wins">
        {wins.slice().reverse().map((w) => winFor(w.id, "dock", {
          minimized: w.min,
          autoFocus: !w.min,
          onMinimize: () => setWin(w.id, { min: true }),
          onRestore: () => { m.open(w.id); setWin(w.id, { min: false }) },
          onClose: () => setWin(w.id, null),
        }))}
      </div>
      <section className={cx("oh-cut oh-notch oh-dock-panel", open && "is-open")}>
        <button type="button" className="oh-dock-bar" aria-expanded={open} aria-label="Messenger" title={open ? undefined : "Messenger"} onClick={() => setOpen(!open)}>
          <Avatar name={nameOf(me)} src={me.avatar} cosmetics={me.cosmetics} size={open ? "sm" : "md"} status={me.presence === "invisible" ? "offline" : me.presence} />
          {open ? <span className="oh-dock-title">Messenger</span> : null}
          {m.unreadChats ? <span className="oh-unread" title={m.unreadChats + " unread chats"}><Icon name="chat" size={12} />{m.unreadChats}</span> : null}
          {m.incoming ? <span className="oh-unread is-gold" title={m.incoming + " requests"}><Icon name="host" size={12} />{m.incoming}</span> : null}
          {open ? <Icon name="down" size={18} className="oh-dock-chev" /> : null}
        </button>
        {open ? <div className="oh-dock-body">{meCard}{lists}</div> : null}
      </section>
    </div>,
  )
}

/* ---------- MessengerPage: the full page ---------- */
type MessengerPageProps = { defaultSelected?: string; defaultTab?: Tab; height?: string }

export const MessengerPage = (props: MessengerPageProps) => {
  const m = useMessengerView()
  const me = m.S.me
  if (m.panel === null) return (
    <div className="oh-msgr-none" style={{ height: props.height }}>
      <h2>Messenger</h2>
      <p>Log in to see your friends and rivals.</p>
      <Button variant="primary" href="/login">Log in</Button>
    </div>
  )
  if (!me) return <div className="oh-msgr-none" style={{ height: props.height }} aria-busy="true" />
  return <Page m={m} me={me} {...props} />
}

const Page = ({ m, me, defaultSelected, defaultTab, height }: MessengerPageProps & { m: MessengerView; me: Me }) => {
  const S = m.S
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1280)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    // Fires once on observe, then on every resize.
    const ro = new ResizeObserver(([entry]) => { if (entry) setW(entry.contentRect.width) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const mode = w >= 1180 ? "wide" : w >= 820 ? "mid" : "narrow"
  const [selected, setSelected] = useState<string | null>(defaultSelected ?? null)
  const [tab, setTab] = useTab(m, defaultTab ?? "chats")
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"list" | "thread">(defaultSelected ? "thread" : "list")
  const [info, setInfo] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const open = m.open
  useEffect(() => { if (defaultSelected) open(defaultSelected) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openChat = (id: string) => { setSelected(id); setView("thread"); m.open(id) }
  const close = () => { setSelected(null); setView("list") }
  const id = selected
  const peer = id ? m.peer(id) : null
  const r = id ? m.inRoster(id) : null

  const side = (
    <aside className="oh-msgr-side" aria-label="Conversations and contacts">
      <div className="oh-msgr-me"><MeCard me={me} m={m} /></div>
      <Tabs label="Messenger lists" items={msgrTabs(m)} value={tab} onChange={setTab} />
      {tab !== "requests" ? (
        <div className="oh-dock-search">
          <SearchField placeholder={tab === "chats" ? "Search chats" : "Search " + tab} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      ) : null}
      <div className="oh-dock-list"><MessengerList m={m} tab={tab} query={query} selected={id} onOpen={openChat} editing={editing} onEdit={setEditing} /></div>
    </aside>
  )
  const details = peer && id ? <ContactInfo key={id} m={m} peer={peer} entry={r} onClear={() => { m.clear(id); close() }} onClose={close} /> : null
  const menu: (MenuItem | null)[] | null = peer && id ? [
    mode !== "wide" ? { label: "Contact details", icon: "user", onSelect: () => setInfo(true) } : null,
    r ? { label: r.kind === "rival" ? "Move to friends" : "Move to rivals", icon: "swap", onSelect: () => m.changeKind(id, r.kind === "rival" ? "friend" : "rival") } : null,
    { label: "Clear chat for me", icon: "close", onSelect: () => { m.clear(id); close() } },
    r ? { divider: true } : null,
    r ? { label: "Remove", icon: "close", onSelect: () => m.remove(id) } : null,
    { label: "Block", icon: "block", tone: "danger", onSelect: () => { m.block(id); close() } },
  ] : null
  const main = (
    <main className="oh-msgr-main">
      {peer && id ? (
        <ChatWindow
          variant={mode === "narrow" ? "sheet" : "page"}
          peer={peer}
          me={S.me?.cosmetics}
          presence={r ? r.presence : null}
          thread={S.threads[id] ?? EMPTY_THREAD}
          loadingOlder={S.loading[id]}
          newCount={S.newCounts[id]}
          now={m.now}
          updatedAt={S.fresh[id] || m.now}
          locked={m.locked(id)}
          onSend={(b) => m.send(id, b)}
          onLoadOlder={(c) => m.loadOlder(id, c)}
          onRefresh={() => m.open(id)}
          onBack={mode === "narrow" ? () => setView("list") : null}
          menu={menu}
          actions={mode !== "narrow" ? <Button size="sm" href={profileHref(id)} icon="user">Profile</Button> : null}
        />
      ) : (
        <div className="oh-msgr-none">
          <Image src="/omega-mark.png" alt="" width={60} height={60} />
          <h2>Pick a conversation</h2>
          <p>Chats, friends and rivals are on the left. Messages arrive when you open or refresh a chat; there&apos;s no live feed.</p>
        </div>
      )}
    </main>
  )
  const cols = mode === "wide"
    ? [side, main, <aside key="i" className="oh-msgr-info" aria-label="Contact details">{details || <div className="oh-msgr-empty">Details for the open chat show here.</div>}</aside>]
    : mode === "mid" ? [side, main] : [view === "thread" && peer ? main : side]
  const drawer = mode !== "wide" && info && details ? portal(
    <>
      <button type="button" className="oh-scrim" aria-label="Close details" onClick={() => setInfo(false)} />
      <aside className="oh-drawer oh-msgr-drawer" role="dialog" aria-modal="true" aria-label="Contact details" onKeyDown={(e) => { if (e.key === "Escape") setInfo(false) }}>
        <div className="oh-drawer-head">
          <span className="oh-dock-title">Details</span>
          <Button variant="ghost" iconOnly icon="close" aria-label="Close details" onClick={() => setInfo(false)} />
        </div>
        {details}
      </aside>
    </>,
  ) : null
  return (
    <div ref={wrap} className={cx("oh-msgr", "is-" + mode)} style={height ? { height } : undefined}>
      {cols.map((c, i) => <Fragment key={i}>{c}</Fragment>)}
      {drawer}
    </div>
  )
}

/** Keyed by the peer's id, so switching conversations starts from their saved nickname and note. */
const ContactInfo = ({ m, peer, entry: e, onClear, onClose }: { m: MessengerView; peer: Peer; entry: RosterEntry | null; onClear: () => void; onClose: () => void }) => {
  const nm = nameOf(peer)
  const [nickname, setNickname] = useState(e?.nickname || "")
  const [note, setNote] = useState(e?.note || "")
  const saveNick = () => { const v = nickname.trim() || null; if (e && v !== (e.nickname || null)) m.edit(peer.id, { nickname: v }) }
  const saveNote = () => { const v = note.trim() || null; if (e && v !== (e.note || null)) m.edit(peer.id, { note: v }) }
  return (
    <div className="oh-info">
      <div className="oh-info-id">
        <Avatar name={nm} src={peer.avatar} cosmetics={peer.cosmetics} size="lg" status={e?.presence} />
        <div>
          <div className="oh-info-name">{peer.displayName || peer.username}</div>
          {peer.username ? <div className="oh-contact-handle">@{peer.username}</div> : null}
        </div>
      </div>
      {e ? (
        <div className="oh-info-block">
          <Eyebrow tone="cyan">Private to you</Eyebrow>
          <div className="oh-info-field">
            <span className="oh-field-label">Filed under</span>
            <ModeTabs<Relation> label="Filed under" value={e.kind} items={[{ id: "friend", label: "Friend" }, { id: "rival", label: "Rival" }]} onChange={(k) => m.changeKind(peer.id, k)} />
          </div>
          <label className="oh-info-field">
            <span className="oh-field-label">Nickname</span>
            <span className="oh-cut oh-field">
              <input value={nickname} maxLength={32} placeholder={peer.displayName || peer.username || ""} onChange={(x) => setNickname(x.target.value)} onBlur={saveNick} onKeyDown={(x) => { if (x.key === "Enter") x.currentTarget.blur() }} />
              <span className="oh-field-count">{32 - nickname.length}</span>
            </span>
          </label>
          <label className="oh-info-field">
            <span className="oh-field-label">Note</span>
            <span className="oh-cut oh-field oh-field-area">
              <textarea value={note} maxLength={200} rows={4} placeholder="Deck, habits, where you met" onChange={(x) => setNote(x.target.value)} onBlur={saveNote} />
              <span className="oh-field-count">{200 - note.length}</span>
            </span>
          </label>
        </div>
      ) : (
        <div className="oh-info-block">
          <Eyebrow>Not on your list</Eyebrow>
          <p className="oh-msgr-hint">You can read the history, but only friends and rivals can message. Add them again from their profile.</p>
        </div>
      )}
      <div className="oh-info-acts">
        <Button href={profileHref(peer.id)} icon="user">View profile</Button>
        <Button variant="ghost" onClick={onClear}>Clear chat for me</Button>
        {e ? <Button variant="ghost" onClick={() => m.remove(peer.id)}>Remove from list</Button> : null}
        <Button variant="danger" icon="block" onClick={() => { m.block(peer.id); onClose() }}>Block</Button>
      </div>
      <p className="oh-msgr-hint">Blocking is silent: they see the same thing as a removal and can&apos;t message you.</p>
    </div>
  )
}
