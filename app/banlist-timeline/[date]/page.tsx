import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { banlistByDate, banlistPath, currentBanlist, listDate } from '@utils/banlist'
import { pageMetadata } from '@utils/metadata'
import { BanlistTimeline } from '../timeline'

type BanlistRouteProps = { params: Promise<{ date: string }> }

export async function generateMetadata({ params }: BanlistRouteProps) {
  const list = banlistByDate((await params).date)
  if (!list) return {}
  const t = await getTranslations('Banlist.meta')
  const format = await getFormatter()
  const date = listDate(list.date)
  const label = format.dateTime(date, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return pageMetadata({
    title: t('listTitle', { label }),
    // Near-identical to /banlist while it is the current list: one URL for that query.
    path: list.date === currentBanlist().date ? '/banlist' : banlistPath(list),
    description: t('listDescription', {
      label,
      start: format.dateTime(date, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
      changes: list.changes.length,
      forbidden: list.cards.F.length,
      limited: list.cards.L.length,
      semi: list.cards.S.length,
    }),
    article: { publishedTime: list.date },
  })
}

/** One list, `/banlist-timeline/2025-04-07`: its own title and answers for "Yu-Gi-Oh! banlist April 2025". */
const BanlistPage = async ({ params }: BanlistRouteProps) => {
  const list = banlistByDate((await params).date)
  if (!list) notFound()
  return <BanlistTimeline currentIndex={currentBanlist().index} />
}

export default BanlistPage
