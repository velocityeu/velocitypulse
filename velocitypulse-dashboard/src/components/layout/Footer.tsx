export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t bg-background py-4">
      <div className="container flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          VelocityPulse - Real-time IT Infrastructure Monitoring
        </p>
        <p className="text-sm text-muted-foreground">
          {currentYear} Velocity EU Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
