import React from 'react'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Icons render from a bundled offline collection (@iconify/react/offline);
// a static stub avoids pulling the real SVG-building logic into every test.
// Icons are decorative everywhere (aria-hidden), so a stub is enough.
vi.mock('@iconify/react/offline', () => ({
  Icon: ({
    icon,
    className,
    width,
    height,
  }: {
    icon: string
    className?: string
    width?: number | string
    height?: number | string
  }) => (
    <svg
      data-icon={icon}
      className={className}
      width={width}
      height={height}
      aria-hidden="true"
    />
  ),
  addCollection: () => {},
  addIcon: () => {},
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={typeof href === 'string' ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    onError,
    className,
    width,
    height,
  }: {
    src: string
    alt: string
    onError?: () => void
    className?: string
    width?: number
    height?: number
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={onError}
    />
  ),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const idleTimers = new Map<number, number>()
let nextIdleId = 1

window.requestIdleCallback = (callback: IdleRequestCallback) => {
  const id = nextIdleId++
  const timer = window.setTimeout(() => {
    idleTimers.delete(id)
    callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
  }, 0)
  idleTimers.set(id, timer)
  return id
}

window.cancelIdleCallback = (id: number) => {
  const timer = idleTimers.get(id)
  if (timer !== undefined) {
    idleTimers.delete(id)
    window.clearTimeout(timer)
  }
}
