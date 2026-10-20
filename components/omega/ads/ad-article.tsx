'use client'

import { useCallback } from 'react'
import { contentWidth, fitSizes } from '@utils/nitro-ads'
import { ARTICLE_AD_OPTIONS } from '@utils/nitro-ads.const'
import { useAdsMode } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'

const ArticlePlacement = ({ targetId }: { targetId: string }) => {
  // Read when the slot asks: the column is 860px on desktop, less on a tablet.
  const options = useCallback(() => {
    const sizes = fitSizes(ARTICLE_AD_OPTIONS.sizes, contentWidth(document.getElementById(targetId)))
    return sizes.length ? { ...ARTICLE_AD_OPTIONS, sizes } : null
  }, [targetId])
  useNitroAd(targetId, options)
  return null
}

/**
 * Nitro's `article` format: units spaced through the element `targetId` names, the article
 * itself. Mounted only with ads on, so the hook never runs its disabled branch over the article.
 */
export const AdArticle = ({ targetId }: { targetId: string }) =>
  useAdsMode() === 'all' ? <ArticlePlacement targetId={targetId} /> : null
