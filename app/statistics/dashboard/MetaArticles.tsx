import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ARTICLE_LIST, ArticleRow } from '@omega/wiki/article'
import { getMetaArticles } from '@utils/articles'
import { LINK_BTN } from '../format'
import { Box } from '../kit'

/** The ladder's fixed tier list and the newest meta reports from the wiki. Nothing published: no block. */
export const MetaArticles = async ({ ladder }: { ladder: 'tcg' | 'genesys' }) => {
  const [t, articles] = await Promise.all([getTranslations('Statistics.play.wiki'), getMetaArticles(ladder)])
  if (!articles.length) return null
  return (
    <Box className="gap-4 p-6 max-[719px]:gap-3 max-[719px]:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="m-0 display-3 text-ink max-[719px]:text-xl">{t('title')}</h3>
        <Link href="/wiki" className={LINK_BTN}>{t('all')}</Link>
      </div>
      <p className="m-0 text-[13px] leading-5 text-ink-dim">{t('lede')}</p>
      <ul className={ARTICLE_LIST}>
        {articles.map((article) => <ArticleRow key={article.id} article={article} />)}
      </ul>
    </Box>
  )
}
