"use client";
import { useEffect } from "react"
import { twMerge } from "tailwind-merge"
import { buttonClasses } from "@ui/button"

type ModalProps = React.HTMLAttributes<HTMLDivElement> & {
  isOpen: boolean
  onClose: () => void
}

/** Overlay at z-modal over the scrim. Closes on Escape, on the scrim, or on Close. */
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
      className={twMerge("fixed inset-0 z-(--z-modal) flex items-center justify-center overflow-hidden bg-scrim p-4", className)}
      {...props}
    >
      <button
        type="button"
        onClick={onClose}
        className={twMerge(buttonClasses({ variant: 'secondary', size: 'mono' }), "absolute top-3 right-3")}
      >
        Close <span aria-hidden className="text-sm leading-none font-bold">×</span>
      </button>
      {children}
    </div>
  )
}
