/**
 * Card art and card images come from ygopro.online, which takes 2-6 s per file and sends the full JPG
 * (~220 KB) even for a 32 px thumbnail. With `NEXT_PUBLIC_CARD_ART_FETCH=cloudinary` (and Cloudinary's
 * "Fetched URL" delivery allowed for ygopro.online in the account's security settings) the card
 * `<Image>`s take this loader: fetched from the origin once, kept at the CDN edge, resized and
 * re-encoded there. Without the flag it is `undefined`, and `next/image` uses its own optimizer.
 *
 * A per-image loader, not `images.loaderFile`: a site-wide custom loader turns `/_next/image` off, and
 * every other image (avatars, local files) still needs it.
 */

import type { ImageLoader } from 'next/image'

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const FETCH = process.env.NEXT_PUBLIC_CARD_ART_FETCH === 'cloudinary'

export const cardLoader: ImageLoader | undefined =
  FETCH && CLOUD ? ({ src, width }) => `https://res.cloudinary.com/${CLOUD}/image/fetch/c_limit,w_${width},q_auto:eco,f_auto/${src}` : undefined
