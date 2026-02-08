'use client'

import { useState } from 'react'
import { InternalNav } from '@/components/internal/InternalNav'
import { InternalHeader } from '@/components/internal/InternalHeader'

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <InternalHeader />
      <div className="flex">
        <InternalNav collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
