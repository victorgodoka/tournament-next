import BadgeComponent from "./badge.component";
import { Archetype } from "@app/decks/decks.types";
import "./badge.style.css"

const BadgesComponent = ({ archetypes }: { archetypes: Archetype[]}) => {
  return <ul className="badges" aria-label="Deck archetypes">
    {archetypes.map((archetype, i) => (
      <BadgeComponent key={i} {...archetype} i={i} />
    ))}
  </ul>
}

export default BadgesComponent;