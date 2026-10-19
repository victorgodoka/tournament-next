'use client'

import dynamic from 'next/dynamic'

// Client only: the calculator boots from `?c=` / `?d=`, which the server can't match.
const Calculator = dynamic(() => import('./calculator.client'), { ssr: false })

export const CalculatorLoader = () => <Calculator />
