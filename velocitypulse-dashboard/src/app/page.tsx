import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { userId } = await auth()

  // Redirect authenticated users to dashboard
  if (userId) {
    redirect('/dashboard')
  }

  // Redirect unauthenticated users to sign in
  redirect('/sign-in')
}
