import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './calculator.styles.css'

export const metadata = noIndexMetadata(
  'Calculator',
  '/calculator',
  'Yu-Gi-Oh! probability and combo calculator on YGO Omega.',
)

const CalculatorPage = () => {
  return (
    <ComingSoonPage
      title="Calculator"
      description="The Yu-Gi-Oh! calculator is coming soon."
    />
  )
}

export default CalculatorPage
