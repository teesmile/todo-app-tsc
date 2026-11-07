import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legalPage'

export const metadata: Metadata = {
  title: 'Terms · Todo App',
  description: 'The plain-language terms for using Todo App.',
}

const CONTACT_EMAIL = 'anthonyugwujac@gmail.com'

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="7 November 2026">
      <p>
        Todo App is a free task list made and run by Anthony Ugwuja as a personal project. By using it, you agree
        to these terms. They&apos;re short on purpose.
      </p>

      <h2>Using the app</h2>
      <ul>
        <li>It&apos;s free. You can use it without an account, or sign in with Google.</li>
        <li>You need to be old enough to have a Google account where you live to sign in.</li>
        <li>Your tasks are yours. Using the app gives no one any rights over what you write.</li>
      </ul>

      <h2>Please don&apos;t</h2>
      <ul>
        <li>try to get into other people&apos;s accounts or data;</li>
        <li>attack, overload or probe the service, or use it to store anything illegal.</li>
      </ul>
      <p>An account that does any of these can be closed.</p>

      <h2>No guarantees</h2>
      <p>
        The app is provided as it is, with no warranty. It&apos;s built so it never loses or overwrites what you
        write, but no software is perfect, so keep anything important somewhere else too. As far as the law
        allows, I&apos;m not liable for any loss that comes from using it.
      </p>

      <h2>Changes and ending</h2>
      <ul>
        <li>The app may change, or be shut down. If accounts are going away, signed-in users will be told in the app first wherever possible.</li>
        <li>
          You can stop at any time, and delete your account from the app. The
          {' '}
          <Link href="/privacy">privacy page</Link>
          {' '}
          explains how and what that removes.
        </li>
        <li>If these terms change, the date at the top changes with them.</li>
      </ul>

      <h2>Questions</h2>
      <p>
        Email
        {' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        .
      </p>
    </LegalPage>
  )
}
