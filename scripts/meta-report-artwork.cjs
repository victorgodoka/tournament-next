/** Rebuild the November 6 artwork with the supplied knight and the cleaned Medius illustration. */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const dir = path.join(process.cwd(), 'public/wiki-images/meta-report')
const knight = path.join(dir, '2026-11-06-angelechy-source.png')
const patron = path.join(dir, '2026-11-06-power-patron-source.png')
const cleanedPatron = path.join(dir, '2026-11-06-medius-clean.png')
const svg = (width, height, contents) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${contents}</svg>`)
const mono = (x, y, value, size, color = '#b9c7d8', anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="Consolas,monospace" font-size="${size}" letter-spacing="2">${value}</text>`
const logo = (side) => sharp('public/omega-mark.png').resize(side, side).png().toBuffer()

const crop = async (file, size, left, top, width, height, polygon) => {
  let image = sharp(file).resize(size, size).extract({ left, top, width, height })
  if (polygon) image = image.composite([{ input: svg(width, height, `<polygon points="${polygon}" fill="white"/>`), blend: 'dest-in' }])
  return image.png().toBuffer()
}

async function main() {
  if (process.argv[2] && process.argv[3]) {
    fs.copyFileSync(process.argv[2], knight)
    fs.copyFileSync(process.argv[3], patron)
  }
  const patronArt = fs.existsSync(cleanedPatron) ? cleanedPatron : patron
  const coverOverlay = svg(1920, 420, `
    <defs><linearGradient id="fade"><stop offset="0" stop-color="#080d18"/><stop offset=".37" stop-color="#080d18"/><stop offset=".49" stop-color="#080d18" stop-opacity="0"/></linearGradient></defs>
    <rect width="1920" height="420" fill="url(#fade)"/>
    ${mono(370, 303, 'YGO OMEGA', 44, '#d8e8f2', 'middle')}
    <rect y="416" width="1920" height="4" fill="#00bed0"/>
  `)
  await sharp({ create: { width: 1920, height: 420, channels: 4, background: '#080d18' } }).composite([
    { input: await crop(patronArt, 720, 0, 180, 720, 420), left: 740, top: 0 },
    { input: await crop(knight, 720, 100, 0, 620, 420, '120,0 620,0 620,420 0,420'), left: 1300, top: 0 },
    { input: coverOverlay }, { input: await logo(148), left: 296, top: 100 },
  ]).png().toFile(path.join(dir, '2026-11-06-cover.png'))

  const previewOverlay = svg(1200, 630, `
    <defs><linearGradient id="fade"><stop offset="0" stop-color="#080d18"/><stop offset=".38" stop-color="#080d18"/><stop offset=".49" stop-color="#080d18" stop-opacity="0"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#fade)"/>
    ${mono(113, 75, 'YGO OMEGA', 21, '#d8e8f2')}
    <rect y="626" width="1200" height="4" fill="#00bed0"/>
  `)
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#080d18' } }).composite([
    { input: await crop(patronArt, 630, 78, 0, 390, 630), left: 470, top: 0 },
    { input: await crop(knight, 630, 250, 0, 360, 630, '66,0 360,0 360,630 0,630'), left: 840, top: 0 },
    { input: previewOverlay }, { input: await logo(46), left: 48, top: 42 },
  ]).png().toFile(path.join(dir, '2026-11-06-preview.png'))
  for (const name of ['2026-11-06-cover.png', '2026-11-06-preview.png']) {
    const meta = await sharp(path.join(dir, name)).metadata()
    console.log(`${name}: ${meta.width} × ${meta.height}`)
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
