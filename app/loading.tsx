import { Header } from '@ui/header'

/**
 * Every route is dynamic (the locale cookie) and awaits the API before it renders, so without
 * this boundary a click waits out the whole server render on the old page. With it, `<Link>`
 * prefetches up to here and the navigation shows this at once while the page streams in.
 */
const Loading = () => (
  <>
    <Header />
    <main role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
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
