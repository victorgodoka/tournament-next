import TagComponent from "./tag.component";
import "./tags.style.css"

const TagsComponent = ({ tags }: { tags: string[]}) => {
  return <ul className="tags" aria-label="Deck tags">
    {tags.map((tag, i) => (
      <TagComponent key={i} tag={tag} />
    ))}
  </ul>
}

export default TagsComponent;