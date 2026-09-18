import { Header } from '@ui/header'
import { Eyebrow } from '@ui/eyebrow'
import { pageMetadata } from '@utils/metadata'
import { loginErrorMessage } from '@utils/auth'
import { SignIn } from './SignIn'

export const metadata = pageMetadata({ title: 'Sign in', path: '/login', noIndex: true })

type LoginRouteProps = { searchParams: Promise<{ error?: string | string[] }> }

/** Failed Discord logins land here as `/login?error=<code>` (AUTH.md §4.2). */
const LoginRoute = async ({ searchParams }: LoginRouteProps) => {
  const { error } = await searchParams
  const code = Array.isArray(error) ? error[0] : error
  const message = code ? loginErrorMessage(code) : undefined

  return (
    <>
      <Header />
      <main className="flex min-h-dvh items-center justify-center px-5.5 pt-16 lg:px-11">
        <section className="w-full max-w-2xl py-16">
          {message ? <Eyebrow meta={code}>Sign-in failed</Eyebrow> : <Eyebrow tone="cyan" meta="Discord only">Sign in</Eyebrow>}
          <h1 className="pt-8 pb-6 text-ink display-1">Sign in to Omega</h1>
          {message
            ? <p role="alert" className="border border-gold bg-ground-gold px-4.5 py-4 text-ink-dim body">{message}</p>
            : <p className="max-w-[62ch] text-ink-dim lead">Use the Discord account linked to your Omega account.</p>}
          <SignIn redirectIfSignedIn={!message} />
        </section>
      </main>
    </>
  )
}

export default LoginRoute
