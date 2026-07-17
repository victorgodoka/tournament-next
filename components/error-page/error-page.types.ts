export type ErrorPageProps = {
  code?: string | number
  title?: string
  description?: string
  details?: string
  retryLabel?: string
  onRetry?: () => void
  backHref?: string
  backLabel?: string
  isPending?: boolean
}
