'use client'

import { Error as ErrorView } from '@omega/error'
import { Header } from '@ui/header'

/** The API or the session lookup failed. Distinct from 404, so an editor isn't told their page is gone. */
const WikiError = ({ error }: { error: Error & { digest?: string } }) => {
  console.error(error)
  return (
    <>
      <Header />
      <main className="min-h-dvh bg-space-000 pt-16">
        <ErrorView />
      </main>
    </>
  )
}

export default WikiError
