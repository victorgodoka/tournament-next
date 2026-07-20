import Link from 'next/link'
import IconComponent from '../icon/icon.component'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import type { ButtonIconPosition, ButtonSize, ButtonVariant } from './button.types'
import './button.styles.css'

type NextLinkProps = ComponentProps<typeof Link>

type ButtonBaseProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  icon?: string
  iconClassname?: string
  iconPosition?: ButtonIconPosition
  children?: ReactNode
  className?: string
}

type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: undefined
    href?: undefined
  }

type ButtonAsLink = ButtonBaseProps &
  Omit<NextLinkProps, 'className' | 'children' | 'href'> & {
    to: NextLinkProps['href']
    href?: undefined
  }

type ButtonAsAnchor = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & {
    href: string
    to?: undefined
  }

export type ButtonComponentProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor

function buildClassName({
  variant,
  size,
  fullWidth,
  loading,
  className,
}: {
  variant: ButtonVariant
  size: ButtonSize
  fullWidth: boolean
  loading: boolean
  className?: string
}) {
  return [
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth ? 'button--full' : '',
    loading ? 'button--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

function ButtonContent({
  children,
  icon,
  iconPosition,
  iconClassname,
  loading,
}: {
  children?: ReactNode
  icon?: string
  iconPosition: ButtonIconPosition
  iconClassname?: string
  loading: boolean
}) {
  const showStartIcon = loading || (icon && iconPosition === 'start')
  const showEndIcon = !loading && icon && iconPosition === 'end'

  return (
    <>
      {showStartIcon && (
        <IconComponent
          className={`button__icon ${iconClassname}${loading ? ' button__icon--spin' : ''}`}
          icon={loading ? 'mdi:loading' : icon!}
          width={18}
          height={18}
          aria-hidden
        />
      )}
      {children && <div className="button__label">{children}</div>}
      {showEndIcon && (
        <IconComponent className="button__icon" icon={icon} width={18} height={18} aria-hidden />
      )}
    </>
  )
}

const ButtonComponent = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  iconPosition = 'start',
  iconClassname = '',
  children,
  className,
  ...props
}: ButtonComponentProps) => {
  const classes = buildClassName({ variant, size, fullWidth, loading, className })

  if ('href' in props && props.href !== undefined) {
    const { href, ...anchorProps } = props

    return (
      <a
        href={href}
        className={classes}
        aria-busy={loading || undefined}
        {...anchorProps}
      >
        <ButtonContent
          icon={icon}
          iconPosition={iconPosition}
          loading={loading}
          iconClassname={iconClassname}
        >
          {children}
        </ButtonContent>
      </a>
    )
  }

  if ('to' in props && props.to !== undefined) {
    const { to, ...linkProps } = props

    return (
      <Link
        href={to}
        className={classes}
        aria-busy={loading || undefined}
        {...linkProps}
      >
        <ButtonContent
          icon={icon}
          iconPosition={iconPosition}
          loading={loading}
        >
          {children}
        </ButtonContent>
      </Link>
    )
  }

  const { disabled, type = 'button', ...buttonProps } = props

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      <ButtonContent
        icon={icon}
        iconPosition={iconPosition}
        loading={loading}
      >
        {children}
      </ButtonContent>
    </button>
  )
}

export default ButtonComponent
