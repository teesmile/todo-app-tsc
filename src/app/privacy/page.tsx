import type { Metadata } from 'next'
import { LegalPage } from '@/components/legalPage'

export const metadata: Metadata = {
  title: 'Privacy · Todo App',
  description: 'What Todo App keeps on your device, what it stores when you sign in, and how to delete it.',
}

const CONTACT_EMAIL = 'anthonyugwujac@gmail.com'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="9 November 2026">
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
        your email address, your name and profile picture link from Google, your Google account ID, when you
        signed in, and the name you choose for the greeting if you set one (so all your devices use it). Supabase also keeps standard security logs of sign-ins, such as the time, IP address and
        browser.
      </p>
      <p>
        While you&apos;re signed in, your tasks and labels (the same details listed above, and when each was
        deleted) are synced with your account and stored with it in London, so they reach your other devices.
        Deleted tasks are kept there as a marker, so a delete can&apos;t be undone by an older copy on another
        device. Only your account can read them: the database refuses every other account&apos;s request.
      </p>
      <p>
        Tasks you made before signing in stay on the device unless you choose to add them to your account. When
        you sign out, your account&apos;s tasks are removed from that device; changes that haven&apos;t synced yet
        stay on it, hidden, until you sign in again.
      </p>
      <p>
        The session that keeps you signed in, and your account&apos;s ID, name and email address (so the app
        still knows who you are when you open it offline), are saved in your browser&apos;s local storage. The
        app sets no cookies.
      </p>

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
          stores accounts, with their synced tasks and labels, in London.
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
          every task and label stored with it are deleted from the database straight away, and from the device
          you&apos;re using. Supabase may keep them in routine backups for a short time until those expire. On another
          device that was signed in, the copies stay on that device until you clear this site&apos;s data there.
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
        You can ask what&apos;s held about you, or ask for it to be corrected or deleted, by emailing
        {' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        . If this page changes, the date at the top changes with it.
      </p>
    </LegalPage>
  )
}
