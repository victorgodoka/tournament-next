import type { IconName } from '@ui/icon'

export type ShareLink = { id: 'x' | 'facebook' | 'reddit' | 'whatsapp'; label: string; href: string; icon: IconName }

/** Plain intent URLs: no share SDK, no script, nothing loads until the reader clicks. */
export const shareLinks = (url: string, title: string): ShareLink[] => {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return [
    { id: 'x', label: 'X', href: `https://x.com/intent/post?url=${u}&text=${t}`, icon: 'twitter' },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: 'facebook' },
    { id: 'reddit', label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${t}`, icon: 'reddit' },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}`, icon: 'whatsapp' },
  ]
}
