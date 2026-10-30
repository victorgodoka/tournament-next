import { ClientMessages } from '@i18n/client-messages'
import './simulator.css'

const Layout = ({ children }: { children: React.ReactNode }) => (
  <ClientMessages namespaces={['Simulator', 'SimulatorNew', 'Calculator', 'DeckEditor']}>{children}</ClientMessages>
)

export default Layout
