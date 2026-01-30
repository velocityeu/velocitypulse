import { redirect } from 'next/navigation'

// Monitor page now redirects to dashboard which has all monitoring functionality
export default function MonitorPage() {
  redirect('/dashboard')
}
