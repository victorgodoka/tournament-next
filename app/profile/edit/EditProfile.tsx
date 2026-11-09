'use client'

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { Button } from "@ui/button";
import { Chip } from "@ui/chip";
import { Segmented } from "@ui/choice";
import { Icon } from "@ui/icon";
import { CardArt } from "@omega/card-art";
import { Error as ErrorPage } from "@omega/error";
import { ProfileBio } from "@omega/profile/profile-bio";
import { REGION_LABEL, SOCIAL } from "@omega/profile/labels";
import { useAuth } from "@contexts/auth/auth.context";
import { useSearch } from "@hooks/index";
import { signIn } from "@utils/auth";
import { parseBio } from "@utils/remark";
import { searchCards } from "@utils/cards";
import { COVER_MAX_BYTES, getProfile, ProfileApiError, updateProfile, uploadCover } from "@utils/profile";
import type { MatchWindow, ProfileIdentity, ProfilePrivacy, ProfileSettingsPatch, Region, Visibility } from "@utils/types";
import { Rail } from "../sections/rail";
import { bioProblem, BIO_MAX, DECK_NAME_MAX, diff, SOCIAL_FIELDS, toForm, type Form } from "./form";

/** Longest keys first, so `favoriteCardId` is not read as another field. The API message names the field. */
const FIELD_LABEL: [keyof ProfileSettingsPatch, string][] = [
  ['favoriteDeckName', 'favorite deck'], ['favoriteCardId', 'favorite card'], ['coverImageId', 'cover'],
  ['visibility', 'visibility'], ['hideLastSeen', 'last seen'], ['privacy', 'privacy settings'],
  ['socials', 'socials'], ['region', 'region'], ['bio', 'bio'],
]

const saveError = (error: unknown) => {
  if (error instanceof ProfileApiError) {
    if (error.code === 'VIP_REQUIRED') return 'Some of these changes need VIP.'
    if (error.code === 'TOO_LARGE') return 'The cover must be 2 MB or less.'
    if (error.status === 422) return 'That cover was rejected by moderation. Pick another image.'
    if (error.status === 400) {
      const field = FIELD_LABEL.find(([key]) => error.message.includes(key))
      return field ? `Check your ${field[1]} and try again.` : 'Some fields were rejected. Check them and try again.'
    }
  }
  return 'Couldn’t save. Try again in a moment.'
}

const findCards = (text: string, signal: AbortSignal) => searchCards(text, 6, signal)

/* ── Shared pieces ── */

const LABEL = "font-mono text-[10px] leading-3 tracking-[0.16em] uppercase text-ink-muted"
const INPUT = "box-border w-full border border-line-mid bg-surface-200 px-3 py-2.25 text-[15px] leading-5.5 text-ink placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"

type SetForm = (patch: Partial<Form> | ((form: Form) => Partial<Form>)) => void

/** The 48×26 switch of the settings rows. */
const Toggle = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={twMerge(
      'relative h-6.5 w-12 shrink-0 cursor-pointer bg-surface-300 shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan disabled:cursor-not-allowed disabled:opacity-(--opacity-dim)',
      'after:absolute after:top-1 after:left-1 after:size-4.5 after:bg-ink-muted motion-safe:after:transition-transform motion-safe:after:duration-120',
      checked && 'bg-ground-cyan shadow-[inset_0_0_0_1px_var(--color-cyan)] after:translate-x-5.5 after:bg-cyan',
    )}
  />
)

/** Title and description on the left, the control on the right. */
const Setting = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 bg-surface-100 px-4 py-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-6 md:px-5">
    <b className="text-[15px] font-bold text-ink md:col-start-1 md:row-start-1">{title}</b>
    <p className="text-[13px] leading-4.75 text-ink-dim md:col-start-1 md:row-start-2">{hint}</p>
    <div className="max-md:mt-2 md:col-start-2 md:row-span-2 md:row-start-1">{children}</div>
  </div>
)

const Group = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-px border border-line bg-line">{children}</div>

/** A VIP section seen by a non-VIP: the controls stay visible, greyed, with the way to VIP. */
const VipLock = ({ vip, children }: { vip: boolean; children: React.ReactNode }) =>
  vip ? children : (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 border border-gold bg-ground-gold px-4 py-3">
        <Chip tone="vip">VIP</Chip>
        <span className="text-sm text-ink-dim">This part of your profile is a VIP feature. What you saved before stays stored.</span>
        <Button size="sm" variant="secondary" href="/download#donations" className="ml-auto">Get VIP</Button>
      </div>
      <div inert className="opacity-(--opacity-dim)">{children}</div>
    </div>
  )

const Section = ({ id, num, label, stamp, children }: { id: string; num: string; label: string; stamp?: React.ReactNode; children: React.ReactNode }) => (
  <section id={id} aria-label={label} className="flex scroll-mt-24 flex-col gap-3.5">
    <Rail num={num} label={label} stamp={stamp} />
    {children}
  </section>
)

/* ── Autocomplete ── */

type AutocompleteProps<T> = {
  id: string
  value: string
  onChange: (text: string) => void
  options: T[]
  optionKey: (option: T) => string | number
  renderOption: (option: T) => React.ReactNode
  onPick: (option: T) => void
  placeholder: string
  maxLength?: number
}

function Autocomplete<T>({ id, value, onChange, options, optionKey, renderOption, onPick, placeholder, maxLength }: AutocompleteProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const shown = open && options.length > 0
  const current = Math.min(active, options.length - 1)

  const pick = (option: T) => {
    onPick(option)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') return setOpen(false)
    if (!options.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive(shown ? (current + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : 0)
    } else if (e.key === 'Enter' && shown) {
      e.preventDefault()
      pick(options[current]!)
    }
  }

  return (
    <div className="relative mt-2.5">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown ? `${id}-opt-${current}` : undefined}
        className={INPUT}
      />
      {shown ? (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border border-line bg-surface-100 shadow-lg">
          {options.map((option, i) => (
            <li
              key={optionKey(option)}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === current}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(option)
              }}
              onMouseEnter={() => setActive(i)}
              className={twMerge("flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-ink-dim body-sm", i === current && "bg-surface-300 text-ink")}
            >
              {renderOption(option)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}


/* ── 01 Profile ── */

const ProfileSection = ({ form, set }: { form: Form; set: SetForm }) => {
  const [cardText, setCardText] = useState(form.favoriteCard?.name ?? '')
  const cards = useSearch(cardText, findCards)

  return (
    <Section id="profile" num="01" label="Profile">
      <Group>
        <div className="flex flex-col gap-3 bg-surface-100 px-5 py-4 max-md:px-4">
          <b className="text-[15px] font-bold text-ink">Region</b>
          <p className="text-[13px] leading-4.75 text-ink-dim">The server region you usually play from. It shows as a tag next to your name. Pick it again to clear it.</p>
          <div role="radiogroup" aria-label="Region" className="flex flex-wrap gap-1.5">
            {(Object.keys(REGION_LABEL) as Region[]).map((id) => {
              const selected = id === form.region
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set({ region: selected ? null : id })}
                  className={twMerge('cut cursor-pointer px-3 py-2 signal-tab [--cut:var(--cut-xs)]', selected ? 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]' : 'text-ink-dim hover:text-ink')}
                >
                  {REGION_LABEL[id]}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid gap-5 bg-surface-100 px-5 py-4 max-md:px-4 md:grid-cols-2">
          <div>
            <label htmlFor="fav-card" className={LABEL}>Favorite card</label>
            <Autocomplete
              id="fav-card"
              value={cardText}
              onChange={(text) => {
                setCardText(text)
                if (!text.trim()) set({ favoriteCard: null })
              }}
              options={cards}
              optionKey={(card) => card.id}
              renderOption={(card) => (
                <>
                  <CardArt art={card} alt="" sizes="36px" className="size-9 shrink-0 border border-line" />
                  <span className="min-w-0 truncate">{card.name ?? `Card ${card.id}`}</span>
                </>
              )}
              onPick={(card) => {
                set({ favoriteCard: card })
                setCardText(card.name ?? '')
              }}
              placeholder="Search a card…"
            />
            {form.favoriteCard ? (
              <div className="mt-3 flex items-center gap-2.5">
                <CardArt art={form.favoriteCard} alt="" sizes="36px" className="size-9 border border-cyan" />
                <p className="text-[13px] text-ink-muted">{form.favoriteCard.name ?? `Card ${form.favoriteCard.id}`}</p>
              </div>
            ) : null}
          </div>
          <div>
            <label htmlFor="fav-deck" className={LABEL}>Favorite deck</label>
            <input
              id="fav-deck"
              value={form.favoriteDeckName}
              onChange={(e) => set({ favoriteDeckName: e.target.value })}
              placeholder="Mitsurugi with Yummy"
              maxLength={DECK_NAME_MAX}
              autoComplete="off"
              className={twMerge(INPUT, 'mt-2.5')}
            />
            <p className="mt-2 text-[13px] text-ink-muted">Write it however you like.</p>
          </div>
        </div>
        <Setting title="Hide last seen" hint="Nobody else sees when you were last online. Open to every duelist.">
          <Toggle checked={form.hideLastSeen} onChange={(hideLastSeen) => set({ hideLastSeen })} label="Hide last seen" />
        </Setting>
      </Group>
    </Section>
  )
}

/* ── 02 Cover ── */

const CoverSection = ({ form, set, vip }: { form: Form; set: SetForm; vip: boolean }) => {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })

  const pick = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setState({ busy: false, error: 'Use a JPG, PNG or WebP image.' })
    if (file.size > COVER_MAX_BYTES) return setState({ busy: false, error: 'The cover must be 2 MB or less.' })
    setState({ busy: true, error: null })
    try {
      const id = await uploadCover(file)
      set({ cover: { id, preview: URL.createObjectURL(file) } })
      setState({ busy: false, error: null })
    } catch (error) {
      console.error(error)
      setState({ busy: false, error: 'Upload failed. Try again.' })
    }
  }

  return (
    <Section id="cover" num="02" label="Cover" stamp="1500 × 350 · JPG, PNG, WebP · 2 MB">
      <VipLock vip={vip}>
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
          <div role="img" aria-label={form.cover.preview ? 'Current cover' : 'No cover'} className="relative h-55 overflow-hidden border border-line-mid bg-[#0a1430] max-md:h-30">
            {form.cover.preview ? <Image src={form.cover.preview} alt="" fill unoptimized className="object-cover" /> : (
              <span className="grid size-full place-items-center text-ink-muted signal-sm">No cover yet</span>
            )}
            <span aria-hidden className="absolute bottom-4.5 left-6 size-18 border-4 border-surface-100 bg-azure max-md:size-12" />
          </div>
          <div className="flex flex-col gap-3">
            <input ref={input} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <Button variant="secondary" disabled={state.busy} onClick={() => input.current?.click()}>
              <Icon name="plus" />{state.busy ? 'Uploading…' : 'Upload cover'}
            </Button>
            <Button variant="ghost" disabled={state.busy || !form.cover.preview} onClick={() => set({ cover: { id: null, preview: null } })}>
              <Icon name="close" />Remove
            </Button>
            <span className="text-[13px] leading-4.75 text-ink-muted">The bottom-left corner sits under your avatar. Keep faces and text out of it. Phones show the middle of the image.</span>
            {state.error ? <p role="alert" className="text-sm text-loss">{state.error}</p> : null}
          </div>
        </div>
      </VipLock>
    </Section>
  )
}

/* ── 03 Bio ── */

/** The bio as the profile renders it. Same pipeline as the server, run here as you type. */
const useBioHtml = (bio: string) => {
  const [html, setHtml] = useState('')
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      parseBio(bio).then((out) => live && setHtml(out)).catch(() => {})
    }, 150)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [bio])
  return html
}

const BioSection = ({ bio, set, vip }: { bio: string; set: SetForm; vip: boolean }) => {
  const problem = bioProblem(bio)
  const html = useBioHtml(bio)
  return (
    <Section id="bio" num="03" label="Bio" stamp={`Markdown · ${bio.length} / ${BIO_MAX}`}>
      <VipLock vip={vip}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio-input" className={LABEL}>Write</label>
            <textarea
              id="bio-input"
              rows={7}
              value={bio}
              onChange={(e) => set({ bio: e.target.value })}
              placeholder="Tell duelists who you are…"
              aria-invalid={!!problem}
              aria-describedby={problem ? 'bio-problem' : undefined}
              className={twMerge(INPUT, 'resize-y font-mono text-sm leading-5.5')}
            />
            {problem ? <p id="bio-problem" role="alert" className="text-sm text-loss">{problem}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Preview</span>
            <div className="grow border border-line bg-surface-100 px-4 py-3 text-[15px] leading-6 text-ink-dim">
              {bio.trim() ? <ProfileBio markdown={html} /> : <p className="italic text-ink-muted">Nothing written yet.</p>}
            </div>
          </div>
        </div>
      </VipLock>
    </Section>
  )
}

/* ── 04 Socials ── */

const SocialsSection = ({ socials, set, vip }: { socials: Form['socials']; set: SetForm; vip: boolean }) => (
  <Section id="socials" num="04" label="Socials" stamp="Leave blank to hide">
    <VipLock vip={vip}>
      <Group>
        {SOCIAL_FIELDS.map(({ network, prefix, placeholder, max }) => (
          <div key={network} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 bg-surface-100 px-5 py-3 max-md:grid-cols-[88px_minmax(0,1fr)] max-md:px-4">
            <label htmlFor={`s-${network}`} className={LABEL}>{SOCIAL[network].label}</label>
            <div className="flex items-center gap-2">
              <span aria-hidden className="font-mono text-sm text-cyan">{prefix}</span>
              <input
                id={`s-${network}`}
                value={socials[network]}
                onChange={(e) => set((current) => ({ socials: { ...current.socials, [network]: e.target.value } }))}
                placeholder={placeholder}
                maxLength={max}
                autoComplete="off"
                className={INPUT}
              />
            </div>
          </div>
        ))}
      </Group>
    </VipLock>
  </Section>
)

/* ── 05 Visibility ── */

const VISIBILITY: { value: Visibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'nobody', label: 'Only me' },
]

const VisibilitySection = ({ visibility, set, vip }: { visibility: Visibility; set: SetForm; vip: boolean }) => (
  <Section id="visibility" num="05" label="Who sees your profile">
    <VipLock vip={vip}>
      <div className="border border-line">
        <Setting title="Profile visible to" hint="Everyone else sees only your name, avatar and badges.">
          <Segmented label="Profile visible to" options={VISIBILITY} value={visibility} onChange={(value) => set({ visibility: value })} />
        </Setting>
      </div>
    </VipLock>
  </Section>
)

/* ── 06 Ranked ── */

type Privacy = ProfilePrivacy

const eloShown = (hideElo: Privacy['hideElo'], ladder: 'tcg' | 'genesys') => hideElo !== 'both' && hideElo !== ladder

/** The two "Show … Elo" switches written back to the one `hideElo` value. */
const hideEloOf = (tcg: boolean, genesys: boolean): Privacy['hideElo'] => (tcg && genesys ? 'none' : tcg ? 'genesys' : genesys ? 'tcg' : 'both')

const RankedSection = ({ privacy, setPrivacy, vip }: { privacy: Privacy; setPrivacy: (patch: Partial<Privacy>) => void; vip: boolean }) => {
  const tcg = eloShown(privacy.hideElo, 'tcg')
  const genesys = eloShown(privacy.hideElo, 'genesys')
  return (
    <Section id="ranked" num="06" label="Ranked">
      <VipLock vip={vip}>
        <Group>
          <Setting title="Show TCG Elo" hint="Hides Elo, tier and rank for the TCG ladder. Your record stays visible.">
            <Toggle checked={tcg} onChange={(on) => setPrivacy({ hideElo: hideEloOf(on, genesys) })} label="Show TCG Elo" />
          </Setting>
          <Setting title="Show Genesys Elo" hint="Same for the Genesys ladder.">
            <Toggle checked={genesys} onChange={(on) => setPrivacy({ hideElo: hideEloOf(tcg, on) })} label="Show Genesys Elo" />
          </Setting>
          <Setting title="Show past seasons" hint="Final rank, tier and record of every closed season.">
            <Toggle checked={privacy.showPastSeasons} onChange={(on) => setPrivacy({ showPastSeasons: on })} label="Show past seasons" />
          </Setting>
          <Setting title="Show charts" hint="Elo over the season, the daily Elo change and your deck charts.">
            <Toggle checked={!privacy.hideCharts} onChange={(on) => setPrivacy({ hideCharts: !on })} label="Show charts" />
          </Setting>
        </Group>
      </VipLock>
    </Section>
  )
}

/* ── 07 Duel history ── */

const PERIODS: { value: MatchWindow; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '28d', label: '28 days' },
  { value: 'season', label: 'Whole season' },
]

const HistorySection = ({ privacy, setPrivacy, vip }: { privacy: Privacy; setPrivacy: (patch: Partial<Privacy>) => void; vip: boolean }) => (
  <Section id="history" num="07" label="Duel history">
    <VipLock vip={vip}>
      <Group>
        <Setting title="Show duel history" hint="Off hides the whole section, the timeline of events included.">
          <Toggle checked={!privacy.hideMatches} onChange={(on) => setPrivacy({ hideMatches: !on })} label="Show duel history" />
        </Setting>
        <div className="flex items-center gap-2.5 bg-surface-200 px-5 py-2.5"><span className={LABEL}>When it&apos;s on</span></div>
        <Setting title="Period" hint="How far back visitors can scroll.">
          <Segmented label="Duel history period" options={PERIODS} value={privacy.matchWindow} onChange={(value) => setPrivacy({ matchWindow: value })} />
        </Setting>
        <Setting title="Delay by 24 hours" hint="Duels show up a day after they're played, so nobody can follow your games live.">
          <Toggle checked={privacy.delayMatches} onChange={(on) => setPrivacy({ delayMatches: on })} label="Delay duel history by 24 hours" />
        </Setting>
        <Setting title="History from past seasons" hint="Lets visitors pick a closed season in the duel history.">
          <Toggle checked={privacy.showPastSeasonMatches} onChange={(on) => setPrivacy({ showPastSeasonMatches: on })} label="Show history from past seasons" />
        </Setting>
        <Setting title="Show decks" hint="Your deck name and its art on each duel, and your deck charts. Off also turns the play-by-play off, since it shows the whole decklist.">
          <Toggle checked={!privacy.hideDecks} onChange={(on) => setPrivacy({ hideDecks: !on })} label="Show decks" />
        </Setting>
        <Setting title="Play-by-play timeline" hint="The cards used turn by turn when someone opens one of your duels.">
          <Toggle checked={!privacy.hideTimeline} onChange={(on) => setPrivacy({ hideTimeline: !on })} label="Show play-by-play timeline" />
        </Setting>
      </Group>
    </VipLock>
  </Section>
)

/* ── Editor ── */

const SECTIONS = [
  ['profile', 'Profile'],
  ['cover', 'Cover'],
  ['bio', 'Bio'],
  ['socials', 'Socials'],
  ['visibility', 'Visibility'],
  ['ranked', 'Ranked'],
  ['history', 'Duel history'],
] as const

type SaveStatus = { state: 'idle' | 'saving' | 'saved' } | { state: 'error'; message: string }

const Editor = ({ identity, initial, vip }: { identity: ProfileIdentity; initial: Form; vip: boolean }) => {
  const [saved, setSaved] = useState(initial)
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useState<SaveStatus>({ state: 'idle' })
  const [current, setCurrent] = useState<string>('profile')
  /** Remounts inputs that keep their own text, after a discard or save replaces the form. */
  const [revision, setRevision] = useState(0)

  const set: SetForm = (patch) => {
    setForm((now) => ({ ...now, ...(typeof patch === 'function' ? patch(now) : patch) }))
    setStatus((now) => (now.state === 'saving' ? now : { state: 'idle' }))
  }
  const setPrivacy = (patch: Partial<ProfilePrivacy>) => set((now) => ({ privacy: { ...now.privacy, ...patch } }))

  // The side nav follows the section in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setCurrent(top.target.id)
      },
      { rootMargin: '-96px 0px -60% 0px' },
    )
    for (const [id] of SECTIONS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  const patch = useMemo(() => diff(saved, form), [saved, form])
  const dirty = Object.keys(patch).length > 0
  const problem = vip ? bioProblem(form.bio) : null
  const canSave = dirty && !problem && status.state !== 'saving'

  const replace = (next: Form) => {
    setSaved(next)
    setForm(next)
    setRevision((n) => n + 1)
  }

  const save = async () => {
    if (!canSave) return
    setStatus({ state: 'saving' })
    try {
      replace(toForm(await updateProfile(patch)))
      setStatus({ state: 'saved' })
    } catch (error) {
      if (error instanceof ProfileApiError && error.status === 401) return signIn()
      console.error(error)
      setStatus({ state: 'error', message: saveError(error) })
    }
  }

  const note =
    status.state === 'error' ? { text: status.message, className: 'text-loss' }
    : status.state === 'saving' ? { text: 'Saving…', className: 'text-ink-muted' }
    : dirty && problem ? { text: 'Fix your bio before saving', className: 'text-loss' }
    : dirty ? { text: 'Unsaved changes', className: 'text-cyan' }
    : status.state === 'saved' ? { text: 'All changes saved', className: 'text-win' }
    : null

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-4 pt-10 pb-16 min-[1312px]:px-0">
      <header className="flex flex-wrap items-end gap-6">
        <div className="flex grow flex-col gap-3">
          <div className="flex items-center gap-2.5">
            {vip ? <Chip tone="vip">VIP</Chip> : null}
            <span className={LABEL}>Your profile{identity.handle ? ` · ${identity.handle}` : ''}</span>
          </div>
          <h1 className="font-display text-[56px] leading-none uppercase max-md:text-[40px]">Edit profile</h1>
          <p className="max-w-[64ch] text-base leading-6 text-ink-dim">
            Changes show on your profile as soon as you save. Hidden sections disappear for everyone else; you always see your full profile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 max-md:w-full max-md:*:grow">
          <Button variant="secondary" href={`/profile/${identity.id}?as=visitor`}><Icon name="user" />View as visitor</Button>
          <Button disabled={!canSave} onClick={save}>{status.state === 'saving' ? 'Saving…' : 'Save changes'}</Button>
        </div>
        {note ? <p role="status" className={twMerge('w-full signal-nav', note.className)}>{note.text}</p> : null}
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Profile settings" className="flex flex-col gap-0.5 border-l border-line max-lg:hidden lg:sticky lg:top-24">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={current === id ? 'true' : undefined}
              className="flex items-center gap-2.5 border-l-2 border-transparent px-3.5 py-3 font-mono text-[11px] leading-3.5 font-bold tracking-[0.14em] text-ink-dim uppercase no-underline aria-[current]:border-cyan aria-[current]:bg-surface-100 aria-[current]:text-ink"
            >
              {label}
            </a>
          ))}
          <div className="mt-6 flex flex-col gap-2.5 border border-line-strong bg-steel px-3.5 py-4">
            <span className={twMerge(LABEL, 'text-ink-dim')}>VIP</span>
            <b className="text-[15px]">Full statistics</b>
            <span className="text-[13px] leading-4.75 text-ink-dim">Matchups, deck trends and every season in detail.</span>
            <a href={`/profile/${identity.id}/statistics`} className="font-mono text-[11px] leading-3.5 font-bold tracking-[0.14em] text-cyan uppercase">Open statistics</a>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          <ProfileSection key={revision} form={form} set={set} />
          <CoverSection form={form} set={set} vip={vip} />
          <BioSection bio={form.bio} set={set} vip={vip} />
          <SocialsSection socials={form.socials} set={set} vip={vip} />
          <VisibilitySection visibility={form.visibility} set={set} vip={vip} />
          <RankedSection privacy={form.privacy} setPrivacy={setPrivacy} vip={vip} />
          <HistorySection privacy={form.privacy} setPrivacy={setPrivacy} vip={vip} />
          {dirty ? (
            <div className="flex justify-end gap-3">
              <Button variant="ghost" disabled={status.state === 'saving'} onClick={() => { replace(saved); setStatus({ state: 'idle' }) }}>Discard changes</Button>
              <Button disabled={!canSave} onClick={save}>{status.state === 'saving' ? 'Saving…' : 'Save changes'}</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ── Page: sign-in gate, then the owner's own profile (PROFILE_API.md §3.3 "Prefilling a settings form") ── */

type Loaded = { identity: ProfileIdentity; initial: Form; vip: boolean }

export const EditProfile = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [loaded, setLoaded] = useState<Loaded | 'error' | null>(null)

  useEffect(() => {
    if (user === null) {
      router.replace("/login")
      return
    }
    if (!user) return

    let active = true
    // The form shows no duels, so ask for the smallest page the API allows instead of the default 6.
    getProfile(user.id, null, 1)
      .then((profile) => {
        // As the owner the API always sends the full profile, `visibility` and `privacy` included.
        if (!profile || profile.isPrivate || !profile.visibility || !profile.privacy) throw new Error('Own profile came back without settings')
        if (!active) return
        setLoaded({
          identity: profile,
          vip: profile.isVip,
          initial: toForm({
            bio: profile.bio ?? '',
            region: profile.region,
            coverImage: profile.coverImage ?? null,
            visibility: profile.visibility,
            hideLastSeen: profile.hideLastSeen ?? false,
            favoriteCard: profile.favoriteCard,
            favoriteDeck: profile.favoriteDeck,
            socials: profile.socials ?? [],
            privacy: profile.privacy,
          }),
        })
      })
      .catch((error) => {
        console.error(error)
        if (active) setLoaded('error')
      })
    return () => {
      active = false
    }
  }, [user, router])

  if (loaded === 'error') return <ErrorPage />
  if (!loaded) return <p role="status" className="px-5 py-16 text-ink-muted signal-nav sm:px-6 lg:px-11">Loading your profile…</p>

  return <Editor identity={loaded.identity} initial={loaded.initial} vip={loaded.vip} />
}
