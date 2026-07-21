import { Archetype } from "@app/decks/decks.types";
import "./badge.style.css"
import { cn } from "@sglara/cn";

const BadgeComponent = ({ name, i }: Archetype & { i: number }) => {
  return <li
    className={cn("badge", { "badge--primary": i === 0 })}
  >
    {name}
  </li>
}

export default BadgeComponent;