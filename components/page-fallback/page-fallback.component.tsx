type PageFallbackProps = {
  label: string
  narrow?: boolean
}

/** Route-level loading fallback — an announced, styled shimmer block. */
const PageFallback = ({ label, narrow = false }: PageFallbackProps) => (
  <div className={`omega-container${narrow ? ' omega-container--narrow' : ''} page-fallback-wrap`}>
    <div className="page-fallback" role="status" aria-busy="true" aria-label={label} />
  </div>
)

export default PageFallback
