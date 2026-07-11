type ComingSoonPageProps = {
  title: string
  description: string
}

const ComingSoonPage = ({ title, description }: ComingSoonPageProps) => {
  return (
    <div className="omega-container">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

export default ComingSoonPage
