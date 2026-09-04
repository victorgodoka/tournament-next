import { Icon } from "@iconify/react"
import { useEffect } from "react"
import { twMerge } from "tailwind-merge"

type ModalProps = React.HTMLAttributes<HTMLDivElement> & {
  isOpen: boolean
  onClose: () => void
}

export const Modal = ({ isOpen, onClose, ...props }: ModalProps) => {

  const handleClickOutside = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    isOpen && (window.document.body.style.overflow = "hidden")
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.document.body.style.overflow = "auto"
    }
  }, [onClose, isOpen])

  return (
    <div onClick={handleClickOutside} className={twMerge("fixed transition-all ease-in-out inset-0 z-100 items-center justify-center bg-black/90 p-4 overflow-hidden", isOpen ? "flex visible opacity-100" : "hidden invisible opacity-0")} {...props}>
      <Icon icon="mdi:close" className="text-4xl absolute top-2 right-2 cursor-pointer text-white" onClick={onClose} />
      {props.children}
    </div>
  )
}
