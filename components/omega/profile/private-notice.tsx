import { EmptyBox } from "./empty-box";

/** Stands in for everything below the masthead when the duelist hides their profile from this viewer. */
export const PrivateNotice = () => (
  <div className="pt-section">
    <EmptyBox title="This profile is private">
      The duelist has hidden their bio, favorites, ranked standing and match history. Depending on their setting, friends or rivals can still see it. Add them to your list to ask for access.
    </EmptyBox>
  </div>
)
