import { Button } from "@ui/button";
import { DOWNLOAD_URL } from "@utils/const";

/** Phone-only download bar pinned to the bottom edge. */
export const FixedBar = () => (
  <aside className="fixed inset-x-0 bottom-0 z-(--z-sticky) flex items-center gap-3.5 border-t border-line-strong bg-surface-000 px-4 py-3 sm:hidden">
    <div className="min-w-0 flex-1">
      <p className="text-ink dock-title tracking-[.04em]">Every card unlocked</p>
      <p className="mt-1 font-mono text-[9px] tracking-[.1em] text-ink-muted uppercase">Install under 2 minutes</p>
    </div>
    <Button size="sm" href={DOWNLOAD_URL}>Download free</Button>
  </aside>
)
