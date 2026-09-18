/** Stands in for everything below the masthead when the duelist hides their profile from this viewer. */
export const PrivateNotice = () => (
  <div className="flex flex-wrap items-center gap-7 border-b border-line-strong px-5.5 py-12 lg:px-11 lg:py-14">
    <div aria-hidden className="flex size-18 shrink-0 items-center justify-center border border-line">
      <span className="block size-2.5 bg-surface-400" />
    </div>
    <div>
      <h2 className="text-ink display-4">This profile is private</h2>
      <p className="mt-3 max-w-[52ch] text-ink-dim body">
        The duelist has hidden their bio, favorites, ranked standing and match history. Depending on their setting, friends or rivals can still see it.
      </p>
    </div>
  </div>
)
