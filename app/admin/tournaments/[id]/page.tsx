import { notFound } from 'next/navigation'
import { TournamentForm } from '../TournamentForm'

const EditTournamentPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  return <TournamentForm id={Number(id)} />
}

export default EditTournamentPage
