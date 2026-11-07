import Link from 'next/link'
import { SiteFooter } from './siteFooter'

/** The shared frame for /privacy and /terms: a way back, the text, the footer. */
export function LegalPage({ title, updated, children }: { title: string, updated: string, children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <Link href="/" className="inline-flex min-h-11 items-center font-medium text-orange-800 underline underline-offset-2">
            ← Back to your tasks
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <article className="legal rounded-2xl border border-gray-200 bg-white p-5 text-gray-800 md:p-8">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Last updated
            {' '}
            {updated}
          </p>
          {children}
        </article>
      </main>
      <SiteFooter className="max-w-3xl pb-8" />
    </div>
  )
}
