'use client'

import { Icon } from '@iconify/react'

type IconComponentProps = {
  icon: string
  className?: string
  width?: number
  height?: number
}

const IconComponent = ({
  icon,
  className,
  width = 18,
  height = 18,
}: IconComponentProps) => {
  return (
    <Icon
      icon={icon}
      className={className}
      width={width}
      height={height}
      aria-hidden
    />
  )
}

export default IconComponent
