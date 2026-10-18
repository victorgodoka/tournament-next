'use client'

import { useEffect, useRef } from 'react'

/**
 * Blocks the page while `label` is set: a modal `<dialog>` makes everything else inert (clicks, Tab, the
 * editor's shortcuts, which skip an open dialog). Escape doesn't close it. It fades in after 200ms, so
 * work that settles at once doesn't flash.
 */
export const BusyDialog = ({ label }: { label: string | null }) => {
  const ref = useRef<HTMLDialogElement>(null)
  const open = label !== null

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label ?? undefined}
      onCancel={(e) => e.preventDefault()}
      // Chrome lets a second Escape close a dialog whose cancel was refused: open it again while still busy.
      onClose={(e) => open && e.currentTarget.showModal()}
      className="m-0 size-full max-h-none max-w-none place-items-center bg-scrim p-0 text-ink opacity-100 transition-opacity delay-200 duration-150 backdrop:bg-transparent open:grid starting:open:opacity-0"
    >
      <div role="status" className="cut flex items-center gap-3 px-5 py-4 body-strong [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)]">
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
        {label}
      </div>
    </dialog>
  )
}
