import { useState } from 'react'
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

  return (
    <span className={classes} style={borderStyle}>
      {showImage ? (
        <img
          className="avatar__image"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
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
