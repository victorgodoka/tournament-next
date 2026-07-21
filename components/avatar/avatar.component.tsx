'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { AvatarComponentProps } from './avatar.types'
import './avatar.styles.css'

function getInitials(alt: string) {
  return alt
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const IMAGE_SIZES = {
  sm: 30,
  md: 38,
  lg: 54,
  xl: 78,
} as const

const AvatarComponent = ({
  src,
  alt,
  size = 'md',
  shape = 'circle',
  borderColor,
  borderWidth = 2,
  className,
}: AvatarComponentProps) => {
  const [hasError, setHasError] = useState(false)
  const showImage = Boolean(src) && !hasError
  const imageSrc = src ?? ''
  const classes = [
    'avatar',
    `avatar--${size}`,
    `avatar--${shape}`,
    borderColor ? 'avatar--bordered' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const borderStyle = borderColor
    ? { border: `${borderWidth}px solid ${borderColor}` }
    : undefined

  const dimension = IMAGE_SIZES[size]

  return (
    <span
      className={classes}
      style={borderStyle}
      // The fallback initials are decorative — the accessible name has to
      // live on the wrapper or the avatar is nameless when the image fails.
      role={showImage ? undefined : 'img'}
      aria-label={showImage ? undefined : alt}
    >
      {showImage ? (
        <Image
          className="avatar__image"
          src={imageSrc}
          alt={alt}
          width={dimension}
          height={dimension}
          sizes={`${dimension}px`}
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="avatar__fallback" aria-hidden="true">
          {getInitials(alt)}
        </span>
      )}
    </span>
  )
}

export default AvatarComponent
