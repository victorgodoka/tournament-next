'use client'

import Image, { type ImageProps } from 'next/image'
import { cardLoader } from '@utils/image-loader'

/**
 * `next/image` with the card loader, for Server Components: a loader is a function, so it can't be handed to
 * `Image` across the server boundary. It has to be set here. Without the Cloudinary flag `cardLoader` is
 * `undefined`, so a server file passing it directly only breaks in production.
 */
export const CardImage = ({ alt, ...props }: Omit<ImageProps, 'loader'>) => <Image loader={cardLoader} alt={alt} {...props} />
