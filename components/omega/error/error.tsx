import Link from "next/link";
import { ArtTile } from "@omega/art-tile";
import { Button, Eyebrow } from "@ui/index";
import { DOWNLOAD_URL, ERROR_MAP, GENERIC_ERROR, GO_NEXT } from "@utils/const";

interface ErrorProps {
  /** HTTP code, or an entry `id` from ERROR_MAP for page-specific variants. */
  errorCode?: number | string,
}

const GoNext = ({ title, text, to }: { title: string, text: string, to: string }) => (
  <Link href={to} className="flex flex-col gap-3 border-b border-line px-8 py-6 text-ink hover:bg-gold hover:text-gold-on sm:odd:border-r xl:flex-row xl:items-baseline xl:justify-between">
    <span className="display-6">{title}</span>
    <span className="signal">{text}</span>
  </Link>
)

export const Error = ({ errorCode }: ErrorProps) => {
  const { code, eyebrow, title, text, image } = ERROR_MAP.find(e => (e.id ?? e.code) === errorCode) ?? GENERIC_ERROR
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_540px] xl:grid-cols-[1fr_720px]">
      <ArtTile lead wash="gold" src={image} alt="" width={720} height={720} sizes="(min-width: 1280px) 720px, (min-width: 1024px) 540px, 100vw" className="aspect-video max-h-64 w-full lg:order-2 lg:aspect-auto lg:max-h-none lg:border-l lg:border-line" imageClassName="object-top" />
      <div className="flex w-full max-w-5xl flex-col px-5.5 py-13 lg:order-1 lg:px-11">
        <Eyebrow meta={eyebrow[1]}>{eyebrow[0]}</Eyebrow>
        <div className="flex-1 pt-6 md:max-w-3xl">
          <p className="inline-block bg-gold px-2 font-display text-[clamp(96px,14vw,240px)] leading-[.9] text-gold-on">{code ?? "????"}</p>
          <h1 className="py-8 text-ink display-1 xl:py-12">{title}</h1>
          <p className="max-w-[62ch] text-ink-dim lead">{text}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-4 border-t border-line py-8 md:max-w-3xl">
          <Button size="lg" shadow href="/">Go back</Button>
          <Button size="lg" variant="secondary" href={DOWNLOAD_URL}>Download now</Button>
        </div>
        <p className="text-ink-muted signal-lg">Where to go next?</p>
        <nav aria-label="Where to go next" className="my-4 grid max-w-3xl grid-cols-1 border border-b-0 border-line sm:grid-cols-2">
          {GO_NEXT.map(next => <GoNext key={next.to} {...next} />)}
        </nav>
      </div>
    </div>
  );
};
