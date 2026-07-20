import { Archetype } from "@app/decks/decks.types";
import "./badge.style.css"

const BadgeComponent = ({ name, i }: Archetype & { i: number }) => {
  return <li
    className={`badge${i === 0 ? ' badge--primary' : ''}`}
  >
    {name}
  </li>
}

export default BadgeComponent;