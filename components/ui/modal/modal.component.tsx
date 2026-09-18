"use client";
import { useEffect } from "react"
import { twMerge } from "tailwind-merge"

type ModalProps = React.HTMLAttributes<HTMLDivElement> & {
  isOpen: boolean
  onClose: () => void
}

/** Overlay at z-overlay over the page-color scrim. Closes on Escape, on the scrim, or on Close. */
export const Modal = ({ isOpen, onClose, className, children, ...props }: ModalProps) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [onClose, isOpen])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={twMerge("fixed inset-0 z-(--z-overlay) flex items-center justify-center overflow-hidden bg-scrim p-4", className)}
      {...props}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 flex min-h-8 cursor-pointer items-center gap-2 border border-surface-400 bg-surface-000 px-2.75 text-ink signal hover:bg-ink hover:text-ink-on"
      >
        Close <span aria-hidden className="text-sm leading-none font-bold">×</span>
      </button>
      {children}
    </div>
  )
}
