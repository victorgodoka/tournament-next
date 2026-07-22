export interface Duelist {
  id: string
  bio: string
  duelistFavorite?: CardOption
  socialX?: string
  socialInstagram?: string
  socialYoutube?: string
  socialTwitch?: string
  coverImage?: File
  hideMatchHistory: boolean
}

export interface CardOption {
  id: string;
  name: string;
}

/** Client-side form state. Socials are stored as plain handles (the display
 * page turns them into URLs); `favorite` is null until a card is picked;
 * `coverFile` is the freshly chosen upload, `coverUrl` the already-saved banner
 * used for the initial preview. */
export interface ProfileEditValues {
  bio: string
  favorite: CardOption | null
  socialX: string
  socialInstagram: string
  socialYoutube: string
  socialTwitch: string
  hideMatchHistory: boolean
  coverFile: File | null
  coverUrl: string
}
