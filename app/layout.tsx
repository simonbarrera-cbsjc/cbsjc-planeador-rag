import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ScrollToTop } from '@/components/scroll-to-top'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Planeador RAG — Colegio Bilingüe San José Campestre',
  description:
    'Sistema institucional de generación y planeación curricular con RAG e Inteligencia Artificial para el Colegio Bilingüe San José Campestre.',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans antialiased selection:bg-[#D71921] selection:text-white">
        <ScrollToTop />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
