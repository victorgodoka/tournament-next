import { noIndexMetadata } from '@utils/metadata'
import { AdminShell } from './AdminShell'

export const metadata = noIndexMetadata('Admin panel', '/admin', 'Tournaments, shop, battlepass, analytics and staff tools.')

/**
 * The gate is in the client: every `/panel` route needs the session cookie, which is scoped to the
 * API host and never reaches this server. The API refuses anyone else anyway.
 */
const AdminLayout = ({ children }: { children: React.ReactNode }) => <AdminShell>{children}</AdminShell>

export default AdminLayout
