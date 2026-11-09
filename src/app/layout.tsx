import type { Metadata, Viewport } from 'next'
import { Google_Sans, Inter } from 'next/font/google'
import { MovedBanner } from '@/components/movedBanner'
import { SITE_URL } from '@/config/site'
import '../styles/globals.css'

const inter = Inter({ subsets: ['latin'] })
// Only for the "Continue with Google" button, as Google's branding guidelines
// require. Bundled at build time (no request to Google), and not preloaded:
// a guest downloads it only when the sign-in dialog draws the button.
const googleSans = Google_Sans({ weight: '500', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-google-sans' })

export const metadata: Metadata = {
  // Every page names its canonical URL on the real address, so the old
  // address (still serving the app) counts as a copy for search engines.
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  title: 'Todo App',
  description: 'A local-first task list that keeps your tasks on your device.',
}

export const viewport: Viewport = {
  themeColor: '#f9fafb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={googleSans.variable}>
      <body className={inter.className}>
        <MovedBanner />
        {children}
      </body>
    </html>
  )
}
