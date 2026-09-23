import { CARD_ART_URL } from '@utils/const'
import type { WikiAsset, WikiDoc } from '@utils/wiki-doc'

const art = (id: number, alt: string, focal?: WikiAsset['focal']): WikiAsset => ({
  id: `card-${id}`,
  src: CARD_ART_URL(id),
  width: 624,
  height: 624,
  alt,
  credit: 'Artwork © Konami',
  focal,
})

const assets: WikiAsset[] = [
  art(26077387, 'Sky Striker Ace - Raye mid-flight, red scarf trailing', { x: 50, y: 30 }),
  art(63288573, 'Sky Striker Ace - Kagari in crimson armor'),
  art(90673288, 'Sky Striker Ace - Shizuku in blue armor'),
  art(8491308, 'Sky Striker Ace - Hayate diving with twin blades'),
  art(12421694, 'Sky Striker Ace - Roze in a burst of light'),
  art(63166095, 'Sky Striker Mobilize - Engage! — Raye launching', { x: 50, y: 40 }),
  art(98338152, 'Sky Striker Mecha - Widow Anchor firing its hook'),
  art(24010609, 'Sky Striker Mecha Modules - Multirole'),
  art(99550630, 'Sky Striker Maneuver - Afterburners! strafing run'),
  { id: 'hero', src: '/omega-hero.png', width: 1920, height: 1080, alt: 'Omega client lobby', credit: 'Omega' },
  { id: 'cover', src: '/profile-cover.jpg', width: 1920, height: 1080, alt: 'Duel field, dimmed', credit: 'Omega' },
  { id: 'screen', src: '/SCREEN_1.png', width: 1920, height: 1080, alt: 'Duel in progress on the Omega client', credit: 'Omega' },
  { id: 'banner-tcg', src: '/banners/tournaments/tcg-1.png', width: 1600, height: 400, alt: 'TCG tournament banner' },
  { id: 'banner-genesys', src: '/banners/tournaments/genesys-1.png', width: 1600, height: 400, alt: 'Genesys tournament banner' },
]

/**
 * A complete article in the stored shape. Everything the page shows comes from here:
 * swap this object for an API response and the page renders identically.
 */
export const EXAMPLE_DOC: WikiDoc = {
  v: 1,
  title: 'Sky Striker',
  summary:
    'A one-monster control deck: Raye holds the field alone while a hand of Spells does the fighting, and every Spell in the graveyard makes the Links stronger.',
  cover: { asset: 'card-63166095' },
  infobox: {
    asset: 'card-26077387',
    caption: 'Sky Striker Ace - Raye, the only Main Deck monster the deck needs.',
    facts: [
      { label: 'Type', value: 'Archetype' },
      { label: 'Engine', value: 'Spell-based control' },
      { label: 'Debut', value: 'Dark Neostorm (2019)' },
      { label: 'Key monster', value: 'Raye' },
      { label: 'Extra Deck', value: 'Links 1–2' },
      { label: 'Formats', value: 'TCG · Genesys' },
    ],
  },
  tags: ['archetype', 'control', 'spells', 'link'],
  blocks: [
    {
      id: 'b1',
      type: 'text',
      md: '**Sky Striker** is an archetype built around a single Main Deck monster, **Sky Striker Ace - Raye**, and a large suite of Quick-Play and Normal Spells. Raye tags out into one of several Link monsters, and each Spell the player resolves feeds a graveyard count that powers them up.',
    },
    { id: 'b2', type: 'heading', level: 2, text: 'History', anchor: 'history' },
    { id: 'b3', type: 'figure', asset: 'card-63166095', align: 'right', caption: 'Engage! — the card that turns every turn into a draw.' },
    {
      id: 'b4',
      type: 'text',
      md: 'The deck arrived in *Dark Neostorm* with its whole core in one set: Raye, the four Aces, Engage! and the Mecha Spells. Later support smoothed the draws and gave the Links more targets, and the deck became a regular sight in Top 8s.\n\nIts appeal was never raw power. It was the ability to answer almost anything with a card from hand, without ever committing a board that a single removal spell could wipe.\n\nMost of its format-defining moments came in best-of-three: a Sky Striker player who wins the die roll can go second and still dictate the pace of the game.',
    },
    { id: 'b5', type: 'heading', level: 2, text: 'Playstyle', anchor: 'playstyle' },
    { id: 'b6', type: 'figure', asset: 'card-98338152', align: 'left', caption: 'Widow Anchor negates an effect monster, and can take it over.' },
    {
      id: 'b7',
      type: 'text',
      md: 'The game plan is simple to state and hard to execute:\n\n1. Keep the Main Monster Zone empty so Spells can be activated.\n2. Summon Raye, and tribute it for a Link that fits the threat.\n3. Answer each opposing play with the right Spell, one at a time.\n\nBecause most effects require **no monsters in the Main Monster Zones**, every summon has a cost. A good Sky Striker player counts not just cards, but *tempo*.',
    },
    {
      id: 'b8',
      type: 'callout',
      tone: 'gold',
      title: 'Rule to remember',
      md: 'Link monsters sit in the **Extra** Monster Zone, so they do not stop your Spells. A Raye in the **Main** Monster Zone does.',
    },
    { id: 'b9', type: 'heading', level: 3, text: 'Matchups', anchor: 'matchups' },
    {
      id: 'b10',
      type: 'text',
      md: '| Opponent | Plan | Favored |\n| --- | --- | --- |\n| Combo | Interrupt early with Widow Anchor | Even |\n| Control | Out-grind with Engage! | Yes |\n| Floodgates | Side in Spell removal | No |',
    },
    { id: 'b11', type: 'heading', level: 2, text: 'Key cards', anchor: 'key-cards' },
    {
      id: 'b12',
      type: 'cards',
      caption: 'Each card links to its own wiki page.',
      cards: [
        { id: 26077387, name: 'Sky Striker Ace - Raye', note: 'Main Deck' },
        { id: 63166095, name: 'Sky Striker Mobilize - Engage!', note: 'Draw engine' },
        { id: 98338152, name: 'Sky Striker Mecha - Widow Anchor', note: 'Interruption' },
        { id: 99550630, name: 'Sky Striker Maneuver - Afterburners!', note: 'Removal' },
        { id: 63288573, name: 'Sky Striker Ace - Kagari', note: 'Link-1' },
        { id: 90673288, name: 'Sky Striker Ace - Shizuku', note: 'Link-1' },
        { id: 8491308, name: 'Sky Striker Ace - Hayate', note: 'Link-1' },
        { id: 12421694, name: 'Sky Striker Ace - Roze', note: 'Link-1' },
      ],
    },
    {
      id: 'b13',
      type: 'quote',
      text: 'You never play a Sky Striker card. You play the card your opponent just did, one turn later.',
      cite: 'Omega community saying',
    },
    { id: 'b13a', type: 'heading', level: 3, text: 'See it played', anchor: 'see-it-played' },
    {
      id: 'b13b',
      type: 'video',
      videoId: 'fzwWvs-6FEs',
      title: 'SKY STRIKER TOPPED A REGIONAL! | Sky Striker Deck Profile',
      caption: 'Deck profile by MattOshea YGO. Nothing loads from YouTube until you press play.',
    },
    { id: 'b14', type: 'heading', level: 2, text: 'Gallery', anchor: 'gallery' },
    {
      id: 'b15',
      type: 'text',
      md: 'The Aces share one pilot and four armors. Select any image to open the viewer; arrow keys move through it.',
    },
    {
      id: 'b16',
      type: 'gallery',
      layout: 'grid',
      assets: ['card-26077387', 'card-63288573', 'card-90673288', 'card-8491308', 'card-12421694', 'card-24010609'],
      caption: 'Grid — uniform crops, respecting each image’s focal point.',
    },
    { id: 'b17', type: 'heading', level: 3, text: 'On Omega', anchor: 'on-omega' },
    {
      id: 'b18',
      type: 'gallery',
      layout: 'masonry',
      assets: ['screen', 'card-99550630', 'banner-tcg', 'hero', 'card-98338152', 'banner-genesys', 'cover'],
      caption: 'Masonry — every image at its own ratio.',
    },
    {
      id: 'b19',
      type: 'gallery',
      layout: 'strip',
      assets: ['hero', 'screen', 'cover'],
      caption: 'Strip — a swipeable row, for screenshots and step-by-step sequences.',
    },
    { id: 'b20', type: 'figure', asset: 'screen', align: 'wide', caption: 'Wide figure — spans the whole column and clears any float above it.' },
    {
      id: 'b21',
      type: 'callout',
      tone: 'negative',
      title: 'Banlist',
      md: 'Several Sky Striker Spells have been limited in the past. Check the card pages for current legality before building.',
    },
    {
      id: 'b22',
      type: 'callout',
      tone: 'cyan',
      title: 'See also',
      md: '[Sky Striker Ace - Raye](/wiki/card/26077387) · [All articles](/wiki)',
    },
  ],
  assets: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
}
