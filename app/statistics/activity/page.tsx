import { getTranslations } from 'next-intl/server'
import { Panel } from '@ui/panel'
import { pageMetadata } from '@utils/metadata'
import { getOmegaActivity } from '@utils/statistics'
import { BusiestHours, OmegaActivity } from './OmegaActivity'
import { StatsShell } from '../StatsShell'

export async function generateMetadata() {
  const t = await getTranslations('Statistics.activity')
  return pageMetadata({ title: t('title'), path: '/statistics/activity', description: t('description') })
}

/** Logins and ranked activity of the whole game, apart from the meta report. */
const ActivityPage = async ({ searchParams }: { searchParams: Promise<{ ladder?: string | string[] }> }) => {
  const t = await getTranslations('Statistics')
  const { ladder } = await searchParams
  const data = await getOmegaActivity()
  return (
    <StatsShell>
      <div className="flex flex-col gap-2">
        <h1 className="display-2 text-ink">{t('activity.title')}</h1>
      </div>
      {data ? (
        <>
          <OmegaActivity data={data} ladder={ladder === 'genesys' ? 'genesys' : 'tcg'} />
          <div className="mt-8"><BusiestHours hours={data.hours} /></div>
        </>
      ) : (
        <Panel title={t('error.title')} className="mt-6"><p className="text-ink-dim body">{t('error.body')}</p></Panel>
      )}
    </StatsShell>
  )
}

export default ActivityPage
