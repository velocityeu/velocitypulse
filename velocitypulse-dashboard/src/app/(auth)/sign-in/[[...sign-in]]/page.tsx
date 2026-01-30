import { SignIn } from '@clerk/nextjs'

export const dynamic = 'force-dynamic'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-card border border-border shadow-lg',
            headerTitle: 'text-foreground',
            headerSubtitle: 'text-muted-foreground',
            socialButtonsBlockButton: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            formFieldLabel: 'text-foreground',
            formFieldInput: 'bg-background border-input text-foreground',
            footerActionLink: 'text-primary hover:text-primary/80',
          },
        }}
      />
    </div>
  )
}
