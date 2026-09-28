'use client'

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { buttonClasses } from "@ui/button";
import { CardArt } from "@omega/card-art";
import ErrorPage from "@omega/error";
import { ProfileBio } from "@omega/profile";
import { REGION_LABEL, SOCIAL } from "@omega/profile/labels";
import { useAuth, useSearch } from "@hooks/index";
import { signIn } from "@utils/auth";
import { archetypeCover, searchArchetypes, searchCards } from "@utils/cards";
import { getProfile, ProfileApiError, updateProfile } from "@utils/profile";
import type { ProfileIdentity, ProfileSettingsPatch, Region, ShopEnum, Visibility } from "@utils/types";
import { TYPE_ICON, typesOf, useLoadout } from "@omega/inventory";
import { Avatar, AvatarFrame } from "@ui/avatar";
import { Icon } from "@ui/icon";
import { Thumb } from "@ui/thumb";
import { bioProblem, BIO_MAX, DECK_NAME_MAX, diff, SOCIAL_FIELDS, toForm, type Form } from "./form";

/** Longest keys first, so `favoriteDeckCardId` is not read as another field. The API message names the field. */
const FIELD_LABEL: [keyof ProfileSettingsPatch, string][] = [
  ['favoriteDeckCardId', 'favorite deck art'], ['favoriteDeckName', 'favorite deck'], ['favoriteCardId', 'favorite card'],
  ['visibility', 'privacy setting'], ['socials', 'socials'], ['region', 'region'], ['bio', 'bio'],
]

const saveError = (error: unknown) => {
  if (error instanceof ProfileApiError && error.status === 400) {
    const field = FIELD_LABEL.find(([key]) => error.message.includes(key))
    return field ? `Check your ${field[1]} and try again.` : 'Some fields were rejected. Check them and try again.'
  }
  return 'Couldn’t save. Try again in a moment.'
}

/* ── Debounced lookups ── */

const findCards = (text: string, signal: AbortSignal) => searchCards(text, 6, signal)
const findArchetypes = async (text: string, signal: AbortSignal) => (await searchArchetypes(text, signal)).slice(0, 5)

/* ── Shared styles ── */

const LABEL = "block text-ink-muted signal-sm"
const INPUT = "w-full border border-surface-400 bg-surface-200 px-3.5 py-3.25 text-ink body placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
const MINOR_BUTTON = "inline-flex min-h-11.5 cursor-pointer items-center border border-line px-5 text-ink-muted signal-tab"

const Row = ({ index, title, blurb, className, children }: { index: string; title: string; blurb: string; className?: string; children: React.ReactNode }) => (
  <section className={twMerge("grid grid-cols-1 gap-4.5 border-b border-line px-5.5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-11 lg:p-11", className)}>
    <div>
      <p className="font-bold text-cyan signal-lg">{index}</p>
      <h2 className="mt-3.5 text-ink display-4">{title}</h2>
      <p className="mt-2.5 max-w-[34ch] text-ink-dim body-sm">{blurb}</p>
    </div>
    <div className="min-w-0">{children}</div>
  </section>
)

type SetForm = (patch: Partial<Form> | ((form: Form) => Partial<Form>)) => void

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

/* ── 01 Favorites ── */

const FavoritesSection = ({ form, set }: { form: Form; set: SetForm }) => {
  const [cardText, setCardText] = useState(form.favoriteCard?.name ?? '')
  const cards = useSearch(cardText, findCards)
  const archetypes = useSearch(form.favoriteDeckName, findArchetypes)

  const pickDeck = (name: string) => {
    set({ favoriteDeckName: name, favoriteDeckArt: null })
    archetypeCover(name)
      // Only if the name is still the one picked: the duelist may have kept typing.
      .then((art) => set((current) => (current.favoriteDeckName === name ? { favoriteDeckArt: art } : {})))
      .catch(() => {})
  }

  return (
    <Row index="01" title="Favorites" blurb="Card and deck shown in the band under your name. Search for a card, and pick an archetype or type any deck name.">
      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
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
              <p className="text-ink-muted mono-note">Selected: {form.favoriteCard.name ?? `card ${form.favoriteCard.id}`}</p>
            </div>
          ) : (
            <p className="mt-3 text-ink-muted mono-note">No favorite card</p>
          )}
        </div>

        <div>
          <label htmlFor="fav-deck" className={LABEL}>Favorite deck</label>
          <Autocomplete
            id="fav-deck"
            value={form.favoriteDeckName}
            onChange={(text) => set({ favoriteDeckName: text, favoriteDeckArt: null })}
            options={archetypes.filter((name) => name !== form.favoriteDeckName)}
            optionKey={(name) => name}
            renderOption={(name) => name}
            onPick={pickDeck}
            placeholder="Archetype or build name…"
            maxLength={DECK_NAME_MAX}
          />
          {form.favoriteDeckArt ? (
            <div className="mt-3 flex items-center gap-2.5">
              <CardArt art={form.favoriteDeckArt} alt="" sizes="36px" className="size-9 border border-line" />
              <p className="text-ink-muted mono-note">Deck art: {form.favoriteDeckArt.name}</p>
            </div>
          ) : null}
        </div>
      </div>
    </Row>
  )
}

/* ── 02 Bio ── */

const BioSection = ({ bio, set }: { bio: string; set: SetForm }) => {
  const problem = bioProblem(bio)

  return (
    <Row index="02" title="Bio" blurb="Markdown is supported: **bold**, *italic*, ~~strike~~, `code`, [links](https://…) and - lists. No raw HTML.">
      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="bio" className={LABEL}>Markdown source</label>
            <span className={twMerge("mono-handle", bio.length > BIO_MAX ? "text-cyan" : "text-ink-muted")}>
              {bio.length} / {BIO_MAX}
            </span>
          </div>
          <textarea
            id="bio"
            rows={12}
            value={bio}
            onChange={(e) => set({ bio: e.target.value })}
            placeholder="Tell duelists who you are…"
            aria-invalid={!!problem}
            aria-describedby={problem ? 'bio-problem' : undefined}
            className={twMerge(INPUT, "mt-2.5 resize-y p-3.5 mono-data leading-relaxed")}
          />
          {problem ? <p id="bio-problem" role="alert" className="mt-2 text-loss caption">{problem}</p> : null}
        </div>
        <div>
          <p className="text-cyan signal-sm">Live preview</p>
          <div className="mt-2.5 min-h-30 border border-line bg-surface-100 p-3.5">
            {bio.trim() ? <ProfileBio markdown={bio} /> : <p className="text-ink-muted body italic">Nothing written yet.</p>}
          </div>
        </div>
      </div>
    </Row>
  )
}

/* ── 03 Socials ── */

const SocialsSection = ({ socials, set }: { socials: Form['socials']; set: SetForm }) => (
  <Row index="03" title="Socials" blurb="Empty fields stay hidden. Your profile shows the handle, and links to the platform.">
    <div className="grid gap-px border border-line bg-line">
      {SOCIAL_FIELDS.map(({ network, prefix, placeholder, max }) => (
        <div key={network} className="flex flex-wrap items-center gap-3 bg-space-000 px-3.5 py-3">
          <label htmlFor={`social-${network}`} className={twMerge(LABEL, "basis-32.5")}>{SOCIAL[network].label}</label>
          <span aria-hidden className="text-cyan mono-data">{prefix}</span>
          <input
            id={`social-${network}`}
            value={socials[network]}
            onChange={(e) => set((current) => ({ socials: { ...current.socials, [network]: e.target.value } }))}
            placeholder={placeholder}
            maxLength={max}
            autoComplete="off"
            className={twMerge(INPUT, "min-w-0 flex-[1_1_200px] px-3 py-2.5 mono-data")}
          />
        </div>
      ))}
    </div>
  </Row>
)

/* ── 04 Privacy ── */

const PRIVACY: { id: Visibility; label: string; hint: string }[] = [
  { id: 'nobody', label: 'No one', hint: 'Only you see your full profile.' },
  { id: 'friends', label: 'Only friends', hint: 'Duelists linked with you as friends see your full profile.' },
  { id: 'friends_rivals', label: 'Friends and rivals', hint: 'Friends plus duelists linked with you as rivals.' },
  { id: 'everyone', label: 'Everyone', hint: 'Anyone, signed in or not, sees your full profile.' },
]

const PrivacySection = ({ visibility, set }: { visibility: Visibility; set: SetForm }) => (
  <Row index="04" title="Privacy" blurb="Controls who sees your bio, favorites, socials, ranked standing and match history. Name, avatar and last login stay public.">
    <div role="radiogroup" aria-label="Who can see your profile" className="grid gap-px border border-line bg-line">
      {PRIVACY.map(({ id, label, hint }) => {
        const selected = id === visibility
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => set({ visibility: id })}
            className={twMerge("flex w-full cursor-pointer items-start gap-3 px-4 py-3.75 text-left", selected ? "bg-surface-200 text-ink shadow-selected" : "bg-space-000 text-ink-muted hover:bg-surface-300 hover:text-ink-dim")}
          >
            <span aria-hidden className={twMerge("mt-1.25 size-3.25 shrink-0 border", selected ? "border-cyan bg-cyan" : "border-ink-muted")} />
            <span className="min-w-0">
              <span className="block action-md">{label}</span>
              <span className="mt-1 block text-ink-muted caption">{hint}</span>
            </span>
          </button>
        )
      })}
    </div>
    <p className="mt-3.5 text-ink-muted mono-note">
      Pending friend or rival requests don’t grant access until they’re accepted.
    </p>
  </Row>
)

/* ── 05 Region ── */

const RegionSection = ({ region, set }: { region: Region | null; set: SetForm }) => (
  <Row index="05" title="Region" blurb="The server region you usually play from. Pick it again to clear it.">
    <div role="radiogroup" aria-label="Region" className="flex flex-wrap gap-2">
      {(Object.keys(REGION_LABEL) as Region[]).map((id) => {
        const selected = id === region
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => set({ region: selected ? null : id })}
            className={twMerge(
              "cursor-pointer border px-4 py-3 signal-tab",
              selected ? "border-cyan bg-cyan text-cyan-on" : "border-surface-400 text-ink-muted hover:border-cyan hover:text-cyan",
            )}
          >
            {REGION_LABEL[id]}
          </button>
        )
      })}
    </div>
    <p className="mt-4 text-ink-muted mono-note">
      {region ? `Region: ${REGION_LABEL[region]}` : 'No region set'}
    </p>
  </Row>
)

/* ── 06 Loadout ── */

const LoadoutSection = ({ types }: { types: ShopEnum[] }) => {
  const loadout = useLoadout()
  const { user, wallet } = loadout
  const t = typesOf(types)
  const owned = wallet?.items ?? []
  // Only the slots something owned can go in; the rest is a shop link away.
  const slots = t.slots.filter((slot) => owned.some((i) => i.type === slot.value))

  return (
    <Row index="06" title="Loadout" blurb="Frames, backgrounds and the rest of what you own. Picking one equips it right away; it doesn’t wait for Save." className="border-line-strong">
      <div className="flex flex-col gap-7">
        {user ? (
          <div className="flex items-center gap-5">
            <Avatar name={user.profile.username ?? 'Duelist'} src={user.profile.avatarUrl} cosmetics={user.cosmetics} size="lg" />
            <p className="text-ink-muted mono-note">Your avatar as others see it, frame included.</p>
          </div>
        ) : null}

        {!wallet ? (
          <p role="status" className="text-ink-muted mono-note">Loading your items…</p>
        ) : slots.length ? (
          slots.map((slot) => {
            const current = loadout.equipped[slot.value]?.id ?? null
            const choices = owned.filter((i) => i.type === slot.value)
            return (
              <div key={slot.value}>
                <p className={LABEL}>{slot.name} · {t.surfaces(slot.value)}</p>
                <div role="radiogroup" aria-label={slot.name} className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!current}
                    onClick={() => current && loadout.setSlot(slot.value, null)}
                    className={twMerge("grid size-16 cursor-pointer place-items-center border-2 text-ink-muted signal-sm", !current ? "border-cyan" : "border-line hover:border-line-strong")}
                  >
                    None
                  </button>
                  {choices.map((item) => {
                    const selected = item.id === current
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        title={item.name}
                        aria-label={item.name}
                        onClick={() => !selected && loadout.setSlot(slot.value, item)}
                        className={twMerge("cursor-pointer border-2 p-0", selected ? "border-cyan" : "border-line hover:border-line-strong")}
                      >
                        <Thumb wide src={item.assetUrl ?? `/items/${item.id}.png`} className="size-15">
                          <Icon name={TYPE_ICON[item.type] ?? 'cards'} size={24} />
                        </Thumb>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-ink-muted mono-note">{loadout.equipped[slot.value]?.name ?? 'Nothing equipped'}</p>
              </div>
            )
          })
        ) : (
          <p className="text-ink-muted mono-note">Nothing to equip yet. Get items in the <Link href="/shop" className="text-cyan hover:underline">shop</Link> or on the <Link href="/battlepass" className="text-cyan hover:underline">battlepass</Link>.</p>
        )}

        {loadout.error ? <p role="alert" className="text-loss caption">{loadout.error}</p> : null}
        <Link href="/inventory" className="text-cyan signal-strong hover:underline">Open your inventory →</Link>
      </div>
    </Row>
  )
}

/* ── Editor ── */

type SaveStatus = { state: 'idle' | 'saving' | 'saved' } | { state: 'error'; message: string }

const Editor = ({ identity, initial, types }: { identity: ProfileIdentity; initial: Form; types: ShopEnum[] }) => {
  const { user } = useAuth()
  const [saved, setSaved] = useState(initial)
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useState<SaveStatus>({ state: 'idle' })
  /** Remounts inputs that keep their own text, after a discard or save replaces the form. */
  const [revision, setRevision] = useState(0)

  const set: SetForm = (patch) => {
    setForm((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }))
    setStatus((current) => (current.state === 'saving' ? current : { state: 'idle' }))
  }

  const patch = useMemo(() => diff(saved, form), [saved, form])
  const dirty = Object.keys(patch).length > 0
  const problem = bioProblem(form.bio)
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
    status.state === 'error' ? { text: status.message, className: "text-loss" }
    : status.state === 'saving' ? { text: 'Saving…', className: "text-ink-muted" }
    : dirty && problem ? { text: 'Fix your bio before saving', className: "text-loss" }
    : dirty ? { text: 'Unsaved changes', className: "text-cyan" }
    : status.state === 'saved' ? { text: 'All changes saved', className: "text-win" }
    : { text: 'Everything up to date', className: "text-ink-muted" }

  const name = identity.displayName ?? identity.handle ?? 'Duelist'

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line-strong px-5.5 py-9 lg:p-11">
        <div>
          <p className="text-ink-muted signal-lg">Account settings</p>
          <h1 className="mt-3 text-ink display-1">Edit profile</h1>
        </div>
        <Link href={`/profile/${identity.id}`} className="group flex items-center gap-3">
          <span className="relative size-14 shrink-0 border border-line bg-surface-200">
            {identity.avatar ? <Image src={identity.avatar} alt="" fill sizes="56px" className="object-cover duotone" /> : null}
            <AvatarFrame cosmetics={user?.cosmetics ?? identity.cosmetics} />
          </span>
          <span>
            <span className="block text-ink display-6 group-hover:text-cyan">{name}</span>
            <span className="mt-1.5 block text-cyan mono-data">{identity.handle ?? 'View public profile'}</span>
          </span>
        </Link>
      </div>

      <FavoritesSection key={revision} form={form} set={set} />
      <BioSection bio={form.bio} set={set} />
      <SocialsSection socials={form.socials} set={set} />
      <PrivacySection visibility={form.visibility} set={set} />
      <RegionSection region={form.region} set={set} />
      <LoadoutSection types={types} />

      <div className="fixed inset-x-0 bottom-0 z-(--z-dock) flex flex-wrap items-center justify-between gap-4 border-t border-line-strong bg-space-000 px-5.5 py-3 lg:px-11 lg:py-3.5">
        <p role="status" className={twMerge("signal-nav", note.className)}>{note.text}</p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={!dirty || status.state === 'saving'}
            onClick={() => {
              replace(saved)
              setStatus({ state: 'idle' })
            }}
            className={twMerge(MINOR_BUTTON, "enabled:hover:border-line-strong enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-(--opacity-dim)")}
          >
            Discard changes
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={save}
            className={buttonClasses({ size: 'sm' })}
          >
            {status.state === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  )
}

/* ── Page: sign-in gate, then the owner's own profile (PROFILE_API.md §3.3 "Prefilling a settings form") ── */

type Loaded = { identity: ProfileIdentity; initial: Form }

export const EditProfile = ({ types }: { types: ShopEnum[] }) => {
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
        // As the owner the API always sends the full profile, `visibility` included.
        if (!profile || profile.isPrivate || !profile.visibility) throw new Error('Own profile came back without settings')
        if (active) setLoaded({ identity: profile, initial: toForm({ ...profile, visibility: profile.visibility }) })
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

  return <Editor identity={loaded.identity} initial={loaded.initial} types={types} />
}
