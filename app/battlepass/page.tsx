import { Footer } from '@ui/footer'
import { getSeasons, getTrack } from '@utils/battlepass'
import { pageMetadata } from '@utils/metadata'
import { getCatalog } from '@utils/shop'
import { BattlepassBrowser, type Phase } from './BattlepassBrowser'

export const metadata = pageMetadata({
  title: 'Battlepass',
  path: '/battlepass',
  description:
    'Earn XP in ranked duels, tournaments and daily visits on YGO Omega, level up the season battlepass and claim free and premium rewards.',
})

/** The first listed season; the page still renders with the API down and says there is no season. */
const load = async () => {
  try {
    const [season] = await getSeasons()
    if (!season) return null
    const [{ levels }, catalog] = await Promise.all([getTrack(season.code), getCatalog().catch(() => null)])
    const phase: Phase = season.open ? 'open' : new Date(season.startsAt) > new Date() ? 'soon' : 'ended'
    return { season, levels, types: catalog?.types ?? [], phase }
  } catch (error) {
    console.error(error)
    return null
  }
}

const BattlepassPageRoute = async () => {
  const data = await load()
  return (
    <>
      <BattlepassBrowser data={data} />
      <Footer />
    </>
  )
}

export default BattlepassPageRoute
