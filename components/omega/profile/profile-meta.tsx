import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import type { CardArt as CardArtType } from "@utils/types";
import { MICRO_LABEL } from "./accent";

type MetaCell = {
  label: string
  value: string
  /** Artwork faded in behind the cell. */
  art?: CardArtType
  labelClassName?: string
}

/** Stat cells closing the masthead: a row under the bio, a stacked side column on wide screens. */
export const ProfileMeta = ({ cells, className }: { cells: MetaCell[]; className?: string }) => (
  <div
    className={twMerge(
      "grid grid-cols-1 gap-px border-t border-line bg-line lg:grid-cols-3",
      "xl:grid-cols-1 xl:content-start xl:gap-0 xl:border-t-0 xl:border-l xl:bg-transparent",
      className,
    )}
  >
    {cells.map(({ label, value, art, labelClassName }) => (
      <div
        key={label}
        className={twMerge(
          "relative overflow-hidden bg-surface-000 px-6 py-5.5 xl:border-b xl:border-line xl:p-7.5",
          art && "min-h-33",
        )}
      >
        {art && (
          <CardArt
            art={art}
            alt=""
            sizes="(min-width: 1280px) 380px, (min-width: 1024px) 33vw, 100vw"
            className="absolute inset-0"
            imageClassName="object-[center_30%] duotone"
          >
            <span aria-hidden className="absolute inset-0 bg-linear-to-b from-veil-base to-surface-000/90" />
          </CardArt>
        )}
        <p className={twMerge(MICRO_LABEL, "relative", labelClassName)}>{label}</p>
        <p className="relative mt-2 text-ink display-5">{value}</p>
      </div>
    ))}
  </div>
)
