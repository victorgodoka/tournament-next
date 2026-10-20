'use client'

import { ARTICLE_AD_OPTIONS } from '@utils/nitro-ads.const'
import { useAdsMode } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'

const ArticlePlacement = ({ targetId }: { targetId: string }) => {
  useNitroAd(targetId, ARTICLE_AD_OPTIONS)
  return null
}

/**
 * Nitro's `article` format: units spaced through the element `targetId` names, the article
 * itself. Mounted only with ads on, so the hook never runs its disabled branch over the article.
 */
export const AdArticle = ({ targetId }: { targetId: string }) =>
  useAdsMode() === 'all' ? <ArticlePlacement targetId={targetId} /> : null
