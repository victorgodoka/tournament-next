/** Saves `blob` as `name` through a click on a throwaway link. Revoked on the next tick: some browsers drop a download whose URL dies inside the click. */
export const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
