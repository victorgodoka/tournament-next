'use client'

import { useEffect } from 'react'

const SITE_NAME = 'YGO Omega'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME

    return () => {
      document.title = previousTitle
    }
  }, [title])
}
