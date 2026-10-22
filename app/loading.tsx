import { Header } from '@ui/header'

/**
 * Every route is dynamic (the locale cookie) and awaits the API before it renders, so without
 * this boundary a click waits out the whole server render on the old page. With it, `<Link>`
 * prefetches up to here and the navigation shows this at once while the page streams in. Nitro
 * may lay its rails out while this is up: `data-clear-gutters` keeps it from dropping them.
 */
const Loading = () => (
  <>
    <Header />
    <main data-clear-gutters role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
      <span className="equalizer-bars" aria-hidden>
        <span className="equalizer-bars__bar" />
        <span className="equalizer-bars__bar" />
        <span className="equalizer-bars__bar" />
        <span className="equalizer-bars__bar" />
      </span>
    </main>
  </>
)

export default Loading
