import { ClientMessages } from '@i18n/client-messages'

const Layout = ({ children }: { children: React.ReactNode }) => (
  <ClientMessages namespaces={['Tournaments', 'Calendar']}>{children}</ClientMessages>
)

export default Layout
