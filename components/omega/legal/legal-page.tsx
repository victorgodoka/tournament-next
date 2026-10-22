import { useFormatter } from 'next-intl'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { PageHeader } from '@ui/page-header'

/** One legal document, in one language: the pages pick it by locale. */
export type LegalDoc = {
  title: string
  description: string
  eyebrow: string
  /** "Last updated:", followed by the date in the document's language. */
  updatedLabel: string
  Body: () => React.ReactNode
}

/** A heading with an anchor, so a clause can be linked: /privacy#cookies. */
export const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section aria-labelledby={id}>
    <h2 id={id} className="mt-10 mb-3.5 scroll-mt-24 border-t border-line pt-6 text-ink display-3">
      <a href={`#${id}`} className="text-ink hover:text-cyan">
        {title}
      </a>
    </h2>
    {children}
  </section>
)

/** Privacy policy and terms: the page title, then the document in one reading column. */
export const LegalPage = ({ doc: { eyebrow, title, updatedLabel, Body }, updated }: { doc: LegalDoc; updated: string }) => {
  const format = useFormatter()

  return (
    <>
      <Header />
      <main data-clear-gutters className="flex min-h-dvh flex-col pt-16 pb-16">
        <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter">
          <PageHeader
            eyebrow={eyebrow}
            title={title}
            lead={`${updatedLabel} ${format.dateTime(new Date(updated), { dateStyle: 'long', timeZone: 'UTC' })}`}
          />
          <article className="max-w-[72ch] text-ink-dim body [&_:is(p,li)_a]:text-cyan [&_:is(p,li)_a]:underline [&_:is(p,li)_a]:underline-offset-3 [&_li]:mb-1.5 [&_p]:mb-4 [&_strong]:text-ink [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
            <Body />
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}
