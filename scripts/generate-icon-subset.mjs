#!/usr/bin/env node
// Scans source files for "mdi:icon-name" literals and writes a trimmed
// IconifyJSON subset (assets/icons/mdi-subset.generated.json) containing only
// those icons, so the app can register them offline via addCollection()
// instead of resolving each one against the Iconify API at runtime.
//
// Run after adding/removing an mdi: icon anywhere in the source:
//   node scripts/generate-icon-subset.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')

const files = execSync('git ls-files "*.ts" "*.tsx"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const names = new Set()
const pattern = /mdi:([a-z0-9-]+)/g

for (const rel of files) {
  const text = readFileSync(`${ROOT}/${rel}`, 'utf8')
  for (const match of text.matchAll(pattern)) {
    names.add(match[1])
  }
}

const { icons, aliases, width, height } = JSON.parse(
  readFileSync(`${ROOT}/node_modules/@iconify-json/mdi/icons.json`, 'utf8'),
)

const subsetIcons = {}
const subsetAliases = {}
const missing = []

for (const name of names) {
  if (icons[name]) {
    subsetIcons[name] = icons[name]
  } else if (aliases[name]) {
    subsetAliases[name] = aliases[name]
    const parent = aliases[name].parent
    if (icons[parent]) subsetIcons[parent] = icons[parent]
  } else {
    missing.push(name)
  }
}

if (missing.length > 0) {
  console.error(`Unknown mdi icon name(s), not found in @iconify-json/mdi: ${missing.join(', ')}`)
  process.exitCode = 1
}

const subset = {
  prefix: 'mdi',
  width,
  height,
  icons: subsetIcons,
  ...(Object.keys(subsetAliases).length > 0 ? { aliases: subsetAliases } : {}),
}

const outPath = `${ROOT}/assets/icons/mdi-subset.generated.json`
writeFileSync(outPath, JSON.stringify(subset))
console.log(`Wrote ${Object.keys(subsetIcons).length} icons + ${Object.keys(subsetAliases).length} aliases (${names.size} names used) to ${outPath}`)
