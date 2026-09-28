import type { ProfileIdentity, ProfileSocial, Region, Visibility } from "@utils/types";
import { Button } from "@ui/button";
import { ProfileHeader } from "@ui/profile-header";
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

/** The profile's DS ProfileHeader, fed from the API identity, with the social strip under it. */
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
  const name = displayName ?? handle ?? null

  return (
    <div className="pt-section">
      <ProfileHeader
        name={name}
        handle={handle}
        avatar={avatar}
        meta={[
          region ? REGION_LABEL[region] : null,
          lastLogin ? <>Last seen <LocalTime iso={lastLogin} options={{ dateStyle: 'medium' }} /></> : null,
          isPrivate ? 'Private profile' : null,
          visibility ? VISIBILITY_LABEL[visibility] : null,
        ]}
        actions={
          visibility !== undefined ? (
            <Button href="/profile/edit">Edit profile</Button>
          ) : (
            <AddToList id={id} handle={handle ?? name ?? 'Unknown duelist'} status={relation} />
          )
        }
      />
      {socials?.length ? <SocialStrip socials={socials} className="mt-4" /> : null}
    </div>
  )
}
