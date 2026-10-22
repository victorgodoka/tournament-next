'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

const Loading = () => {
  const t = useTranslations('Simulator')
  return (
    <p role="status" className="mx-auto w-[min(var(--container-page),calc(100%-32px))] pt-8 text-ink-muted body">
      {t('loading')}
    </p>
  )
}

// Client only: the simulator boots from `?d=` and the local draft, which the server can't see.
const Simulator = dynamic(() => import('./simulator.client'), { ssr: false, loading: Loading })

export const SimulatorLoader = () => <Simulator />
