import "./tags.style.css"

const TagComponent = ({ tag }: { tag: string }) => {
  return <li  className="tag">
    <span className="tag-hash" aria-hidden="true">#</span>
    {tag}
  </li>
}

export default TagComponent;