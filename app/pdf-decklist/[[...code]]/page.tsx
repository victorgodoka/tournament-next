import type { Metadata } from 'next'
import { noIndexMetadata } from '@lib/page-metadata'
import PdfDecklistClient from '../pdf-decklist.client'

export const metadata: Metadata = noIndexMetadata(
  'PDF Decklist',
  '/pdf-decklist',
  'Fill in your player and event info and generate an official, print-ready Yu-Gi-Oh! decklist PDF.',
)

interface PdfDecklistPageProps {
  params: Promise<{ code?: string[] }>
}

export default async function PdfDecklistPage({ params }: PdfDecklistPageProps) {
  const { code } = await params
  return <PdfDecklistClient initialCode={code?.[0]} />
}
