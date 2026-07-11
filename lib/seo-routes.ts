export type SeoRoute = {
  path: string
  changeFrequency: 'weekly' | 'monthly' | 'daily'
  priority: number
}

export const INDEXABLE_ROUTES: SeoRoute[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/leaderboards', changeFrequency: 'daily', priority: 0.9 },
  { path: '/profile', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.3 },
]
