'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cleanupOAuthParams, clearOAuthHashFromUrl } from './discord.oauth'

type OAuthRedirect = 'discord' | 'not-found' | null

function parseDiscordParams(): boolean {
  const currentUrl = window.location.href
  let searchParams = ''

  if (window.location.hash.includes('access_token')) {
    const hashPart = window.location.hash.substring(1)
    searchParams = hashPart.includes('?') ? hashPart.split('?')[1] : hashPart
  } else if (window.location.search) {
    searchParams = window.location.search.substring(1)
  } else if (currentUrl.includes('#%2F%3F=&')) {
    const cleanedUrl = currentUrl.replace('#%2F%3F=&', '?&')
    const url = new URL(cleanedUrl)
    searchParams = url.search.substring(1)
  }

  if (!searchParams) return false

  const params = new URLSearchParams(searchParams)
  const accessToken = params.get('access_token')
  const tokenType = params.get('token_type')
  const expiresIn = params.get('expires_in')

  if (!accessToken || !tokenType || !expiresIn) {
    return false
  }

  localStorage.setItem('access_token', accessToken)
  localStorage.setItem('token_type', tokenType)
  localStorage.setItem('expires_in', expiresIn)
  localStorage.setItem('scope', params.get('scope') || '')
  localStorage.setItem('state', params.get('state') || '')

  clearOAuthHashFromUrl()
  return true
}

const CatchDiscordError = () => {
  const router = useRouter()
  const [redirect, setRedirect] = useState<OAuthRedirect>(null)

  useEffect(() => {
    if (parseDiscordParams()) {
      setRedirect('discord')
      return
    }

    cleanupOAuthParams()
    setRedirect('not-found')
  }, [])

  useEffect(() => {
    if (redirect === 'discord') {
      router.replace('/discord')
    } else if (redirect === 'not-found') {
      router.replace('/not-found')
    }
  }, [redirect, router])

  return null
}

export default CatchDiscordError
