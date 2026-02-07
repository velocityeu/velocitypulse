interface FooterProps {
  displayName?: string
}

export function Footer({ displayName }: FooterProps) {
  const currentYear = new Date().getFullYear()
  const name = displayName || 'VelocityPulse'

  return (
    <footer className="mt-auto border-t bg-background py-4">
      <div className="container flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          {name} - Real-time IT Infrastructure Monitoring
        </p>
        <p className="text-sm text-muted-foreground">
          {currentYear} Velocity EU Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
