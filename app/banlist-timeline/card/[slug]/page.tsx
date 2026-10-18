import { notFound } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { getFormatter, getTranslations } from 'next-intl/server'
import { twMerge } from 'tailwind-merge'
import { Breadcrumbs } from '@ui/breadcrumbs'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { PageHeader } from '@ui/page-header'
import { SectionHead } from '@ui/section-head'
import {
  BANLISTS,
  cardBySlug,
  cardChanges,
  cardName,
  cardPath,
  currentBanlist,
  LATEST_BANLIST,
  listDate,
  STATUS_TONE,
  statusOn,
  type Banlist,
  type BanStatus,
} from '@utils/banlist'
import { SITE_NAME, SITE_URL } from '@utils/config'
import { jsonLd, metaDescription, pageMetadata } from '@utils/metadata'
import { CardStrip } from '../../card-strip'
import { SOURCE } from '../../timeline'

type CardRouteProps = { params: Promise<{ slug: string }> }

const listedOn = (card: number) => BANLISTS.filter((list) => statusOn(card, list.index) !== 'U').length

export async function generateMetadata({ params }: CardRouteProps) {
  const card = cardBySlug((await params).slug)
  if (card < 0) return {}
  const t = await getTranslations('Banlist')
  const format = await getFormatter()
  const current = currentBanlist()
  const first = cardChanges(card)[0]!.list
  const month = (list: Banlist) => format.dateTime(listDate(list.date), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return pageMetadata({
    title: t('meta.cardTitle', { card: cardName(card) }),
    path: cardPath(card),
    description: metaDescription(
      t('meta.cardDescription', {
        card: cardName(card),
        status: t(`status.${statusOn(card, current.index)}`),
        label: month(current),
        first: month(first),
        count: listedOn(card),
        total: BANLISTS.length,
      }),
    ),
  })
}

/** One card, `/banlist-timeline/card/pot-of-greed`: answers "when was Pot of Greed banned" from the data, in the HTML. */
const CardBanlistPage = async ({ params }: CardRouteProps) => {
  const card = cardBySlug((await params).slug)
  if (card < 0) notFound()
  return <CardBanlist card={card} current={currentBanlist()} />
}

const CardBanlist = ({ card, current }: { card: number; current: Banlist }) => {
  const t = useTranslations('Banlist')
  const format = useFormatter()
  const month = (list: Banlist) => format.dateTime(listDate(list.date), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const day = (list: Banlist) => format.dateTime(listDate(list.date), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const status = (code: BanStatus) => t(`status.${code}`)

  const name = cardName(card)
  const pageUrl = `${SITE_URL}${cardPath(card)}`
  const changes = cardChanges(card)
  const first = changes[0]!
  const now = statusOn(card, current.index)
  const latest = LATEST_BANLIST
  const upcoming = latest.index > current.index && statusOn(card, latest.index) !== now ? statusOn(card, latest.index) : null
  const banned = changes.find((change) => change.to === 'F')
  const last = BANLISTS.findLast((list) => list.index <= current.index && statusOn(card, list.index) !== 'U')
  const joins = changes.find((change) => change.list.index > current.index)?.list ?? latest

  const faq = [
    {
      q: t('card.faq.bannedQ', { card: name }),
      a: [
        t('card.faq.bannedA', { card: name, now, label: month(current) }),
        upcoming ? t('card.faq.upcoming', { date: day(latest), label: month(latest), status: status(upcoming) }) : '',
      ].join(' ').trim(),
    },
    {
      q: t('card.faq.firstQ', { card: name }),
      a: t('card.faq.firstA', {
        card: name,
        when: banned ? (banned.list.index > current.index ? 'soon' : 'past') : 'never',
        label: month(banned?.list ?? first.list),
        date: day(banned?.list ?? first.list),
        status: status(first.to),
      }),
    },
    {
      q: t('card.faq.lastQ', { card: name }),
      a: t('card.faq.lastA', {
        card: name,
        when: !last ? 'never' : last === current ? 'now' : 'past',
        label: month(last ?? joins),
        status: status(last ? statusOn(card, last.index) : statusOn(card, joins.index)),
        date: day(last ? (BANLISTS[last.index + 1] ?? last) : joins),
      }),
    },
  ]

  const crumbs = [{ label: t('home'), href: '/' }, { label: t('crumb'), href: '/banlist-timeline' }, { label: name }]

  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: t('crumb'), item: `${SITE_URL}/banlist-timeline` },
          { '@type': 'ListItem', position: 3, name, item: pageUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ],
  }

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip pt-16 pb-24">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
        <div className="mx-auto flex w-full max-w-page flex-col gap-section px-gutter">
          <div className="flex flex-col gap-2">
            <Breadcrumbs items={crumbs} className="pt-8" />
            <PageHeader eyebrow={t('eyebrow')} title={name} lead={t('card.lead', { card: name, lists: BANLISTS.length })} />
          </div>

          <section aria-label={t('summary.label')}>
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-px border border-line bg-line">
              <div className="flex flex-col gap-2 bg-steel p-5">
                <dt className="text-ink-dim signal">{t('card.today', { label: month(current) })}</dt>
                <dd className={twMerge('display-2', STATUS_TONE[now].text)}>{status(now)}</dd>
                <dd className="text-ink-dim body-sm">
                  {upcoming ? t('card.next', { date: day(latest), status: status(upcoming) }) : t('card.since', { date: day(current) })}
                </dd>
              </div>
              {[
                { term: t('card.lists'), value: listedOn(card), note: t('card.listsNote', { total: BANLISTS.length }) },
                { term: t('card.first'), value: month(first.list), note: status(first.to) },
                { term: t('card.changes'), value: changes.length, note: month(changes.at(-1)!.list) },
              ].map(({ term, value, note }) => (
                <div key={term} className="flex flex-col gap-2 bg-surface-100 p-5">
                  <dt className="text-ink-muted signal">{term}</dt>
                  <dd className="text-ink display-2">{value}</dd>
                  <dd className="text-ink-dim body-sm">{note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="bl-history" className="flex flex-col gap-5">
            <SectionHead ruled num="01" id="bl-history" end={t('card.historyMeta', { count: changes.length })}>
              {t('history.heading')}
            </SectionHead>
            <div className="cut notch flex flex-col gap-5 p-4 [--cut:var(--cut-lg)] min-[720px]:p-6">
              <CardStrip card={card} selected={current.index} />
            </div>
          </section>

          <section aria-labelledby="bl-faq" className="flex flex-col gap-5">
            <SectionHead ruled num="02" id="bl-faq">{t('faq.heading')}</SectionHead>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-px border border-line bg-line">
              {faq.map(({ q, a }) => (
                <div key={q} className="flex flex-col gap-2 bg-surface-100 p-5">
                  <h3 className="text-ink body-strong">{q}</h3>
                  <p className="text-ink-dim body">{a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="flex gap-3 border-t border-line pt-5 text-ink-dim body-sm">
            <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-gold" />
            <span>
              {t('note')} <a href={SOURCE}>{t('source')}</a>
            </span>
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default CardBanlistPage
