import Link from 'next/link'

/**
 * Says what the app is and links the privacy policy and terms. Google's
 * consent-screen review requires both to be reachable from the home page.
 */
export function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`mx-auto max-w-5xl px-4 text-sm text-gray-600 ${className}`}>
      <p>A task list that keeps your tasks on your device. Signing in with Google is optional.</p>
      <nav aria-label="Legal" className="mt-2">
        <ul className="flex flex-wrap gap-x-4">
          <li>
            <Link href="/privacy" className="inline-flex min-h-11 items-center font-medium text-gray-800 underline underline-offset-2 hover:text-orange-800">
              Privacy
            </Link>
          </li>
          <li>
            <Link href="/terms" className="inline-flex min-h-11 items-center font-medium text-gray-800 underline underline-offset-2 hover:text-orange-800">
              Terms
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  )
}
