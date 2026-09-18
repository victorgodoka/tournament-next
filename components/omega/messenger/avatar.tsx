import Image from "next/image";
import { twMerge } from "tailwind-merge";

/** Discord avatar filling its box, or a plain tile when the duelist has none. */
export const Avatar = ({ src, sizes, className }: { src: string | null; sizes: string; className?: string }) => (
  <div className={twMerge("relative shrink-0 overflow-hidden border border-line bg-surface-200", className)}>
    {src ? <Image src={src} alt="" fill sizes={sizes} className="object-cover duotone" /> : null}
  </div>
)
