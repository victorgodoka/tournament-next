export const FORMATS_SUPPORTED = [
  { title: "TCG", text: "Current Konami wording, resolved the way official tournaments call it." },
  { title: "OCG", text: "Japan's rulings, scripted separately whenever they diverge from the English text." },
  { title: "GOAT", text: "2005 Master Rules, pre-errata cards, the format's original power level intact." },
  { title: "EDISON", text: "2010 format on old rules and old text; Six Samurai and Blackwings as they broke the game." },
  { title: "SPEED DUEL", text: "4-card hands, 20 Life Points, a Skill Card in play; its own rulebook, its own scripts." },
  { title: "DUEL LINKS", text: "Konami's mobile ruleset: 3 Main Monster Zones, no Link Zones, EX cap enforced." },
  { title: "MASTER DUEL", text: "Konami's current digital ruleset, matched card for card, restriction for restriction." },
  { title: "RUSH DUEL", text: "One Normal Summon suspended, a hand no one plays face-down; a different game, scripted true to it." },
  { title: "TRADITIONAL", text: "No Forbidden list. Every banned card back on the field, full strength." },
  { title: "CUSTOM BANLISTS", text: "Write your own list, ban or limit anything, and Omega enforces it card for card." },
  { title: "HISTORICAL BANLISTS", text: "Any list from any month since the game began; pick the date, duel that era." },
  { title: "ANIME CARDS", text: "Effects straight off the screen, never printed, scripted the way the show played them." }
]

export const HOME_FAQ_ALTERNATIVE = [
  {
    title: "Best of 1 decides the match",
    text: "One game, no side decking. The die roll settles matches that a Bo3 would settle with play. Omega runs Bo3 with side decks in ranked and in tournaments."
  },
  {
    title: "Six-minute first turns",
    text: "You watch a combo resolve for six minutes and never get a window to respond. Custom banlists let you build a format where turn one ends."
  },
  {
    title: "The deck costs money to test",
    text: "Crafting a tier-one build takes high-rarity copies, and the grind prices every idea you want to try. Every card in Omega is already yours."
  },
]

export const HOME_AUTO_TOURNAMENT_FAQ = [
  {
    title: "Automatic deck check",
    text: "Every list is validated against the format's legal pool before round one.",
  },

  {
    title: "Automatic pairing",
    text: "Swiss rounds pair on record. Your next opponent appears when the round opens.",
  },

  {
    title: "Automatic scoring",
    text: "The engine reports the game, so nobody submits a slip or disputes a result.",
  },

  {
    title: "Meta charts from real results",
    text: "Representation and win rates come out of the finished bracket, not a survey.",
  },
]

export const HOME_DOUBLE_SCRIPT_DISPLAY = [
  {
    id: 39000945,
    name: "Reflection of Endymion",
    isPreErrata: false,
    effects: [
      {
        title: "Both returns or neither",
        description: "The card uses \"and,\" so both returns are one package: if either target is gone at resolution, neither card comes back and no counters get placed."
      },
      {
        title: "Each return stands alone",
        description: "The official ruling splits the two returns apart, so a missing target only costs you that one card; the other still comes back with its counters."
      }
    ]
  },
  {
    id: 26202165,
    name: "Sangan",
    isPreErrata: true,
    effects: [
      {
        title: "Free search, no limits",
        description: "The original text just adds the monster. No once-per-turn clause, no lock on the card you grab. They pay for itself every time it dies."
      },
      {
        title: "One search, one lockout",
        description: "The current text caps the effect at once per turn and bans that monster's name for the rest of the turn, so the free search now comes with a leash."
      }
    ]
  },
]

/**
 * Kill switch for every analytics surface, admins included. Off: next.config.ts redirects the
 * analytics routes to `/` before anything renders, links and match panels are hidden, and the
 * landing skips its top-decks fetch. Flip back to `true` to restore it all.
 */
export const ANALYTICS_ENABLED = true

/** Same kind of switch for the shop and the battlepass: routes redirected, links hidden. Inventory and cosmetics stay. */
export const SHOP_ENABLED = false
export const BATTLEPASS_ENABLED = false

export type NavbarItem = {
  item: string
  /** A plain link. Mutually exclusive with `children`. */
  to?: string
  loggedIn?: boolean
  /** Turns the entry into a dropdown; the parent stops being a link. */
  children?: { item: string; to: string }[]
}

const BASE_NAVBAR_ITEMS: NavbarItem[] = [
  { item: "Home", to: "/welcome" },
  {
    item: "Tournaments",
    children: [
      { item: "Live", to: "/tournaments" },
      { item: "Calendar", to: "/calendar" },
      { item: "Past tournaments", to: "https://tournament.duelistsunite.org/" },
    ],
  },
  { item: "Leaderboard", to: "/leaderboard" },
  ...(ANALYTICS_ENABLED ? [{ item: "Analytics", to: "/analytics", loggedIn: true }] : []),
  { item: "Wiki", to: "/wiki" },
  ...(ANALYTICS_ENABLED ? [{ item: "Statistics", to: "/statistics" }] : []),
  ...(SHOP_ENABLED ? [{ item: "Shop", to: "/shop", loggedIn: true }] : []),
  ...(BATTLEPASS_ENABLED ? [{ item: "Battlepass", to: "/battlepass", loggedIn: true }] : []),
  {
    item: "Tools",
    children: [
      { item: "Deck builder", to: "/deck-editor" },
      { item: "Hypergeometric calculator", to: "/tools/hypergeometric" },
    ],
  },
]

export const HOME_NAVBAR_ITEMS: NavbarItem[] = [
  {
    item: "About Omega", children: [
      { item: "Our Simulator", to: '#top' },
      { item: "Why Omega?", to: '#alternative' },
      { item: "Our Tournaments", to: '#tournaments' },
      { item: "Different Rullings", to: '#rullings' },
      { item: "Formats", to: '#formats' },
      { item: "Ranked", to: '#meta' },
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
  { title: "Deck Editor", text: "most updated database", to: "/deck-editor" },
  { title: "Discord", text: "find community", to: "https://discord.gg/duelistsunite" },
]

export const CARD_ART_URL = (id: string | number) => `https://ygopro.online/assets/card-arts/${id}.jpg`
/** The full card scan (frame, text and all), as opposed to the cropped art above. */
export const CARD_IMAGE_URL = (id: string | number) => `https://ygopro.online/assets/card-images/common/${id}.jpg`

export const FOOTER_LINKS = [
  { item: "Home", to: "https://omega.duelistsunite.org/" },
  { item: "Discord", to: "https://discord.gg/duelistsunite" },
  { item: "Deck Builder", to: "/deck-editor" },
]

export const FOOTER_DISCLAIMER = "Duelists Unite. A fan project, unaffiliated with Konami."
export const FOOTER_MEDIA_NOTE =
  "Album covers, artwork and songs belong to their artists and labels. We show them under fair use and claim no rights to them. Shop items cost points earned by playing, never real money."

/** Launcher download page, the target of every download call to action. */
export const DOWNLOAD_URL = "https://omega.duelistsunite.org/"

/** Browser deck builder and its companion tools, hosted on the tournament site. */
export const DECK_BUILDER_URL = "https://tournament.duelistsunite.org/#/builder"

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

export const HOME_TOOLS = [
  { title: "Deck Builder", text: "Visual builder with live filters, format legality and shareable lists." },
  { title: "Banlist Builder", text: "Write your own list card by card, or ban an entire card type in one click." },
  { title: "Small World Resolver", text: "Feed it your deck and it maps every legal bridge, so you stop drawing the chart by hand." },
]

export const HOME_MODES = [
  { title: "Automatic", text: "The engine tracks life points, chains, timing windows and priority. You choose plays, the core resolves them to the ruling of your chosen format." },
  { title: "Manual", text: "One Move button replaces ten stacked ones. Chat commands like /help stay out of your way. Custom cards and custom banlists work here too." },
]

export const HOME_FAQ = [
  { question: "Is Omega free?", answer: "Yes. Every card is unlocked, ranked play is open and tournaments cost nothing. No currency, no crafting, no packs." },
  { question: "Does it run in a browser?", answer: "No. Omega runs through a launcher on Windows, macOS, Linux and Android. The install takes under two minutes." },
  { question: "Which rulings does it follow, TCG or OCG?", answer: "Both. Omega runs the official Fluorohydride core with fixes to damage calculation and TCG rulings, and scripts a card twice when the two texts disagree." },
  { question: "Can I play manually?", answer: "Yes, in the same client, with chat commands, custom cards and custom banlists." },
  { question: "Is there an offline AI opponent?", answer: "Not yet. Offline AI depends on donations, and it has no release date. Duels run against people." },
  { question: "How fast do new cards get scripted?", answer: "Between three hours and a week, depending on who is free to write the script." },
]
