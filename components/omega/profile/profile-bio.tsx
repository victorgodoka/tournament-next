'use client'

import { useEffect, useId, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

/** Collapsed height, roughly eight lines of the bio's 17px/1.55 rhythm. */
const FOLD_PX = 216

const TOGGLE = "relative inline-flex cursor-pointer items-center gap-1.5 text-cyan signal-chip hover:text-cyan"

type ProfileBioProps = {
  /** Bio HTML, already rendered from markdown. */
  markdown: string
  className?: string
}

/**
 * Bio with a fold: anything past {@link FOLD_PX} is cut off behind a page-color fade that doubles
 * as the "show more" control. The fold only appears once the client has measured a bio tall enough
 * to need one, so without JS the whole bio renders plainly.
 */
export const ProfileBio = ({ markdown, className }: ProfileBioProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const bodyId = useId()
  const [isFolded, setIsFolded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    // Measure the unclamped inner body: the wrapper's height is pinned while folded.
    const measure = () => setIsFolded(body.scrollHeight > FOLD_PX + 16)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [markdown])

  const isClamped = isFolded && !isOpen

  return (
    <div className={twMerge("max-w-[62ch]", className)}>
      <div id={bodyId} className="relative overflow-hidden" style={isClamped ? { maxHeight: FOLD_PX } : undefined}>
        <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: markdown }} />

        {isClamped ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-expanded={false}
            aria-controls={bodyId}
            className="absolute inset-x-0 bottom-0 flex h-30 cursor-pointer items-end justify-start"
          >
            <span aria-hidden className="absolute inset-0 bg-linear-to-t from-space-000 from-25% via-veil-base to-transparent" />
            <span className={TOGGLE}>
              Show more
              <span aria-hidden>▾</span>
            </span>
          </button>
        ) : null}
      </div>

      {isFolded && isOpen ? (
        <button type="button" onClick={() => setIsOpen(false)} aria-expanded aria-controls={bodyId} className={twMerge(TOGGLE, "mt-2 min-h-11")}>
          Show less
          <span aria-hidden>▴</span>
        </button>
      ) : null}
    </div>
  )
}
