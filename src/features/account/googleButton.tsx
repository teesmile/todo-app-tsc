import Image from 'next/image'

/**
 * Google's sign-in button, built to its branding guidelines (styles in
 * globals.css, `.gsi-button`): the official G from Google's asset bundle
 * (public/google-g.svg, unaltered), "Continue with Google" in Google Sans
 * Medium, light or dark with the system theme. A real <button>; the logo is
 * decorative, so the accessible name is the text.
 */
export function GoogleSignInButton({ onClick, disabled = false, busy = false }: { onClick: () => void, disabled?: boolean, busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="gsi-button w-full">
      <span className="gsi-button-state" aria-hidden="true" />
      <Image src="/google-g.svg" alt="" width={20} height={20} unoptimized className="gsi-button-icon relative" />
      <span className="gsi-button-text">{busy ? 'Opening Google…' : 'Continue with Google'}</span>
    </button>
  )
}
