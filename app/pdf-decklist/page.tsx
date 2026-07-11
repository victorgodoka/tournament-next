import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './pdf-decklist.styles.css'

export const metadata = noIndexMetadata(
  'PDF Decklist',
  '/pdf-decklist',
  'Export Yu-Gi-Oh! decklists to PDF on YGO Omega.',
)

const PdfDecklistPage = () => {
  return (
    <ComingSoonPage
      title="PDF Decklist"
      description="PDF decklist export is coming soon."
    />
  )
}

export default PdfDecklistPage
