import { noIndexMetadata } from '@utils/metadata'
import { SimulatorLoader } from './simulator.loader'

export const metadata = noIndexMetadata('Combo Simulator preview', '/simulator/new', 'The next Combo Simulator, in preview.')

/** The stage is the whole page: no site header, no footer, no ads. Its Home button leads back. */
const SimulatorPage = () => <SimulatorLoader />

export default SimulatorPage
