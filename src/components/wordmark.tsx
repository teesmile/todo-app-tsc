import Image from 'next/image'
import Link from 'next/link'

/**
 * "Todo App" with its icon, linking home. The name is exactly the OAuth
 * consent screen's app name: Google's brand verification checks that the
 * home page shows it, in the HTML the server sends.
 */
export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-lg font-bold tracking-tight text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
      <Image src="/icons/icon-192.png" alt="" width={28} height={28} priority className="h-7 w-7 shrink-0" />
      <span>Todo App</span>
    </Link>
  )
}
