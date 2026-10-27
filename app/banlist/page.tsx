import Link from 'next/link'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Breadcrumbs } from '@ui/breadcrumbs'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { PageHeader } from '@ui/page-header'
import { SectionHead } from '@ui/section-head'
import {
  BANLISTS,
  banlistPath,
  cardName,
  currentBanlist,
  FIRST_BANLIST,
  LATEST_BANLIST,
  listDate,
  RESTRICTED,
  SOURCE,
  STATUS_TONE,
  wikiPath,
  type Banlist,
  type BanStatus,
  type Restricted,
} from '@utils/banlist'
import { SITE_NAME, SITE_URL } from '@utils/config'
import { jsonLd, pageMetadata } from '@utils/metadata'
import { CardGrid, CardTile } from '../banlist-timeline/status-shift'

const ANCHOR: Record<Restricted, string> = { F: 'forbidden', L: 'limited', S: 'semi-limited' }
const counts = (list: Banlist) => ({ f: list.cards.F.length, l: list.cards.L.length, s: list.cards.S.length })

export async function generateMetadata() {
  const t = await getTranslations('Banlist.current.meta')
  const format = await getFormatter()
  const current = currentBanlist()
  return pageMetadata({
    title: t('title', { label: format.dateTime(listDate(current.date), { month: 'long', year: 'numeric', timeZone: 'UTC' }) }),
    path: '/banlist',
    description: t('description', {
      date: format.dateTime(listDate(current.date), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
      ...counts(current),
    }),
    article: { publishedTime: current.date, modifiedTime: current.date },
  })
}

/** Changes of one list, grouped by where each card landed, Forbidden first. */
const ChangeGroups = async ({ list }: { list: Banlist }) => {
  const t = await getTranslations('Banlist')
  return (['F', 'L', 'S', 'U'] as const).map((to) => {
    const rows = list.changes.filter((c) => c.to === to).sort((a, b) => cardName(a.card).localeCompare(cardName(b.card)))
    if (!rows.length) return null
    return (
      <div key={to} className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2.5 border-b border-line pb-2 signal">
          <span aria-hidden className={twMerge('size-2.5 rounded-xs', STATUS_TONE[to].fill)} />
          <b className={STATUS_TONE[to].text}>{t(`timeline.group.${to}`)}</b>
          <span className="text-ink-muted">{rows.length}</span>
        </h3>
        <CardGrid>
          {rows.map(({ card, from }) => <CardTile key={card} card={card} from={from} to={to} />)}
        </CardGrid>
      </div>
    )
  })
}

/**
 * `/banlist`: the list in force, for "Yu-Gi-Oh! banlist". What changed on it, the whole list by status
 * (every card to its wiki page), the next list once announced, and the way into the full timeline.
 */
const CurrentBanlistPage = async () => {
  const t = await getTranslations('Banlist')
  const format = await getFormatter()
  const conjunction = new Intl.ListFormat(await getLocale(), { type: 'conjunction' })
  const month = (l: Banlist) => format.dateTime(listDate(l.date), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const day = (date: string) => format.dateTime(listDate(date), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const status = (code: BanStatus) => t(`status.${code}`)

  const current = currentBanlist()
  const prev = BANLISTS[current.index - 1]
  const upcoming = LATEST_BANLIST.index > current.index ? LATEST_BANLIST : null
  const label = month(current)
  const pageUrl = `${SITE_URL}/banlist`
  const recent = BANLISTS.slice(Math.max(0, current.index - 5), current.index + 1).toReversed()

  const banned = current.changes.filter((c) => c.to === 'F').map((c) => c.card)
  const freed = current.changes.filter((c) => c.to === 'U').map((c) => c.card)
  const names = (ids: number[]) => conjunction.format(ids.map(cardName))
  const faq = [
    { q: t('faq.currentQ'), a: t('faq.currentA', { label, date: day(current.date), ...counts(current) }) },
    ...(upcoming
      ? [{ q: t('faq.nextQ'), a: t('faq.nextA', { label: month(upcoming), date: day(upcoming.date), count: upcoming.changes.length }) }]
      : []),
    { q: t('current.faq.meaningQ'), a: t('current.faq.meaningA') },
    { q: t('current.faq.bannedQ', { label }), a: t('faq.bannedA', { count: banned.length, names: names(banned) }) },
    { q: t('current.faq.freedQ', { label }), a: t('faq.freedA', { count: freed.length, names: names(freed) }) },
    { q: t('current.faq.historyQ'), a: t('current.faq.historyA', { lists: BANLISTS.length, first: day(FIRST_BANLIST.date) }) },
  ]

  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: t('current.crumb'), item: pageUrl },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': pageUrl,
        url: pageUrl,
        name: t('current.title', { label }),
        datePublished: current.date,
        dateModified: current.date,
        about: { '@type': 'Thing', name: `Yu-Gi-Oh! TCG Forbidden & Limited List ${current.date}` },
        isPartOf: { '@id': `${SITE_URL}/banlist-timeline#dataset` },
        mainEntity: {
          '@type': 'ItemList',
          name: `Yu-Gi-Oh! TCG Forbidden & Limited List ${current.date}`,
          numberOfItems: current.total,
          itemListElement: RESTRICTED.flatMap((code) => current.cards[code]).map((card, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: cardName(card),
            url: `${SITE_URL}${wikiPath(card)}`,
          })),
        },
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
      <main data-clear-gutters className="flex min-h-dvh flex-col overflow-x-clip pt-16 pb-24">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
        <div className="mx-auto flex w-full max-w-page flex-col gap-section px-gutter">
          <div className="flex flex-col gap-2">
            <Breadcrumbs items={[{ label: t('home'), href: '/' }, { label: t('current.crumb') }]} className="pt-8" />
            <PageHeader eyebrow={t('eyebrow')} title={t('current.title', { label })} lead={t('current.lead', { date: day(current.date) })} />
          </div>

          <section aria-label={t('summary.label')} className="flex flex-col gap-3">
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px border border-line bg-line">
              {RESTRICTED.map((code) => {
                const n = current.cards[code].length
                const delta = prev ? n - prev.cards[code].length : 0
                return (
                  <div key={code} className="flex flex-col gap-2 bg-surface-100 p-4 sm:p-5">
                    <dt className="flex items-center gap-2 text-ink-muted signal">
                      <span aria-hidden className={twMerge('size-2.5 rounded-xs', STATUS_TONE[code].fill)} />
                      {status(code)}
                    </dt>
                    <dd className="flex items-baseline gap-2.5">
                      <a href={`#${ANCHOR[code]}`} className="text-ink display-2 hover:text-cyan">{n}</a>
                      {prev ? (
                        <span
                          title={t('timeline.vsPrevious')}
                          className={twMerge('signal-sm', delta > 0 ? 'text-loss' : delta < 0 ? 'text-win' : 'text-ink-muted')}
                        >
                          {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '='}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                )
              })}
              <div className="flex flex-col gap-2 bg-steel p-4 sm:p-5">
                <dt className="text-ink-dim signal">{t('current.since')}</dt>
                <dd className="text-ink display-3">
                  <time dateTime={current.date}>{day(current.date)}</time>
                </dd>              </div>
            </dl>
            <nav aria-label={t('current.jump')} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ink-muted signal">
              <span>{t('current.jump')}</span>
              {upcoming ? <a href="#next" className="text-gold hover:text-ink">{t('timeline.announced')}</a> : null}
              <a href="#changes" className="hover:text-cyan">{t('timeline.changed', { count: current.changes.length })}</a>
              {RESTRICTED.map((code) => (
                <a key={code} href={`#${ANCHOR[code]}`} className="hover:text-cyan">{status(code)}</a>
              ))}
              <Link href="/banlist-timeline" className="hover:text-cyan">{t('current.history.heading')}</Link>
            </nav>
          </section>

          {upcoming ? (
            <section id="next" aria-labelledby="bl-next" className="flex scroll-mt-20 flex-col gap-5 border border-gold p-4 min-[720px]:p-6">
              <div className="flex flex-col gap-2">
                <h2 id="bl-next" className="flex flex-wrap items-center gap-3 text-ink display-3">
                  {t('current.upcoming.heading', { label: month(upcoming) })}
                  <span className="border border-current px-1.5 py-0.5 font-bold text-gold signal-sm">{t('timeline.announced')}</span>
                </h2>
                <p className="text-ink-dim body">
                  {t('current.upcoming.lead', { date: day(upcoming.date), count: upcoming.changes.length })}
                </p>
              </div>
              <ChangeGroups list={upcoming} />
            </section>
          ) : null}

          <section id="changes" aria-labelledby="bl-changes" className="flex scroll-mt-20 flex-col gap-5">
            <SectionHead ruled num="01" id="bl-changes" end={prev ? t('current.changes.end', { label: month(prev) }) : undefined}>
              {t('current.changes.heading', { label })}
            </SectionHead>
            {prev ? <ChangeGroups list={current} /> : <p className="text-ink-dim body">{t('current.changes.first')}</p>}
          </section>

          <AdBanner id="ad-top" placement="content" />

          <section aria-labelledby="bl-full" className="flex flex-col gap-section">
            <SectionHead ruled num="02" id="bl-full" end={label}>{t('current.full.heading', { count: current.total })}</SectionHead>
            {RESTRICTED.map((code) => (
              <section key={code} id={ANCHOR[code]} aria-labelledby={`bl-${ANCHOR[code]}`} className="flex scroll-mt-20 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-2">
                  <span aria-hidden className={twMerge('size-3 rounded-xs', STATUS_TONE[code].fill)} />
                  <h2 id={`bl-${ANCHOR[code]}`} className={twMerge('display-3', STATUS_TONE[code].text)}>{t(`current.full.${code}`)}</h2>
                  <span className="text-ink-muted signal">{current.cards[code].length}</span>                </div>
                {current.cards[code].length ? (
                  <CardGrid>
                    {current.cards[code].map((card) => <CardTile key={card} card={card} />)}
                  </CardGrid>
                ) : (
                  <p className="text-ink-muted body-sm">{t('timeline.none')}</p>
                )}
              </section>
            ))}
          </section>

          <AdBanner id="ad-mid" placement="content" />

          <section aria-labelledby="bl-history" className="flex flex-col gap-5">
            <SectionHead ruled num="03" id="bl-history" end={t('current.history.end', { count: BANLISTS.length })}>
              {t('current.history.heading')}
            </SectionHead>
            <div className="cut notch flex flex-col gap-5 p-4 [--cut:var(--cut-lg)] min-[720px]:p-6">
              <p className="text-ink-dim body">{t('current.history.lead')}</p>
              <div className="flex flex-col gap-2">
                <h3 className="text-ink-muted signal">{t('current.history.recent')}</h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-px border border-line bg-line">
                  {recent.map((l) => (
                    <li key={l.date} className="bg-surface-100">
                      <Link href={banlistPath(l)} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-300">
                        <span className="flex flex-col">
                          <span className="text-ink body-strong">{month(l)}</span>
                          <span className="text-ink-muted signal-sm">{t('timeline.changes', { count: l.changes.length })}</span>
                        </span>
                        {l === current ? <span className="text-cyan signal-sm">{t('timeline.inForce')}</span> : <Icon name="right" size={14} className="text-ink-muted" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/banlist-timeline" className="flex items-center gap-2 self-start text-cyan signal-strong hover:text-ink">
                {t('current.history.cta')} <Icon name="right" size={14} />
              </Link>
            </div>
          </section>

          <section aria-labelledby="bl-faq" className="flex flex-col gap-5">
            <SectionHead ruled num="04" id="bl-faq">{t('faq.heading')}</SectionHead>
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

          <AdBanner id="ad-bottom" placement="content" />
        </div>
      </main>
      <Footer />
    </>
  )
}

export default CurrentBanlistPage
