import "./backdrop.styles.css";

const BackdropComponent = () => {
  return <div className="backdrop" aria-hidden="true">
    <span className="backdrop__grid" />
    <span className="backdrop__orb backdrop__orb--secondary" />
    <span className="backdrop__orb backdrop__orb--accent" />
  </div>
}

export default BackdropComponent;