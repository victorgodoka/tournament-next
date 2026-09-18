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
import { useAuth } from "@hooks/index";
import { signIn } from "@utils/auth";
import { archetypeCover, searchArchetypes, searchCards } from "@utils/cards";
import { CoverRejectedError, coverUrl, getProfile, ProfileApiError, updateProfile, uploadCover } from "@utils/profile";
import type { ProfileIdentity, ProfileSettingsPatch, Region, Visibility } from "@utils/types";
import { bioProblem, BIO_MAX, COVER_MAX_BYTES, COVER_TYPES, DECK_NAME_MAX, diff, SOCIAL_FIELDS, toForm, type Form } from "./form";

/** Longest keys first, so `favoriteDeckCardId` is not read as another field. The API message names the field. */
const FIELD_LABEL: [keyof ProfileSettingsPatch, string][] = [
  ['favoriteDeckCardId', 'favorite deck art'], ['favoriteDeckName', 'favorite deck'], ['favoriteCardId', 'favorite card'],
  ['coverImageId', 'cover image'], ['visibility', 'privacy setting'], ['socials', 'socials'], ['region', 'region'], ['bio', 'bio'],
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

function useSearch<T>(text: string, search: (text: string, signal: AbortSignal) => Promise<T[]>) {
  const [results, setResults] = useState<T[]>([])
  const query = text.trim()

  useEffect(() => {
    if (query.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => search(query, controller.signal).then(setResults).catch(() => {}), 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, search])

  return query.length < 2 ? [] : results
}

/* ── Shared styles ── */

const LABEL = "block text-ink-muted signal-sm"
const INPUT = "w-full border border-surface-400 bg-surface-200 px-3.5 py-3.25 text-[15px] text-ink placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
const OUTLINE_BUTTON = buttonClasses({ variant: 'secondary', size: 'sm' })
const MINOR_BUTTON = "inline-flex min-h-11.5 cursor-pointer items-center border border-line px-5 text-ink-muted signal-tab"

const Row = ({ index, title, blurb, className, children }: { index: string; title: string; blurb: string; className?: string; children: React.ReactNode }) => (
  <section className={twMerge("grid grid-cols-1 gap-4.5 border-b border-line px-5.5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-11 lg:p-11", className)}>
    <div>
      <p className="font-bold text-gold signal-lg">{index}</p>
      <h2 className="mt-3.5 text-ink display-4">{title}</h2>
      <p className="mt-2.5 max-w-[34ch] text-ink-dim body-sm">{blurb}</p>
    </div>
    <div className="min-w-0">{children}</div>
  </section>
)

type SetForm = (patch: Partial<Form> | ((form: Form) => Partial<Form>)) => void

/* ── 01 Cover ── */

const CoverSection = ({ coverImageId, set, onUploaded }: { coverImageId: string | null; set: SetForm; onUploaded: (coverImageId: string | null) => void }) => {
  /** Cloudinary's versioned URL, shown right after an upload because the plain id URL may still be cached. */
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const [upload, setUpload] = useState<{ state: 'idle' | 'uploading' | 'off' } | { state: 'error'; message: string }>({ state: 'idle' })

  const src = coverImageId ? freshUrl ?? coverUrl(coverImageId) : null

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!COVER_TYPES.includes(file.type)) return setUpload({ state: 'error', message: 'Use a JPG or PNG image.' })
    if (file.size > COVER_MAX_BYTES) return setUpload({ state: 'error', message: 'Keep the image under 4 MB.' })

    setUpload({ state: 'uploading' })
    try {
      const result = await uploadCover(file)
      setFreshUrl(result.coverUrl)
      onUploaded(result.settings.coverImageId)
      setUpload({ state: 'idle' })
    } catch (error) {
      if (error instanceof CoverRejectedError) return setUpload({ state: 'error', message: 'This image isn’t allowed. Pick a different one.' })
      if (error instanceof ProfileApiError && error.code === 'NOT_CONFIGURED') return setUpload({ state: 'off' })
      if (error instanceof ProfileApiError && error.status === 401) return signIn()
      console.error(error)
      setUpload({ state: 'error', message: 'Upload failed. Try again.' })
    }
  }

  return (
    <Row index="01" title="Cover image" blurb="Shown across the top of your public profile. 1920 × 1080 or wider, JPG or PNG, up to 4 MB. Uploads save right away.">
      <div className="relative h-42.5 overflow-hidden border border-line sm:h-57.5">
        {coverImageId ? (
          <>
            {src ? <Image src={src} alt="Current cover image" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover object-[center_40%] grayscale contrast-115" /> : null}
            <span aria-hidden className="duotone-wash bg-cyan" />
            <span aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent from-55% to-veil-base" />
            <span className="absolute top-0 left-0 bg-cyan px-3 py-2 text-cyan-on signal-chip">Current</span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-surface-200 p-6 text-center">
            <span aria-hidden className="size-2.5 bg-surface-400" />
            <p className="mt-3.5 text-ink-dim display-6">No cover set</p>
            <p className="mt-2 max-w-[38ch] text-ink-muted caption">Your profile shows no header image until you upload one.</p>
          </div>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2.5">
        {upload.state === 'off' ? null : (
          <label className={twMerge(OUTLINE_BUTTON, "has-focus-visible:shadow-focus", upload.state === 'uploading' && "pointer-events-none cursor-wait opacity-(--opacity-dim)")}>
            <input type="file" accept={COVER_TYPES.join(',')} onChange={onFile} disabled={upload.state === 'uploading'} className="sr-only" />
            {upload.state === 'uploading' ? 'Uploading…' : coverImageId ? 'Replace image' : 'Upload cover'}
          </label>
        )}
        {coverImageId ? (
          <button type="button" onClick={() => set({ coverImageId: null })} className={twMerge(MINOR_BUTTON, "hover:border-gold hover:text-gold")}>
            Remove cover
          </button>
        ) : null}
      </div>

      {upload.state === 'error' ? <p role="alert" className="mt-3 text-gold caption">{upload.message}</p> : null}
      {upload.state === 'off' ? <p className="mt-3 font-mono text-[11px] tracking-[.04em] text-ink-muted">Cover uploads aren’t available right now.</p> : null}
    </Row>
  )
}

/* ── 02 Favorites ── */

const FavoritesSection = ({ form, set }: { form: Form; set: SetForm }) => {
  const [cardText, setCardText] = useState(form.favoriteCard?.name ?? '')
  const cards = useSearch(cardText, findCards)
  const archetypes = useSearch(form.favoriteDeckName, findArchetypes)
  const cardChoices = cards.length ? cards : form.favoriteCard ? [form.favoriteCard] : []

  const pickDeck = (name: string) => {
    set({ favoriteDeckName: name, favoriteDeckArt: null })
    archetypeCover(name)
      // Only if the name is still the one picked: the duelist may have kept typing.
      .then((art) => set((current) => (current.favoriteDeckName === name ? { favoriteDeckArt: art } : {})))
      .catch(() => {})
  }

  return (
    <Row index="02" title="Favorites" blurb="Card and deck shown in the band under your name. Search for a card, and pick an archetype or type any deck name.">
      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
        <div>
          <label htmlFor="fav-card" className={LABEL}>Favorite card</label>
          <input
            id="fav-card"
            value={cardText}
            onChange={(e) => {
              setCardText(e.target.value)
              if (!e.target.value.trim()) set({ favoriteCard: null })
            }}
            placeholder="Search a card…"
            autoComplete="off"
            className={twMerge(INPUT, "mt-2.5")}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cardChoices.map((card) => {
              const selected = card.id === form.favoriteCard?.id
              return (
                <button
                  key={card.id}
                  type="button"
                  title={card.name ?? undefined}
                  aria-label={`Pick ${card.name ?? `card ${card.id}`}`}
                  aria-pressed={selected}
                  onClick={() => {
                    set({ favoriteCard: card })
                    setCardText(card.name ?? '')
                  }}
                  className={twMerge("cursor-pointer border-2 p-0", selected ? "border-gold" : "border-line hover:border-line-strong")}
                >
                  <CardArt art={card} alt="" sizes="54px" className="size-12.5" />
                </button>
              )
            })}
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            {form.favoriteCard ? `Selected: ${form.favoriteCard.name ?? `card ${form.favoriteCard.id}`}` : 'No favorite card'}
          </p>
        </div>

        <div>
          <label htmlFor="fav-deck" className={LABEL}>Favorite deck</label>
          <input
            id="fav-deck"
            value={form.favoriteDeckName}
            onChange={(e) => set({ favoriteDeckName: e.target.value, favoriteDeckArt: null })}
            placeholder="Archetype or build name…"
            maxLength={DECK_NAME_MAX}
            autoComplete="off"
            className={twMerge(INPUT, "mt-2.5")}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {archetypes.map((name) => {
              const selected = name === form.favoriteDeckName
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickDeck(name)}
                  className={twMerge(
                    "cursor-pointer border px-3 py-2.25 signal-chip",
                    selected ? "border-gold bg-gold text-gold-on" : "border-surface-400 text-ink-muted hover:border-gold hover:text-gold",
                  )}
                >
                  {name}
                </button>
              )
            })}
          </div>
          {form.favoriteDeckArt ? (
            <div className="mt-3 flex items-center gap-2.5">
              <CardArt art={form.favoriteDeckArt} alt="" sizes="36px" className="size-9 border border-line" />
              <p className="font-mono text-[11px] text-ink-muted">Deck art: {form.favoriteDeckArt.name}</p>
            </div>
          ) : null}
        </div>
      </div>
    </Row>
  )
}

/* ── 03 Bio ── */

const BioSection = ({ bio, set }: { bio: string; set: SetForm }) => {
  const problem = bioProblem(bio)

  return (
    <Row index="03" title="Bio" blurb="Markdown is supported: **bold**, *italic*, ~~strike~~, `code`, [links](https://…) and - lists. No raw HTML.">
      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="bio" className={LABEL}>Markdown source</label>
            <span className={twMerge("font-mono text-[10px] tracking-[.14em]", bio.length > BIO_MAX ? "text-gold" : "text-ink-muted")}>
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
            className={twMerge(INPUT, "mt-2.5 resize-y p-3.5 font-mono text-[13px] leading-[1.6]")}
          />
          {problem ? <p id="bio-problem" role="alert" className="mt-2 text-gold caption">{problem}</p> : null}
        </div>
        <div>
          <p className="text-cyan signal-sm">Live preview</p>
          <div className="mt-2.5 min-h-30 border border-line bg-surface-100 p-3.5">
            {bio.trim() ? <ProfileBio markdown={bio} /> : <p className="text-[15px] text-ink-muted italic">Nothing written yet.</p>}
          </div>
        </div>
      </div>
    </Row>
  )
}

/* ── 04 Socials ── */

const SocialsSection = ({ socials, set }: { socials: Form['socials']; set: SetForm }) => (
  <Row index="04" title="Socials" blurb="Empty fields stay hidden. Your profile shows the handle, and links to the platform.">
    <div className="grid gap-px border border-line bg-line">
      {SOCIAL_FIELDS.map(({ network, prefix, placeholder }) => (
        <div key={network} className="flex flex-wrap items-center gap-3 bg-surface-000 px-3.5 py-3">
          <label htmlFor={`social-${network}`} className={twMerge(LABEL, "basis-32.5")}>{SOCIAL[network].label}</label>
          <span aria-hidden className="text-gold mono-data">{prefix}</span>
          <input
            id={`social-${network}`}
            value={socials[network]}
            onChange={(e) => set((current) => ({ socials: { ...current.socials, [network]: e.target.value } }))}
            placeholder={placeholder}
            autoComplete="off"
            className={twMerge(INPUT, "min-w-0 flex-[1_1_200px] px-3 py-2.5 font-mono text-[13px]")}
          />
        </div>
      ))}
    </div>
  </Row>
)

/* ── 05 Privacy ── */

const PRIVACY: { id: Visibility; label: string; hint: string }[] = [
  { id: 'nobody', label: 'No one', hint: 'Only you see your full profile.' },
  { id: 'friends', label: 'Only friends', hint: 'Duelists linked with you as friends see your full profile.' },
  { id: 'friends_rivals', label: 'Friends and rivals', hint: 'Friends plus duelists linked with you as rivals.' },
  { id: 'everyone', label: 'Everyone', hint: 'Anyone, signed in or not, sees your full profile.' },
]

const PrivacySection = ({ visibility, set }: { visibility: Visibility; set: SetForm }) => (
  <Row index="05" title="Privacy" blurb="Controls who sees your bio, favorites, socials, ranked standing and match history. Name, avatar and last login stay public.">
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
            className={twMerge("flex w-full cursor-pointer items-start gap-3 px-4 py-3.75 text-left", selected ? "bg-surface-200 text-ink shadow-selected" : "bg-surface-000 text-ink-muted hover:bg-surface-300 hover:text-ink-dim")}
          >
            <span aria-hidden className={twMerge("mt-1.25 size-3.25 shrink-0 border", selected ? "border-gold bg-gold" : "border-ink-muted")} />
            <span className="min-w-0">
              <span className="block action-md">{label}</span>
              <span className="mt-1 block text-ink-muted caption">{hint}</span>
            </span>
          </button>
        )
      })}
    </div>
    <p className="mt-3.5 font-mono text-[11px] leading-normal tracking-[.04em] text-ink-muted">
      Pending friend or rival requests don’t grant access until they’re accepted.
    </p>
  </Row>
)

/* ── 06 Region ── */

const RegionSection = ({ region, set }: { region: Region | null; set: SetForm }) => (
  <Row index="06" title="Region" blurb="The server region you usually play from. Pick it again to clear it." className="border-line-strong">
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
              selected ? "border-gold bg-gold text-gold-on" : "border-surface-400 text-ink-muted hover:border-gold hover:text-gold",
            )}
          >
            {REGION_LABEL[id]}
          </button>
        )
      })}
    </div>
    <p className="mt-4 font-mono text-[11px] tracking-[.04em] text-ink-muted">
      {region ? `Region: ${REGION_LABEL[region]}` : 'No region set'}
    </p>
  </Row>
)

/* ── Editor ── */

type SaveStatus = { state: 'idle' | 'saving' | 'saved' } | { state: 'error'; message: string }

const Editor = ({ identity, initial }: { identity: ProfileIdentity; initial: Form }) => {
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

  /** Uploads are already saved, so they move the baseline too, not just the form. */
  const onCoverUploaded = (coverImageId: string | null) => {
    setSaved((current) => ({ ...current, coverImageId }))
    setForm((current) => ({ ...current, coverImageId }))
  }

  const note =
    status.state === 'error' ? { text: status.message, className: "text-gold" }
    : status.state === 'saving' ? { text: 'Saving…', className: "text-ink-muted" }
    : dirty && problem ? { text: 'Fix your bio before saving', className: "text-gold" }
    : dirty ? { text: 'Unsaved changes', className: "text-gold" }
    : status.state === 'saved' ? { text: 'All changes saved', className: "text-cyan" }
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
          <span className="relative size-14 shrink-0 overflow-hidden border border-line bg-surface-200">
            {identity.avatar ? <Image src={identity.avatar} alt="" fill sizes="56px" className="object-cover duotone" /> : null}
          </span>
          <span>
            <span className="block text-ink display-6 group-hover:text-gold">{name}</span>
            <span className="mt-1.5 block text-gold mono-data">{identity.handle ?? 'View public profile'}</span>
          </span>
        </Link>
      </div>

      <CoverSection coverImageId={form.coverImageId} set={set} onUploaded={onCoverUploaded} />
      <FavoritesSection key={revision} form={form} set={set} />
      <BioSection bio={form.bio} set={set} />
      <SocialsSection socials={form.socials} set={set} />
      <PrivacySection visibility={form.visibility} set={set} />
      <RegionSection region={form.region} set={set} />

      <div className="fixed inset-x-0 bottom-0 z-(--z-dock) flex flex-wrap items-center justify-between gap-4 border-t border-line-strong bg-surface-000 px-5.5 py-3 lg:px-11 lg:py-3.5">
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
    getProfile(user.id)
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
  if (!loaded) return <p role="status" className="px-5 py-16 font-mono text-[11px] tracking-[.16em] uppercase text-ink-muted sm:px-6 lg:px-11">Loading your profile…</p>

  return <Editor identity={loaded.identity} initial={loaded.initial} />
}
