import {
  DISCORD_SERVER_LINK,
  PRIVACY_TERMS_CONST,
  SITE_URL,
} from '@lib/site-config'

export const TERMS_META = {
  lastUpdated: PRIVACY_TERMS_CONST.LAST_UPDATE,
  lastUpdatedLabel: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${PRIVACY_TERMS_CONST.LAST_UPDATE}T12:00:00Z`)),
  email: PRIVACY_TERMS_CONST.EMAIL,
  country: PRIVACY_TERMS_CONST.COUNTRY,
  jurisdiction: PRIVACY_TERMS_CONST.JURISDICTION,
  discordLink: DISCORD_SERVER_LINK,
  siteHostname: new URL(SITE_URL).hostname,
} as const

export const TERMS_SECTION_NAV = [
  { id: 'the-service', label: 'The Service' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'code-of-conduct', label: 'Code of Conduct' },
  { id: 'tournaments-and-fair-play', label: 'Tournaments and Fair Play' },
  { id: 'rankings-and-match-data', label: 'Rankings and Match Data' },
  { id: 'user-content', label: 'User Content' },
  { id: 'intellectual-property', label: 'Intellectual Property' },
  { id: 'third-party-services', label: 'Third-Party Services' },
  {
    id: 'availability-and-changes',
    label: 'Availability and Changes to the Service',
  },
  { id: 'disclaimer-of-warranties', label: 'Disclaimer of Warranties' },
  { id: 'limitation-of-liability', label: 'Limitation of Liability' },
  { id: 'termination', label: 'Termination' },
  { id: 'changes-to-these-terms', label: 'Changes to These Terms' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'contact', label: 'Contact' },
] as const
