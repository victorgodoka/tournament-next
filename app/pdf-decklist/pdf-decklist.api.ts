export interface PdfDecklistParams {
  deck: string
  name: string
  lastName: string
  cardGameID: string
  month: string
  day: string
  year: string
  country: string
  event: string
}

/** Fetches the official, print-ready decklist PDF for a deck code + player/
 * event info. The PDF itself is generated server-side by the Omega API. */
export async function generateDecklistPdf(params: PdfDecklistParams): Promise<Blob> {
  const query = new URLSearchParams(params as unknown as Record<string, string>).toString()
  const response = await fetch(`/api/pdf?${query}`)

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Failed to generate PDF.'
    throw new Error(message)
  }

  return response.blob()
}
