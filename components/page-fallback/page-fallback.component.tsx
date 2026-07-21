import { cn } from '@sglara/cn'

type PageFallbackProps = {
  label: string
  narrow?: boolean
}

/** Route-level loading fallback — an announced, styled shimmer block. */
const PageFallback = ({ label, narrow = false }: PageFallbackProps) => (
  <div
    className={cn('omega-container', 'page-fallback-wrap', {
      'omega-container--narrow': narrow,
    })}
  >
    <div className="page-fallback" role="status" aria-busy="true" aria-label={label} />
  </div>
)

export default PageFallback
