import Image from "next/image";

type ProfileCoverProps = {
  src: string
  handle: string
}

/** CoverFrame: full-bleed duotone cover the masthead avatar overlaps. Only rendered when the duelist set one. */
export const ProfileCover = ({ src, handle }: ProfileCoverProps) => (
  <section className="relative h-47.5 overflow-hidden border-b border-line md:h-95">
    <Image
      src={src}
      alt="Profile cover image"
      fill
      priority
      sizes="100vw"
      className="object-cover object-[center_40%] grayscale contrast-115"
    />
    <span aria-hidden className="duotone-wash bg-cyan" />
    <span aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent from-45% to-veil-base" />
    <span className="absolute top-0 right-0 bg-cyan px-3.5 py-2.25 text-cyan-on signal-chip tracking-[.2em]">
      {handle}
    </span>
  </section>
)
