import { SeasonScreen } from './SeasonScreen'

const BattlepassSeasonPage = async ({ params }: { params: Promise<{ code: string }> }) => {
  const { code } = await params
  return <SeasonScreen code={decodeURIComponent(code)} />
}

export default BattlepassSeasonPage
