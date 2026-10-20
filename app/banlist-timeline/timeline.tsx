'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useEffect, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Breadcrumbs } from '@ui/breadcrumbs'
import { Segmented } from '@ui/choice'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { PageHeader } from '@ui/page-header'
import { SectionHead } from '@ui/section-head'
import {
  BANLIST_CARDS,
  BANLIST_CHANGES,
  BANLIST_MAX,
  BANLISTS,
  banlistByDate,
  banlistPath,
  cardChanges,
  cardName,
  FIRST_BANLIST,
  LATEST_BANLIST,
  listDate,
  RESTRICTED,
  SOURCE,
  STATUS_TONE,
  statusOn,
  type Banlist,
  type BanStatus,
  wikiPath,
  YEAR_TICKS,
} from '@utils/banlist'
import { SITE_NAME, SITE_URL } from '@utils/config'
import { jsonLd } from '@utils/metadata'
import { CardHistory } from './card-history'
import { CardGrid, CardTile, StatusShift } from './status-shift'

const TICKS = [0, 50, 100, 150, 200].filter((v) => v <= BANLIST_MAX)
const pct = (n: number) => `${(n / BANLIST_MAX) * 100}%`
const counts = (list: Banlist) => ({ f: list.cards.F.length, l: list.cards.L.length, s: list.cards.S.length })
const YEARS = Map.groupBy(BANLISTS.toReversed(), (l) => l.date.slice(0, 4))

type View = 'grid' | 'text'
const VIEW_KEY = 'banlist-view'

/** Grid or text, remembered per browser. With storage blocked the choice still works, for this page only. */
let picked: View = 'grid'
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'text' ? 'text' : 'grid'
  } catch {
    return picked
  }
}

const viewListeners = new Set<() => void>()
const subscribeView = (onChange: () => void) => {
  viewListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    viewListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

const saveView = (view: View) => {
  picked = view
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {}
  viewListeners.forEach((onChange) => onChange())
}

/**
 * Shows a list. Every list is already in the bundle, so this only swaps the URL (`pushState`, which Next
 * syncs into `usePathname`) instead of a server round trip per list, then brings the list into view.
 */
const showList = (list: Banlist) => {
  window.history.pushState(null, '', `${banlistPath(list)}#list`)
  document.getElementById('list')?.scrollIntoView()
}

/** A list's link. The href stays real: crawlers, new tabs and a reload still get that list's own page. */
const ListLink = ({ list, className, children, ...rest }: { list: Banlist; className?: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    showList(list)
  }
  return <a href={`${banlistPath(list)}#list`} onClick={go} className={className} {...rest}>{children}</a>
}

/**
 * The whole page, server-rendered so every list, change and answer is in the HTML a crawler reads.
 * The list on show follows the URL: `/banlist-timeline` is the hub (the list in force), `/banlist-timeline/<date>` one list.
 */
export const BanlistTimeline = ({ currentIndex }: { currentIndex: number }) => {
  const date = usePathname().split('/')[2]
  const current = BANLISTS[currentIndex]!
  const list = (date && banlistByDate(date)) || current
  const hub = !date
  const t = useTranslations('Banlist')
  const view = useSyncExternalStore(subscribeView, readView, (): View => 'grid')
  const grid = view === 'grid'
  const format = useFormatter()
  const conjunction = new Intl.ListFormat(useLocale(), { type: 'conjunction' })
  const month = (l: Banlist) => format.dateTime(listDate(l.date), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const day = (date: string) => format.dateTime(listDate(date), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const status = (code: BanStatus) => t(`status.${code}`)
  const names = (ids: number[]) => conjunction.format(ids.map(cardName))

  const latest = LATEST_BANLIST
  const prev = BANLISTS[list.index - 1]
  const next = BANLISTS[list.index + 1]
  const label = month(list)
  const title = hub ? t('title') : t('listTitle', { label })
  const pageUrl = `${SITE_URL}${hub ? '/banlist-timeline' : banlistPath(list)}`

  // A list picked in the page changes the URL, not the route: the tab title follows it here.
  useEffect(() => {
    document.title = `${hub ? t('meta.title') : t('meta.listTitle', { label })} | ${SITE_NAME}`
  }, [hub, label, t])

  const badge = (l: Banlist) =>
    l.index > current.index ? (
      <span className="border border-current px-1.5 py-0.5 font-bold text-gold signal-sm">{t('timeline.announced')}</span>
    ) : l === current ? (
      <span className="border border-current px-1.5 py-0.5 font-bold text-cyan signal-sm">{t('timeline.inForce')}</span>
    ) : null

  const faq = hub ? hubFaq() : listFaq()

  function hubFaq() {
    const pot = BANLIST_CARDS.indexOf('Pot of Greed')
    const potBan = cardChanges(pot).find((change) => change.to === 'F')!.list
    const biggest = BANLISTS.find((l) => l.total === BANLIST_MAX)!
    const first = FIRST_BANLIST
    return [
      { q: t('faq.currentQ'), a: t('faq.currentA', { label: month(current), date: day(current.date), ...counts(current) }) },
      ...(latest.index > current.index
        ? [{ q: t('faq.nextQ'), a: t('faq.nextA', { label: month(latest), date: day(latest.date), count: latest.changes.length }) }]
        : []),
      {
        q: t('faq.countQ'),
        a: t('faq.countA', {
          lists: BANLISTS.length,
          first: day(first.date),
          changes: format.number(BANLIST_CHANGES),
          cards: format.number(BANLIST_CARDS.length),
        }),
      },
      { q: t('faq.firstQ'), a: t('faq.firstA', { date: day(first.date), ...counts(first) }) },
      { q: t('faq.biggestQ'), a: t('faq.biggestA', { label: month(biggest), total: biggest.total, ...counts(biggest) }) },
      { q: t('faq.potQ'), a: t('faq.potA', { label: month(potBan), date: day(potBan.date), status: status(statusOn(pot, current.index)) }) },
    ]
  }

  function listFaq() {
    const banned = list.changes.filter((c) => c.to === 'F').map((c) => c.card)
    const freed = list.changes.filter((c) => c.to === 'U').map((c) => c.card)
    return [
      { q: t('faq.startQ', { label }), a: t('faq.startA', { start: day(list.date), end: list.end ? day(list.end) : 'none' }) },
      { q: t('faq.bannedQ', { label }), a: t('faq.bannedA', { count: banned.length, names: names(banned) }) },
      { q: t('faq.freedQ', { label }), a: t('faq.freedA', { count: freed.length, names: names(freed) }) },
      { q: t('faq.sizeQ', { label }), a: t('faq.sizeA', { total: list.total, ...counts(list) }) },
      ...(list === current ? [] : [{ q: t('faq.currentQ'), a: t('faq.currentA', { label: month(current), date: day(current.date), ...counts(current) }) }]),
    ]
  }

  const crumbs = [
    { label: t('home'), href: '/' },
    { label: t('crumb'), href: hub ? undefined : '/banlist-timeline' },
    ...(hub ? [] : [{ label }]),
  ]

  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: t('crumb'), item: `${SITE_URL}/banlist-timeline` },
          ...(hub ? [] : [{ '@type': 'ListItem', position: 3, name: label, item: pageUrl }]),
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      {
        '@type': 'Dataset',
        '@id': `${SITE_URL}/banlist-timeline#dataset`,
        name: 'Yu-Gi-Oh! TCG Forbidden & Limited List history',
        alternateName: ['Yu-Gi-Oh! banlist history', 'Yu-Gi-Oh! TCG banlist timeline'],
        description: `Every Yu-Gi-Oh! TCG (Advanced Format) Forbidden & Limited List from ${FIRST_BANLIST.date} to ${latest.date}: ${BANLISTS.length} lists, ${BANLIST_CHANGES} changes to ${BANLIST_CARDS.length} cards, with each card's status on every list.`,
        url: `${SITE_URL}/banlist-timeline`,
        temporalCoverage: `${FIRST_BANLIST.date}/${latest.date}`,
        dateModified: latest.date,
        keywords: ['Yu-Gi-Oh!', 'banlist', 'Forbidden & Limited List', 'TCG', 'Advanced Format', 'Forbidden', 'Limited', 'Semi-Limited'],
        variableMeasured: ['Forbidden', 'Limited', 'Semi-Limited'],
        isBasedOn: SOURCE,
        license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: 'Duelists Unite', url: SITE_URL },
      },
      ...(hub
        ? []
        : [
            {
              '@type': 'WebPage',
              '@id': pageUrl,
              url: pageUrl,
              name: title,
              datePublished: list.date,
              isPartOf: { '@id': `${SITE_URL}/banlist-timeline#dataset` },
              about: { '@type': 'Thing', name: `Yu-Gi-Oh! TCG Forbidden & Limited List ${list.date}` },
            },
          ]),
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
            <PageHeader
              eyebrow={t('eyebrow')}
              title={title}
              lead={hub ? t('lead', { latest: month(latest) }) : t('listLead', { label, lists: BANLISTS.length })}
            />
          </div>

          <section aria-label={t('summary.label')}>
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px border border-line bg-line">
              {[
                { term: t('summary.lists'), value: BANLISTS.length, note: `${day(FIRST_BANLIST.date)} → ${day(latest.date)}` },
                { term: t('summary.cards'), value: format.number(BANLIST_CARDS.length), note: t('summary.cardsNote') },
                { term: t('summary.changes'), value: format.number(BANLIST_CHANGES), note: t('summary.changesNote') },
                { term: t('summary.current', { label: month(current) }), value: current.total, note: t('summary.split', counts(current)), steel: true },
              ].map(({ term, value, note, steel }) => (
                <div key={term} className={twMerge('flex flex-col gap-2 bg-surface-100 p-4 sm:p-5', steel && 'bg-steel')}>
                  <dt className={twMerge('signal', steel ? 'text-ink-dim' : 'text-ink-muted')}>{term}</dt>
                  <dd className="text-ink display-2">{value}</dd>
                  <dd className="text-ink-dim body-sm">{note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="bl-chart" className="flex flex-col gap-5">
            <SectionHead ruled num="01" id="bl-chart" end={t('chart.hint')}>{t('chart.heading')}</SectionHead>
            <div className="cut notch flex flex-col gap-5 p-4 [--cut:var(--cut-lg)] min-[720px]:p-6">
              <ul className="flex flex-wrap gap-5 text-ink-dim signal">
                {RESTRICTED.map((code) => (
                  <li key={code} className="flex items-center gap-2">
                    <span aria-hidden className={twMerge('size-3 rounded-xs', STATUS_TONE[code].fill)} />
                    {status(code)}
                  </li>
                ))}
              </ul>
              <div className="overflow-x-auto pb-1">
                <div className="grid min-w-190 grid-cols-[28px_1fr] gap-x-3 gap-y-2">
                  <div aria-hidden className="relative h-56">
                    {TICKS.map((v) => (
                      <span key={v} className="absolute right-0 translate-y-1/2 text-ink-muted signal-sm" style={{ bottom: pct(v) }}>{v}</span>
                    ))}
                  </div>
                  <div className="relative h-56">
                    {TICKS.map((v) => (
                      <span key={v} aria-hidden className="absolute inset-x-0 h-px bg-line" style={{ bottom: pct(v) }} />
                    ))}
                    <ol className="relative flex h-full items-end gap-0.5">
                      {BANLISTS.map((l) => (
                        <li key={l.date} className="flex h-full min-w-0 flex-1">
                          <ListLink
                            list={l}
                            aria-label={t('chart.bar', { label: month(l), ...counts(l) })}
                            title={t('chart.bar', { label: month(l), ...counts(l) })}
                            aria-current={l === list ? 'true' : undefined}
                            className="flex flex-1 flex-col justify-end hover:bg-surface-300 aria-[current=true]:bg-ground-cyan aria-[current=true]:shadow-[inset_0_0_0_2px_var(--color-cyan)]"
                          >
                            <span className="block rounded-t-xs bg-gold" style={{ height: pct(l.cards.S.length) }} />
                            <span className="block bg-tier-bronze" style={{ height: pct(l.cards.L.length) }} />
                            <span className="block bg-crimson" style={{ height: pct(l.cards.F.length) }} />
                          </ListLink>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <span />
                  <div aria-hidden className="flex h-3 gap-0.5">
                    {BANLISTS.map((l, i) => (
                      <span key={l.date} className="relative min-w-0 flex-1">
                        <span className="absolute left-0 whitespace-nowrap text-ink-muted signal-sm">{YEAR_TICKS[i]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <AdBanner id="ad-top" placement="content" />

          <section id="list" aria-labelledby="bl-timeline" className="flex scroll-mt-20 flex-col gap-5">
            <SectionHead ruled num="02" id="bl-timeline" end={t('timeline.meta', { count: BANLISTS.length })}>{t('timeline.heading')}</SectionHead>
            <nav
              aria-label={t('timeline.nav')}
              className="sticky top-0 z-20 flex items-center gap-2 border border-line bg-surface-200/95 p-2 backdrop-blur-sm xl:top-15"
            >
              {prev ? (
                <ListLink list={prev} rel="prev" aria-label={t('timeline.previous')} className="flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-ink-muted signal-strong hover:text-ink">
                  <Icon name="right" className="rotate-180" /> <span className="max-sm:hidden">{t('timeline.previous')}</span>
                </ListLink>
              ) : null}
              <label htmlFor="bl-pick" className="sr-only">{t('timeline.pick')}</label>
              <select
                id="bl-pick"
                value={list.date}
                onChange={(e) => showList(banlistByDate(e.target.value)!)}
                className="h-10 min-w-0 flex-1 cursor-pointer border border-line-strong bg-surface-100 px-3 text-ink body-strong"
              >
                {[...YEARS].map(([year, lists]) => (
                  <optgroup key={year} label={year}>
                    {lists.map((l) => (
                      <option key={l.date} value={l.date}>
                        {[
                          month(l),
                          ...(l === current ? [t('timeline.inForce')] : l.index > current.index ? [t('timeline.announced')] : []),
                        ].join(' · ')}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {next ? (
                <ListLink list={next} rel="next" aria-label={t('timeline.next')} className="flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-ink-muted signal-strong hover:text-ink">
                  <span className="max-sm:hidden">{t('timeline.next')}</span> <Icon name="right" />
                </ListLink>
              ) : null}
            </nav>

              <article aria-labelledby="bl-list" className="cut notch flex min-w-0 flex-col gap-6 p-4 [--cut:var(--cut-lg)] min-[720px]:p-6">
                <header className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-ink-muted signal">{t('timeline.position', { num: list.index + 1, count: BANLISTS.length })}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 id="bl-list" className="text-ink display-2">{label}</h2>
                      {badge(list)}
                    </div>
                    <p className="text-ink-dim signal-lg">
                      {list.end ? (
                        <>
                          <time dateTime={list.date}>{day(list.date)}</time> → <time dateTime={list.end}>{day(list.end)}</time>
                        </>
                      ) : (
                        t('timeline.since', { date: day(list.date) })
                      )}
                    </p>
                  </div>
                </header>

                <dl className="grid grid-cols-3 gap-px border border-line bg-line">
                  {RESTRICTED.map((code) => {
                    const n = list.cards[code].length
                    const delta = prev ? n - prev.cards[code].length : n
                    return (
                      <div key={code} className="flex min-w-0 flex-col gap-1.5 bg-surface-200 px-3 py-3 sm:px-5 sm:py-4">
                        <dt className="flex min-w-0 items-center gap-2 text-ink-dim signal max-sm:signal-sm">
                          <span aria-hidden className={twMerge('size-2.5 shrink-0 rounded-xs', STATUS_TONE[code].fill)} />
                          <span className="truncate">{status(code)}</span>
                        </dt>
                        <dd className="flex items-baseline gap-2.5">
                          <span className="text-ink display-2">{n}</span>
                          <span
                            title={t('timeline.vsPrevious')}
                            className={twMerge('signal-sm', delta > 0 ? 'text-loss' : delta < 0 ? 'text-win' : 'text-ink-muted')}
                          >
                            {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '='}
                          </span>
                        </dd>
                      </div>
                    )
                  })}
                </dl>

                <section aria-labelledby="bl-changed" className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 id="bl-changed" className="text-ink display-3">{t('timeline.changed', { count: list.changes.length })}</h3>
                    <Segmented
                      size="sm"
                      label={t('timeline.view')}
                      value={view}
                      onChange={saveView}
                      options={[
                        { value: 'grid', label: <span className="flex items-center gap-2"><Icon name="cards" size={14} />{t('timeline.grid')}</span> },
                        { value: 'text', label: <span className="flex items-center gap-2"><Icon name="menu" size={14} />{t('timeline.text')}</span> },
                      ]}
                    />
                  </div>
                  {list.index === 0 ? <p className="text-ink-dim body">{t('timeline.first')}</p> : null}
                  {(['F', 'L', 'S', 'U'] as const).map((to) => {
                    const rows = list.changes
                      .filter((c) => c.to === to)
                      .sort((a, b) => cardName(a.card).localeCompare(cardName(b.card)))
                    if (!rows.length) return null
                    return (
                      <div key={to} className="flex flex-col gap-2">
                        <h4 className="flex items-center gap-2.5 border-b border-line pb-2 signal">
                          <span aria-hidden className={twMerge('size-2.5 rounded-xs', STATUS_TONE[to].fill)} />
                          <b className={STATUS_TONE[to].text}>{t(`timeline.group.${to}`)}</b>
                          <span className="text-ink-muted">{rows.length}</span>
                        </h4>
                        {grid ? (
                          <CardGrid>
                            {rows.map(({ card, from }) => <CardTile key={card} card={card} from={from} to={to} />)}
                          </CardGrid>
                        ) : (
                          <ul className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-6">
                            {rows.map(({ card, from }) => (
                              <li key={card} className="flex min-w-0 items-center gap-3 border-b border-line py-2">
                                <Link href={wikiPath(card)} target="_blank" rel="noopener" className="min-w-0 flex-1 text-ink body hover:text-cyan">{cardName(card)}</Link>
                                <StatusShift from={from} to={to} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </section>

                <section aria-labelledby="bl-full" className="flex flex-col gap-4">
                  <h3 id="bl-full" className="text-ink display-3">{t('timeline.full', { count: list.total })}</h3>
                  <div className="flex flex-col gap-6">
                    {RESTRICTED.map((code) => (
                      <div key={code} className="flex min-w-0 flex-col gap-2">
                        <h4 className="flex items-center gap-2.5 border-b border-line pb-2 signal">
                          <span aria-hidden className={twMerge('size-2.5 rounded-xs', STATUS_TONE[code].fill)} />
                          <b className={STATUS_TONE[code].text}>{status(code)}</b>
                          <span className="text-ink-muted">{list.cards[code].length}</span>
                        </h4>
                        {list.cards[code].length && grid ? (
                          <CardGrid>
                            {list.cards[code].map((card) => <CardTile key={card} card={card} />)}
                          </CardGrid>
                        ) : list.cards[code].length ? (
                          <ul className="columns-[13rem] gap-6">
                            {list.cards[code].map((card) => (
                              <li key={card}>
                                <Link href={wikiPath(card)} target="_blank" rel="noopener" className="block py-1 text-ink-dim body-sm hover:text-cyan">{cardName(card)}</Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="py-1.5 text-ink-muted body-sm">{t('timeline.none')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </article>
          </section>

          <CardHistory selected={list.index} current={current.index} />

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
