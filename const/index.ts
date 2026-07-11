const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/v3'

export const API_ENDPOINTS = {
  MAIN: apiBaseUrl,
  DISCORD: 'https://discord.com/api',
  DUELISTS_UNITE_V3: apiBaseUrl,
} as const
