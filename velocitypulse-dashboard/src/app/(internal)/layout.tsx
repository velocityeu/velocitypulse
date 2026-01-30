import { InternalNav } from '@/components/internal/InternalNav'
import { InternalHeader } from '@/components/internal/InternalHeader'

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <InternalHeader />
      <div className="flex">
        <InternalNav />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
