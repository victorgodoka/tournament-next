import { twMerge } from "tailwind-merge";

interface FaqCardProps {
  index: number
  title: string
  text: string
  /** Grid tracks and padding; the row stacks to one column below lg. */
  className?: string
  numClassName?: string
  /** Replaces the default `display-4` heading style. */
  titleClassName?: string
}

/** Numbered row: mono ordinal, display heading, body. Rows are split by a single hairline. */
export const FaqCard = ({ index, title, text, className, numClassName, titleClassName }: FaqCardProps) => (
  <li className={twMerge("grid grid-cols-1 gap-2.5 border-t border-line py-6.5 lg:gap-7", className)}>
    <span className={twMerge("font-mono text-xs tracking-[.1em] text-gold", numClassName)}>{index.toString().padStart(2, "0")}</span>
    <h3 className={twMerge("text-ink", titleClassName ?? "display-4 leading-[1.02]")}>{title}</h3>
    <p className="text-ink-dim body">{text}</p>
  </li>
);
