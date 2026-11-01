"use client";
import { Children, useRef } from "react"
import { twMerge } from "tailwind-merge"
import { Button } from "@ui/button"
import { Icon } from "../icon"

/** Snap-scrolling strip; each child becomes a slide and the arrows move it by one slide. */
export const Carousel = ({
  label,
  children,
  itemClassName,
  className,
}: {
  /** Accessible name of the list; also used for the arrow labels. */
  label: string
  children: React.ReactNode
  itemClassName?: string
  className?: string
}) => {
  const list = useRef<HTMLUListElement>(null)
  const step = (dir: 1 | -1) => {
    const el = list.current
    const item = el?.firstElementChild as HTMLElement | null
    if (!el || !item) return
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    el.scrollBy({ left: dir * (item.offsetWidth + gap), behavior: "smooth" })
  }

  return (
    <div className={twMerge("flex flex-col gap-5", className)}>
      <div className="flex justify-end gap-2">
        <Button size="icon" variant="secondary" aria-label={`Previous: ${label}`} onClick={() => step(-1)}>
          <Icon name="left" />
        </Button>
        <Button size="icon" variant="secondary" aria-label={`Next: ${label}`} onClick={() => step(1)}>
          <Icon name="right" />
        </Button>
      </div>
      <ul ref={list} aria-label={label} className="-mr-gutter flex snap-x snap-mandatory gap-5 overflow-x-auto pr-gutter pb-3 scrollbar-none motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden">
        {Children.map(children, (child) => (
          <li className={twMerge("flex-[0_0_clamp(240px,26vw,300px)] snap-start", itemClassName)}>{child}</li>
        ))}
      </ul>
    </div>
  )
}
