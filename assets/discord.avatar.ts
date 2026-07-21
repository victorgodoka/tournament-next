export const discordAvatar = (id: string, avatar: string) => {
  if (!avatar) return ""
  // Some stored avatar URLs were saved with a literal "undefined" user id
  // (an old upstream bug) — patch the correct id back in.
  const patched = avatar.replace("/avatars/undefined/", `/avatars/${id}/`)
  if (patched.startsWith('http')) return patched;
  const type = patched.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${id}/${patched}.${type}`
}
