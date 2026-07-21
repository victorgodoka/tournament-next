'use client'

import { addCollection, Icon } from '@iconify/react/offline'
import mdiSubset from '@assets/icons/mdi-subset.generated.json'

// Registers every mdi: icon the app uses so <Icon> renders synchronously
// from bundled data instead of resolving each name against the Iconify API
// at runtime. Regenerate the subset after adding a new icon name:
//   node scripts/generate-icon-subset.mjs
addCollection(mdiSubset)

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
