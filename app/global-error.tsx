'use client'

/**
 * The root layout itself failed: nothing else is on the page, so this draws its own `<html>`.
 * The stylesheet never loads here, hence the inline styles. The digest is the same one
 * `onRequestError` (instrumentation.ts) logged on the server, so a reader can quote it.
 */
const GlobalError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  console.error(error)
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#05060d', color: '#f4f4f8', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong</h1>
          {error.digest && <p style={{ opacity: 0.6, margin: '0 0 16px' }}>Error {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #3b3f5c', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}

export default GlobalError
