export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

export type AvatarShape = 'square' | 'rounded' | 'circle'

export type AvatarComponentProps = {
  src?: string
  alt: string
  size?: AvatarSize
  shape?: AvatarShape
  borderColor?: string
  borderWidth?: number
  className?: string
}
