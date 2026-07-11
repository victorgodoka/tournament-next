export interface PlayerData {
  success?: true
  id: string
  username: string
  displayname: string
  avatar: string | null
  tcgwins: number
  tcgloses: number
  tcgdraws: number
  ocgwins: number
  ocgloses: number
  ocgdraws: number
  tcgrating: number
  ocgrating: number
  lastlogin: string
  accountrank: number
}
