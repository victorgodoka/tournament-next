import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { Hub, type HubTab } from "./sections/Hub";

type MessengerPageProps = {
  initialId?: string
  initialTab?: HubTab
}

/** The full friends / rivals list. The dock is left out here: this page is the dock, expanded. */
const MessengerPage = ({ initialId, initialTab }: MessengerPageProps) => (
  <>
    <Header />
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
      <Hub initialId={initialId} initialTab={initialTab} />
    </main>
    <Footer />
  </>
)

export default MessengerPage
