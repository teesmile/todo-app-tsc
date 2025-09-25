export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <nav>Auth Navigation</nav>
      {children}
    </div>
  )
}
