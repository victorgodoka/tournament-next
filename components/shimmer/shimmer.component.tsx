import { CARD_PLACEHOLDER_SRC } from '@app/profile/profile.const'
import Image, { type ImageProps } from 'next/image'

// Simple gray shimmer skeleton SVG string
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://w3.org" xmlns:xlink="http://w3.org">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#333" offset="20%" />
      <stop stop-color="#222" offset="50%" />
      <stop stop-color="#333" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#333" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite" />
</svg>`

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str)

export default function ShimmerImage(props: ImageProps) {
  const width = Number(props.width) || 700
  const height = Number(props.height) || 450
  return (
    <Image
      {...props}
      placeholder="blur"
      blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(width, height))}`}
      onError={(event) => {
        event.currentTarget.src = CARD_PLACEHOLDER_SRC
        event.currentTarget.onerror = null
      }}
    />
  )
}
