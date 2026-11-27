export type NavbarItem = {
  item: string
  /** A plain link. Mutually exclusive with `children`. */
  to?: string
  loggedIn?: boolean
  /** Turns the entry into a dropdown; the parent stops being a link. */
  children?: { item: string; to: string }[]
}

// Ordered by GA4 traffic (Sep–Nov 2026). The logo is the home link; Duelists Unite's calculator replaces /calculator for now.
const BASE_NAVBAR_ITEMS: NavbarItem[] = [
  { item: "Leaderboard", to: "/leaderboard" },
  {
    item: "Compete",
    children: [
      { item: "Tournaments", to: "/tournaments" },
      { item: "Calendar", to: "/calendar" },
      { item: "Banlist timeline", to: "/banlist-timeline" },
      { item: "Banlist", to: "/banlist" },
    ],
  },
  {
    item: "Decks",
    children: [
      { item: "Public decks", to: "/decks" },
      { item: "Deck Builder", to: "/deck-builder" },
      { item: "Combo Simulator", to: "/simulator" },
      { item: "Published combos", to: "/simulator/combos" },
    ],
  },
  { item: "Statistics", to: "/statistics" },
  { item: "Wiki", to: "/wiki" },
  {
    item: "Tools",
    children: [
      { item: "Web Simulator", to: "https://duelistsunite.org/simulator/" },
      { item: "Combo Calculator", to: "https://duelistsunite.org/combo/" },
      { item: "Banlist Creator", to: "https://duelistsunite.org/banlist-creator/" },
      { item: "Card Maker", to: "https://duelistsunite.org/card-creator/" },
      { item: "Pack Opener", to: "https://duelistsunite.org/pack-opener/" },
      { item: "Forum", to: "https://forum.duelistsunite.org/" },
    ],
  },
]

export const HOME_NAVBAR_ITEMS: NavbarItem[] = [
  {
    item: "About", children: [
      { item: "Our Simulator", to: '#top' },
      { item: "Why Omega?", to: '#why' },
      { item: "Our Tournaments", to: '#tournaments' },
      { item: "Ranked", to: '#meta' },
      { item: "Different Rulings", to: '#rulings' },
      { item: "Formats", to: '#formats' },
      { item: "Our Tools", to: '#tools' },
      { item: "Auto and Manual", to: '#modes' },
      { item: "FAQ", to: '#faq' },
    ]
  },
  ...BASE_NAVBAR_ITEMS,
]

export const NAVBAR_ITEMS: NavbarItem[] = [
  ...BASE_NAVBAR_ITEMS,
]

export const ERROR_MAP = [
  { code: 404, image: "https://ygopro.online/assets/card-arts/47922711.jpg", eyebrow: ["Error 404 / Not found", "Search returned 0 results"], title: "This page is not in the database.", text: "The link is dead, renamed or mistyped. Nothing was lost on your side: your decks, replays and ranking are untouched." },
  { code: 403, image: "https://ygopro.online/assets/card-arts/58655504.jpg", eyebrow: ["Error 403 / Forbidden", "Role Check failed"], title: "You do not have permission to open this.", text: "This page is limited to certain accounts and roles. Sign in with the account that has access, or ask a Duelists Unite moderator to grant it." },
  { id: "profile-not-found", code: 404, image: "https://ygopro.online/assets/card-arts/27288416.jpg", eyebrow: ["Error 404 / Profile not found", "Player lookup returned 0 results"], title: "This duelist is not in the database.", text: "The profile was deleted, renamed or never existed. Check the link, or search for the player again from the leaderboard." },
]

export const GENERIC_ERROR = { code: undefined, image: "https://ygopro.online/assets/card-arts/59305593.jpg", eyebrow: ["Error / Generic Error", "Unhandled Exception"], title: "Something broke somewhere.", text: "Somewhere over the Rainbow Bridge might have a solution for this. Until we fix, you are free to try again. And again. And again..." }

export const GO_NEXT = [
  { title: "Home Page", text: "start over", to: "/" },
  { title: "Tournaments", text: "automatic registration", to: "/tournaments" },
  { title: "Deck Builder", text: "most updated database", to: "/deck-builder" },
  { title: "Discord", text: "find community", to: "https://discord.gg/duelistsunite" },
]

export const CARD_ART_URL = (id: string | number) => `https://ygopro.online/assets/card-arts/${id}.jpg`
/** The full card scan (frame, text and all), as opposed to the cropped art above. */
export const CARD_IMAGE_URL = (id: string | number) => `https://ygopro.online/assets/card-images/common/${id}.jpg`
/**
 * The same scan, same-origin and edge-cached (`app/card-image`), at its original 421×614: for the places that
 * show one card large. A `/_next/image` variant nobody has asked for yet costs the server a resize (2–20 s cold
 * in production), and the CDN never caches that path.
 */
export const CARD_SCAN_URL = (id: string | number) => `/card-image/common/${id}.jpg`

export const FOOTER_GROUPS = [
  { title: "Product", links: [
    { item: "Home", to: "/" },
    { item: "Download", to: "/download" },
    { item: "Deck Builder", to: "/deck-builder" },
    { item: "Combo Calculator", to: "https://duelistsunite.org/combo/" },
    { item: "Combo Simulator", to: "/simulator" },
  ] },
  { title: "Compete", links: [
    { item: "Tournaments", to: "/tournaments" },
    { item: "Calendar", to: "/calendar" },
    { item: "Statistics", to: "/statistics" },
    { item: "Public decks", to: "/decks" },
    { item: "Published combos", to: "/simulator/combos" },
  ] },
  { title: "Learn", links: [
    { item: "Wiki", to: "/wiki" },
    { item: "Installation guide", to: "/wiki/omega-install-guide" },
    { item: "Troubleshooting", to: "/wiki/ygo-omega-troubleshooting-guide" },
    { item: "Discord", to: "https://discord.gg/duelistsunite" },
  ] },
  { title: "Legal", links: [
    { item: "Privacy", to: "/privacy" },
    { item: "Terms", to: "/terms" },
  ] },
]

/** When each legal page last changed: the date at its top and its sitemap `lastModified`. */
export const LEGAL_UPDATED = { privacy: "2026-10-22", terms: "2026-10-22" }

export const FOOTER_DISCLAIMER = "Duelists Unite. A fan project, unaffiliated with Konami."
export const FOOTER_MEDIA_NOTE =
  "Album covers, artwork and songs belong to their artists and labels. We show them under fair use and claim no rights to them."

/** Launcher download page, the target of every download call to action. */
export const DOWNLOAD_URL = "/download"

export const RELEASES_URL = "https://github.com/duelists-unite/omega-releases/releases/download/Latest/"

export const DOWNLOAD_BUILDS = [
  { name: "Windows", kind: "EXE", file: "Omega_Installer-Windows.exe" },
  { name: "Linux", kind: "ZIP", file: "linux-x64.zip" },
  { name: "Mac", kind: "DMG", file: "Omega_Launcher-Mac.dmg" },
  { name: "Android", kind: "APK", file: "android.apk" },
  { name: "iOS", kind: "IPA", file: "ios.ipa" },
]

/** Browser deck builder and its companion tools, hosted on the tournament site. */
export const DECK_BUILDER_URL = "/deck-builder"

export const HOME_META_DECKS = [
  { id: 13332685, name: "Mitsurugi", style: "Ritual control" },
  { id: 14442329, name: "Kewl Tune", style: "Synchro combo" },
  { id: 19652159, name: "Light and Darkness Ritual", style: "Negate lock" },
  { id: 26077387, name: "Sky Striker", style: "Spell grind" },
  { id: 68468459, name: "Branded", style: "Fusion midrange" },
  { id: 68231287, name: "Power Patron", style: "Toolbox swarm" },
  { id: 60946049, name: "Artmage", style: "Pendulum tempo" },
  { id: 85976588, name: "Elfnote", style: "Link engine" },
]
