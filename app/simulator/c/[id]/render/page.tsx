import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@utils/metadata'
import { RenderLoader } from './render.loader'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ speed?: string | string[] }> }

// The page the video renderer screenshots: never indexed.
export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getTranslations('Simulator')])
  return pageMetadata({ title: t('title'), path: `/simulator/c/${encodeURIComponent(id)}/render`, noIndex: true })
}

// Nothing but the frame, filling the viewport: no header, and the shape is the viewport's (`?shape` is the renderer's).
const ComboRenderPage = async ({ params, searchParams }: Props) => {
  const [{ id }, { speed }] = await Promise.all([params, searchParams])
  return (
    <main className="h-dvh w-dvw overflow-hidden bg-space-000">
      <RenderLoader id={id} speed={speed} />
    </main>
  )
}

export default ComboRenderPage
