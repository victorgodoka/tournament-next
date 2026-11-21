'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Head } from '../shared'
import { SettingsPanel } from './Settings'

const SettingsPage = () => {
  const router = useRouter()
  // /admin/staff#analysts and #editors were this page once: a hash never reaches the server, so send them on here
  useEffect(() => {
    if (['#analysts', '#editors'].includes(window.location.hash)) router.replace('/admin/access')
  }, [router])
  return (
    <>
      <Head eyebrow="System" title="Settings" lead="The values staff tune without a deploy. One save sends only what changed; each group says when the change is read." />
      <SettingsPanel />
    </>
  )
}

export default SettingsPage
