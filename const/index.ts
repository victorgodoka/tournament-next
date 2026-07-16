const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v3'

export const API_ENDPOINTS = {
  MAIN: apiBaseUrl,
  DISCORD: 'https://discord.com/api',
  OMEGA: 'http://127.0.0.1:19999',
} as const
