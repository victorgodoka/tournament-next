'use client'

import Image, { type ImageProps } from 'next/image'

/** `next/image` for card art: Next's optimizer resizes it (`next.config.ts` allows the ygopro.online paths). */
export const CardImage = ({ alt, ...props }: ImageProps) => <Image alt={alt} {...props} />
