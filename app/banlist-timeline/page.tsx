import { getFormatter, getTranslations } from 'next-intl/server'
import { BANLIST_CARDS, BANLIST_CHANGES, BANLISTS, currentBanlist, listDate } from '@utils/banlist'
import { pageMetadata } from '@utils/metadata'
import { BanlistTimeline } from './timeline'

export async function generateMetadata() {
  const t = await getTranslations('Banlist.meta')
  const format = await getFormatter()
  const current = currentBanlist()
  return pageMetadata({
    title: t('title'),
    path: '/banlist-timeline',
    description: t('description', {
      lists: BANLISTS.length,
      changes: format.number(BANLIST_CHANGES),
      cards: format.number(BANLIST_CARDS.length),
      current: format.dateTime(listDate(current.date), { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      forbidden: current.cards.F.length,
    }),
  })
}

const BanlistTimelinePage = () => <BanlistTimeline currentIndex={currentBanlist().index} />

export default BanlistTimelinePage
