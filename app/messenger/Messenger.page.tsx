import { Header } from "@ui/header";
import { MessengerPage as Messenger } from "@omega/messenger";

type MessengerPageProps = {
  initialId?: string
  initialTab?: 'requests'
}

/** The full-height, three-column messenger. The dock is left out here: this page is the dock, expanded. */
const MessengerPage = ({ initialId, initialTab }: MessengerPageProps) => (
  <>
    <Header />
    <main className="flex h-dvh flex-col overflow-hidden bg-space-000 pt-16">
      <Messenger defaultSelected={initialId} defaultTab={initialTab} height="calc(100dvh - 64px)" />
    </main>
  </>
)

export default MessengerPage
