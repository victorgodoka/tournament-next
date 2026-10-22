import { ClientMessages } from '@i18n/client-messages'

const Layout = ({ children }: { children: React.ReactNode }) => (
  <ClientMessages namespaces={['Calendar', 'Tournaments']}>{children}</ClientMessages>
)

export default Layout
