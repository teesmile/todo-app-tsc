import type { Metadata } from 'next'
import { LegalPage } from '@/components/legalPage'

export const metadata: Metadata = {
  title: 'Privacy · Todo App',
  description: 'What Todo App keeps on your device, what it stores when you sign in, and how to delete it.',
}

const REPO_ISSUES = 'https://github.com/teesmile/todo-app-tsc/issues'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="7 November 2026">
      <p>
        Todo App is a task list made and run by Anthony Ugwuja. This page says, in plain words, what it keeps,
        where, and how to get rid of it. The short version: your tasks live on your device, an account is
        optional, and nothing is ever sold.
      </p>

      <h2>On your device</h2>
      <p>Without an account, everything stays in your browser&apos;s own storage (IndexedDB) on this device:</p>
      <ul>
        <li>your tasks: the title, due date, whether it&apos;s done or Vital, its labels, and when it was added, changed and completed;</li>
        <li>your labels: their names and colours;</li>
        <li>the first name you gave for the greeting, if you gave one;</li>
        <li>a random ID for this browser, used only on the device.</li>
      </ul>
      <p>
        A task you delete is kept for up to a day so Undo can bring it back, then it&apos;s removed. None of this
        leaves your device, and I can&apos;t see it.
      </p>

      <h2>When you sign in</h2>
      <p>
        Accounts are run on Supabase, in its London (UK) data centre. Signing in stores your account there:
        your email address, your name and profile picture link from Google, your Google account ID, and when you
        signed in. Supabase also keeps standard security logs of sign-ins, such as the time, IP address and
        browser.
      </p>
      <p>
        <strong>Today, signing in doesn&apos;t copy your tasks anywhere.</strong>
        {' '}
        Task sync is being built. When it&apos;s switched on, your tasks and labels (the same details listed above)
        will be stored with your account in London, so they reach your other devices. Only your account can read
        them: the database refuses every other account&apos;s request. This page will be updated before that happens.
      </p>
      <p>The session that keeps you signed in is saved in your browser&apos;s local storage. The app sets no cookies.</p>

      <h2>What Google sign-in shares</h2>
      <p>
        When you choose &ldquo;Continue with Google&rdquo;, Google shares your name, email address and profile
        picture with this app, and nothing else. The app never sees your Google password, and it has no access to
        your Gmail, contacts, Drive or any other Google data.
      </p>

      <h2>Who else is involved</h2>
      <ul>
        <li>
          <strong>Supabase</strong>
          {' '}
          stores accounts (and, later, synced tasks) in London.
        </li>
        <li>
          <strong>Google</strong>
          {' '}
          handles the sign-in itself.
        </li>
        <li>
          <strong>Vercel</strong>
          {' '}
          serves the app&apos;s files. Like any web host, it handles basic request details such as your IP address to deliver pages and block abuse.
        </li>
      </ul>

      <h2>What never happens</h2>
      <p>
        Your data is never sold, rented or shared for advertising. There are no ads, no analytics and no tracking.
      </p>

      <h2>Deleting your data</h2>
      <ul>
        <li>
          <strong>Your account:</strong>
          {' '}
          sign in, open your account (top right), choose &ldquo;Delete account&rdquo; and confirm. Your account and
          everything stored with it are deleted from the database straight away. Supabase may keep them in routine
          backups for a short time until those expire.
        </li>
        <li>
          <strong>Tasks on a device:</strong>
          {' '}
          delete them in the app, or clear this site&apos;s data in your browser&apos;s settings, which removes
          everything the app stored on that device.
        </li>
      </ul>

      <h2>Questions</h2>
      <p>
        You can ask what&apos;s held about you, or ask for it to be corrected or deleted, by opening an issue on
        {' '}
        <a href={REPO_ISSUES}>the app&apos;s GitHub page</a>
        . If this page changes, the date at the top changes with it.
      </p>
    </LegalPage>
  )
}
