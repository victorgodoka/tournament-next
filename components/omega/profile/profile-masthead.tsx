import Image from "next/image";
import Link from "next/link";
import type { ProfileIdentity, ProfileSocial, Region, Visibility } from "@utils/types";
import { AddToList } from "./add-to-list";
import { REGION_LABEL, VISIBILITY_LABEL } from "./labels";
import { LocalTime } from "./local-time";
import { SocialStrip } from "./social-strip";

type ProfileMastheadProps = ProfileIdentity & {
  isPrivate: boolean
  /** Sent to the owner only, so its presence is what says the viewer may edit this profile. */
  visibility?: Visibility
  region?: Region | null
  socials?: ProfileSocial[]
}

const META = "text-ink-muted signal-sm"

export const ProfileMasthead = ({
  id,
  displayName,
  handle,
  avatar,
  lastLogin,
  relation,
  isPrivate,
  visibility,
  region,
  socials,
}: ProfileMastheadProps) => {
  const name = displayName ?? handle ?? 'Unknown duelist'
  const isOwner = visibility !== undefined

  return (
    <section className="flex flex-wrap items-start gap-[clamp(16px,2.5vw,28px)] pt-section">
      {avatar ? (
        <div className="size-(--avatar) relative shrink-0 border-5 border-surface-000 bg-surface-100 shadow-offset-void-sm [--avatar:clamp(96px,13vw,148px)]">
          <Image src={avatar} alt={`${name} profile picture`} priority sizes="148px" fill className="object-cover" />
        </div>
      ) : null}

      <div className="min-w-0 flex-[1_1_240px] pt-[clamp(12px,2vw,22px)]">
        <h1 className="text-ink display-1">{name}</h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
          {handle ? <span className="text-ink-muted mono-data">{handle}</span> : null}
          {isPrivate ? <span className={META}>Private profile</span> : null}
          {visibility ? (
            <Link href="/profile/edit" className="text-gold signal-sm hover:text-cyan">
              {VISIBILITY_LABEL[visibility]} · Edit
            </Link>
          ) : null}
          {region ? <span className={META}>{REGION_LABEL[region]}</span> : null}
          {lastLogin ? (
            <span className={META}>
              Last seen <LocalTime iso={lastLogin} options={{ dateStyle: 'medium' }} />
            </span>
          ) : null}
        </div>

        {socials?.length ? <SocialStrip socials={socials} className="mt-4" /> : null}
      </div>

      {!isOwner ? (
        <div className="ml-auto pt-[clamp(0px,2vw,22px)]">
          <AddToList id={id} handle={handle ?? name} status={relation} />
        </div>
      ) : null}
    </section>
  )
}
