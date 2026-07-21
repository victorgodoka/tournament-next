import WipComponent from '@components/wip/wip.component'
import { noIndexMetadata } from '@lib/page-metadata'
import './konami-decklist.styles.css'

export const metadata = noIndexMetadata(
  'Konami Decklist',
  '/konami-decklist',
  'Convert Yu-Gi-Oh! decks to Konami decklist format on YGO Omega.',
)

const KonamiDecklistPage = () => {
  return (
    <WipComponent
      title="Konami Decklist"
      description="Konami decklist conversion is coming soon."
    />
  )
}

export default KonamiDecklistPage
