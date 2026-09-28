import Image from 'next/image'
import Link from 'next/link'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { AvatarFrame } from '@ui/avatar'
import { Eyebrow } from '@ui/eyebrow'
import { duelistName, type Duelist } from '@utils/analytics'
import { periodOption, type AnalyticsPeriod, type SegmentOption } from '@utils/explorer'
import { getPastSeasons } from '@utils/ranked'
import type { Cosmetics, PastSeasons, Profile } from '@utils/types'

export const duelistLabel = (profile: Profile) => profile.displayName ?? profile.handle ?? 'Unknown duelist'

/**
 * What the Segments panel offers: each ladder's `current:*` (follows the open season), then every
 * ended season of both ladders, then the panel's periods. The open one is only offered as
 * `current:*`, never twice. The first is what a new exploration compares.
 */
export const segmentOptions = (profile: Extract<Profile, { isPrivate: false }>, past: PastSeasons[], periods: AnalyticsPeriod[]): SegmentOption[] => [
  ...profile.currentSeasons.map(({ format, code, label }) => ({
    id: `current:${format.toLowerCase()}`,
    label: `Current ${format}`,
    sub: `Follows the ladder · now ${label}`,
    code,
  })),
  ...past.flatMap(({ format, seasons }) => seasons.map(({ code, label }) => ({ id: code, label: `${format} · ${label}`, sub: 'Ended', code }))),
  ...periods.map(periodOption),
]

/** Ended seasons of both ladders. A failed read leaves only `current:*`, not a broken page. */
export const loadPastSeasons = () =>
  Promise.all((['tcg', 'genesys'] as const).map((ladder) => getPastSeasons(ladder).catch(() => null))).then((all) =>
    all.filter((p): p is PastSeasons => p !== null),
  )

/** The ladder the duelist actually plays, else TCG. */
export const defaultSegment = (profile: Extract<Profile, { isPrivate: false }>) =>
  `current:${(profile.ladders.find((l) => l.played)?.format ?? 'TCG').toLowerCase()}`

/** Who the page is about: a profile, or the `owner` of a shared exploration. */
export type Person = { id: string; name: string; handle: string | null; avatar: string | null; cosmetics?: Cosmetics }

export const personOf = (profile: Profile): Person => ({ id: profile.id, name: duelistLabel(profile), handle: profile.handle, avatar: profile.avatar, cosmetics: profile.cosmetics })
export const personOfDuelist = (d: Duelist): Person => ({ id: d.id, name: duelistName(d), handle: d.username, avatar: d.avatar })

type AnalyticsShellProps = {
  person?: Person
  eyebrow: string
  /** Provenance after the eyebrow's rule. */
  meta?: string
  /** Where "←" goes, and what it says. */
  back?: { href: string; label: string }
  /** The heading. Defaults to the person's name, which then moves under it as a link. */
  title?: string
  aside?: React.ReactNode
  children: React.ReactNode
}

/** Header, page head and footer shared by the analytics pages. Wider than the page grid: the builder needs it. */
export const AnalyticsShell = ({ person, eyebrow, meta, back, title, aside, children }: AnalyticsShellProps) => (
  <>
    <Header />
    <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
      <div className="mx-auto w-full max-w-[1440px] px-gutter">
        <section className="pt-section">
          {back ? (
            <Link href={back.href} className="inline-flex min-h-11 items-center text-ink-muted signal hover:text-cyan">
              ← {back.label}
            </Link>
          ) : null}
          <Eyebrow tone="cyan" meta={meta} className="mt-3">{eyebrow}</Eyebrow>
          <div className="mt-5 flex flex-wrap items-end gap-[clamp(14px,2vw,22px)]">
            {person?.avatar ? (
              <div className="relative size-[clamp(56px,7vw,80px)] shrink-0 border-3 border-space-000 bg-surface-100 shadow-lift">
                <Image src={person.avatar} alt="" fill sizes="80px" className="object-cover" />
                <AvatarFrame cosmetics={person.cosmetics} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="text-ink display-1">{title ?? person?.name}</h1>
              {person ? (
                <p className="mt-1.5 text-ink-dim mono-data">
                  {title ? (
                    <Link href={`/profile/${person.id}`} className="hover:text-cyan">{person.name}</Link>
                  ) : (
                    person.handle ? `@${person.handle}` : null
                  )}
                </p>
              ) : null}
            </div>
            {aside}
          </div>
        </section>
        {children}
      </div>
    </main>
    <Footer />
  </>
)
