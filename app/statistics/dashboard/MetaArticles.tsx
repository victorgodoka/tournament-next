import { getTranslations } from 'next-intl/server'
import { MediaCard } from '@omega-hub/ds'
import { coverUrl } from '@omega/wiki/article'
import { LocalDay } from '@omega/wiki/local-day'
import { getMetaArticles } from '@utils/articles'

const ladderOf = (slug: string) => (slug === 'yu-gi-oh-genesys-tier-list' ? 'Genesys' : slug === 'yu-gi-oh-tcg-tier-list' ? 'TCG' : null)

/**
 * Both fixed tier lists and the newest meta reports, up top, whatever ladder the page shows: a compact row each, cover
 * beside the text. A tier list gets the gold edge.
 */
export const MetaArticles = async () => {
  const [t, articles] = await Promise.all([getTranslations('Statistics.play.wiki'), getMetaArticles()])
  if (!articles.length) return null
  return (
    <section aria-label={t('title')} className="grid gap-3 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-4">
      {articles.map((a) => {
        const ladder = ladderOf(a.slug)
        return (
          <MediaCard
            key={a.id}
            href={`/wiki/${a.slug}`}
            size="sm"
            layout="row"
            ratio="1200 / 630"
            image={coverUrl(a.cover, 176)}
            accent={ladder ? 'gold' : 'cyan'}
            className={ladder ? 'h-full bg-gold' : 'h-full'}
            eyebrow={<span className={ladder ? 'text-gold' : 'text-azure-lift'}>{ladder ? t('tierList', { ladder }) : t('report')}</span>}
            title={a.title}
            meta={<LocalDay iso={a.publishedAt ?? a.updatedAt} />}
          />
        )
      })}
    </section>
  )
}
