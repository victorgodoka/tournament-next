import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@utils/metadata'
import { RenderLoader } from './render.loader'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ shape?: string | string[]; speed?: string | string[] }> }

// The recording popup the video dialog opens: never indexed.
export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getTranslations('Simulator')])
  return pageMetadata({ title: t('title'), path: `/simulator/c/${encodeURIComponent(id)}/render`, noIndex: true })
}

// Nothing but the frame and what to press over it: no header, sized by the popup.
const ComboRenderPage = async ({ params, searchParams }: Props) => {
  const [{ id }, { shape, speed }] = await Promise.all([params, searchParams])
  return (
    <main className="h-dvh w-dvw overflow-hidden bg-space-000">
      <RenderLoader id={id} shape={shape} speed={speed} />
    </main>
  )
}

export default ComboRenderPage
