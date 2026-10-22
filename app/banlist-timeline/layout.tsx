import { ClientMessages } from '@i18n/client-messages'

const Layout = ({ children }: { children: React.ReactNode }) => (
  <ClientMessages namespaces={['Banlist']}>{children}</ClientMessages>
)

export default Layout
