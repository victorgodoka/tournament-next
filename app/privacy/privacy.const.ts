import {
  DISCORD_SERVER_LINK,
  PRIVACY_TERMS_CONST,
  SITE_URL,
} from '@lib/site-config'

export const PRIVACY_META = {
  lastUpdated: PRIVACY_TERMS_CONST.LAST_UPDATE,
  lastUpdatedLabel: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${PRIVACY_TERMS_CONST.LAST_UPDATE}T12:00:00Z`)),
  email: PRIVACY_TERMS_CONST.EMAIL,
  country: PRIVACY_TERMS_CONST.COUNTRY,
  region: PRIVACY_TERMS_CONST.REGION,
  discordLink: DISCORD_SERVER_LINK,
  siteHostname: new URL(SITE_URL).hostname,
} as const

export const PRIVACY_SECTION_NAV = [
  { id: 'who-we-are', label: 'Who We Are' },
  { id: 'information-we-collect', label: 'Information We Collect' },
  { id: 'how-we-use', label: 'How We Use Your Information' },
  { id: 'public-information', label: 'Information That Is Public' },
  { id: 'how-we-share', label: 'How We Share Information' },
  { id: 'data-retention', label: 'Data Retention' },
  { id: 'security', label: 'Security' },
  { id: 'childrens-privacy', label: "Children's Privacy" },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'international-users', label: 'International Users' },
  { id: 'third-party-links', label: 'Third-Party Links' },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact-us', label: 'Contact Us' },
] as const
