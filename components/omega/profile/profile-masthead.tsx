import Image from "next/image";
import { twMerge } from "tailwind-merge";
import { Chip } from "@ui/chip";
import type { ProfileIdentity, ProfileSocial, Region } from "@utils/types";
import { MICRO_TAG, MUTED_TAG } from "./accent";
import { AddToList } from "./add-to-list";
import { REGION_LABEL } from "./labels";
import { LocalTime } from "./local-time";
import { ProfileBio } from "./profile-bio";
import { SocialStrip } from "./social-strip";

type ProfileMastheadProps = ProfileIdentity & {
  isPrivate: boolean
  /** The viewer owns this profile, so there is nobody to add. */
  isOwner?: boolean
  /** Withheld on private profiles. */
  bio?: string
  region?: Region | null
  socials?: ProfileSocial[]
  /** Pulls the avatar up over the cover. */
  hasCover?: boolean
  /** Stat cells, placed under the bio or as a side column on wide screens. */
  children?: React.ReactNode
}

const TAG_GHOST = twMerge(MICRO_TAG, "border-surface-400 font-normal text-ink-dim")

export const ProfileMasthead = ({
  id,
  displayName,
  handle,
  avatar,
  lastLogin,
  relation,
  isPrivate,
  isOwner,
  bio,
  region,
  socials,
  hasCover,
  children,
}: ProfileMastheadProps) => {
  const name = displayName ?? handle ?? 'Unknown duelist'

  return (
    <section className="grid grid-cols-1 border-b border-line-strong xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col justify-center px-5.5 py-8 lg:px-11 lg:py-11">
        <div
          className={twMerge(
            // `relative` so the row paints over the cover, which is positioned and would otherwise win.
            "relative flex flex-wrap items-end gap-4.5 lg:gap-7",
            // Lifts the whole row onto the cover: the avatar overlaps it, the badges land just above
            // its bottom edge, and the bottom-aligned handle lines up with the avatar's base.
            hasCover && "-mt-21 lg:-mt-32",
          )}
        >
          {avatar ? (
            // AvatarPlate: void-bordered duotone square lifted by the offset shadow.
            <div className="relative size-31 shrink-0 overflow-hidden border-5 border-surface-000 bg-surface-200 shadow-offset-void lg:size-49">
              <Image
                src={avatar}
                alt={`${name} profile picture`}
                priority
                sizes="(min-width: 1024px) 196px, 124px"
                width={248}
                height={248}
                className="size-full object-cover duotone"
              />
              <span aria-hidden className="duotone-wash bg-cyan opacity-(--opacity-duotone-plate)" />
            </div>
          ) : null}

          <div className="min-w-0 flex-[1_1_360px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <Chip solid tone={isPrivate ? 'neutral' : 'gold'} className={twMerge(MICRO_TAG, isPrivate && MUTED_TAG)}>
                {isPrivate ? 'Private profile' : 'Public profile'}
              </Chip>
              {lastLogin ? (
                <Chip className={TAG_GHOST}>
                  Last seen&nbsp;<LocalTime iso={lastLogin} options={{ dateStyle: 'medium' }} />
                </Chip>
              ) : null}
              {region ? <Chip className={TAG_GHOST}>Region: {REGION_LABEL[region]}</Chip> : null}
            </div>

            <h1 className="mt-4.5 text-ink display-hero">{name}</h1>

            <div className="mt-3.5 flex flex-wrap items-center gap-4">
              {handle ? <p className="font-mono text-base text-gold">{handle}</p> : null}
              {!isOwner && <AddToList id={id} handle={handle ?? name} status={relation} />}
            </div>
          </div>
        </div>

        {bio ? <ProfileBio markdown={bio} className="mt-5.5" /> : null}
        {socials?.length ? <SocialStrip socials={socials} className="mt-6.5" /> : null}
      </div>

      {children}
    </section>
  )
}
