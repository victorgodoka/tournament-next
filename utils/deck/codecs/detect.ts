export type DeckFormat = 'ydke' | 'ydk' | 'omega' | 'text'

export const detectFormat = (text: string): DeckFormat => {
  const trimmed = text.trim()
  if (trimmed.startsWith('ydke://')) return 'ydke'
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim())
  if (lines.some((l) => l.startsWith('#main'))) return 'ydk'
  if (lines.length === 1 && /^[A-Za-z0-9+/=]{12,}$/.test(lines[0]!)) return 'omega'
  return 'text'
}
