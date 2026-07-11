export type ProfileMenuItem = {
  label: string
  icon: string
  to: string
}

export const PROFILE_MENU_ITEMS: ProfileMenuItem[] = [
  {
    label: 'My Profile',
    icon: 'mdi:account',
    to: '/profile',
  },
  {
    label: 'My Decks',
    icon: 'mdi:cards',
    to: '/decks',
  },
  {
    label: 'Edit Profile',
    icon: 'mdi:account-edit',
    to: '/profile/edit',
  },
]

export const LOGOUT_MENU_ITEM = {
  label: 'Logout',
  icon: 'material-symbols:logout',
} as const

export const HOVER_CLOSE_DELAY = 160
