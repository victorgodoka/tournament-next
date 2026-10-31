import { Footer } from '@ui/footer'
import { Header } from '@ui/header'

/** The chrome of every statistics page. 88px clears the fixed header. */
export const StatsShell = ({ children }: { children: React.ReactNode }) => (
  <>
    <Header />
    <div className="oh-space" style={{ width: '100%', minHeight: '100vh', overflowX: 'clip', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <main style={{ width: 'min(var(--container-page), calc(100% - 32px))', margin: '0 auto', padding: '88px 0 96px' }}>{children}</main>
    </div>
    <Footer />
  </>
)

const Bar = ({ className }: { className: string }) => <div className={`animate-pulse bg-surface-200 motion-reduce:animate-none ${className}`} />

/** The page's shape while it loads: no spinner, nothing jumps when the data lands. */
export const StatsSkeleton = () => (
  <StatsShell>
    <div role="status" aria-busy className="flex flex-col gap-6">
      <Bar className="h-4 w-40" />
      <Bar className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-px min-[720px]:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Bar key={i} className="h-24" />)}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => <Bar key={i} className="h-12" />)}
    </div>
  </StatsShell>
)
