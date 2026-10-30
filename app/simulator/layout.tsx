import { ClientMessages } from '@i18n/client-messages'

const Layout = ({ children }: { children: React.ReactNode }) => (
  <ClientMessages namespaces={['Simulator', 'Calculator', 'DeckEditor']}>{children}</ClientMessages>
)

export default Layout
