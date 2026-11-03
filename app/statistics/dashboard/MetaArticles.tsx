import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { twMerge } from 'tailwind-merge'
import { LocalDay } from '@omega/wiki/local-day'
import { getMetaArticles } from '@utils/articles'
import type { ArticleSummary } from '@utils/types'
import { imageSource } from '@utils/wiki-doc'

const ladderOf = (a: ArticleSummary) => (a.slug === 'yu-gi-oh-genesys-tier-list' ? 'Genesys' : a.slug === 'yu-gi-oh-tcg-tier-list' ? 'TCG' : null)

/** One article, compact: a small cover beside what it is, the title and the day. A tier list gets the gold edge. */
const Feature = ({ article, label, lead }: { article: ArticleSummary; label: string; lead: boolean }) => (
  <Link
    href={`/wiki/${article.slug}`}
    className={twMerge(
      'group cut notch grid min-w-0 grid-cols-[96px_minmax(0,1fr)] items-center gap-3 p-2.5 pr-4 text-ink-dim [--cut:var(--cut-md)] [--fill:var(--color-surface-100)] hover:[--fill:var(--color-surface-200)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan',
      lead ? '[--edge:var(--color-gold)]' : '[--edge:var(--color-line-mid)] hover:[--edge:var(--color-line-strong)]',
    )}
  >
    <span className="dots relative block aspect-[1200/630] overflow-hidden bg-surface-200">
      {article.cover ? <Image {...imageSource(article.cover, 200)} alt="" fill sizes="96px" className="object-cover" /> : null}
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={twMerge('signal-sm', lead ? 'text-gold' : 'text-azure-lift')}>{label}</span>
      <span className="truncate text-sm leading-5 font-bold text-ink">{article.title}</span>
      <span className="text-ink-muted caption"><LocalDay iso={article.publishedAt ?? article.updatedAt} /></span>
    </span>
  </Link>
)

/** Both fixed tier lists and the newest meta reports, up top, whatever ladder the page shows. Nothing published, no row. */
export const MetaArticles = async () => {
  const [t, articles] = await Promise.all([getTranslations('Statistics.play.wiki'), getMetaArticles()])
  if (!articles.length) return null
  return (
    <section aria-label={t('title')} className="grid gap-3 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-4">
      {articles.map((a) => {
        const ladder = ladderOf(a)
        return <Feature key={a.id} article={a} lead={!!ladder} label={ladder ? t('tierList', { ladder }) : t('report')} />
      })}
    </section>
  )
}
