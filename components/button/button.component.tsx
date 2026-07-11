import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Icon } from '@iconify/react'
import type { ButtonIconPosition, ButtonSize, ButtonVariant } from './button.types'
import './button.styles.css'

type ButtonBaseProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  icon?: string
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
  Omit<LinkProps, 'className' | 'children'> & {
    to: LinkProps['to']
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
  loading,
}: {
  children?: ReactNode
  icon?: string
  iconPosition: ButtonIconPosition
  loading: boolean
}) {
  const showStartIcon = loading || (icon && iconPosition === 'start')
  const showEndIcon = !loading && icon && iconPosition === 'end'

  return (
    <>
      {showStartIcon && (
        <Icon
          className={`button__icon${loading ? ' button__icon--spin' : ''}`}
          icon={loading ? 'mdi:loading' : icon!}
          width={18}
          height={18}
          aria-hidden
        />
      )}
      {children && <span className="button__label">{children}</span>}
      {showEndIcon && (
        <Icon className="button__icon" icon={icon} width={18} height={18} aria-hidden />
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
        to={to}
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
