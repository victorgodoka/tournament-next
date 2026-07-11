export type MenuLinkItem = {
  to: string
  label: string
  icon: string
}

export type MenuLink = {
  id: string
  label: string
  to: string
}

export type MenuGroup = {
  id: string
  label: string
  items: MenuLinkItem[]
}

export type MenuEntry = MenuLink | MenuGroup

export const isMenuGroup = (entry: MenuEntry): entry is MenuGroup =>
  'items' in entry
