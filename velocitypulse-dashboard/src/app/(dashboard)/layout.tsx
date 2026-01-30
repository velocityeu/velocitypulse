'use client'

import { OrganizationProvider } from '@/lib/contexts/OrganizationContext'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OrganizationProvider>
      <DashboardShell>{children}</DashboardShell>
    </OrganizationProvider>
  )
}
