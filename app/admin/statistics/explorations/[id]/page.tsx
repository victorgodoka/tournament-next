import { Builder } from './Builder'

const ExplorationBuilderPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  return <Builder id={id === 'new' ? null : decodeURIComponent(id)} />
}

export default ExplorationBuilderPage
