import './globals.css'
import { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { mondwest } from '@/lib/fonts'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'eriks.design',
  description: 'Coming soon',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${mondwest.variable} ${inter.className}`}>
      <body>{children}</body>
    </html>
  )
} 