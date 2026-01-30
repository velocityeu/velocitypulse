import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-6">
        {children}
      </main>
      <Footer />
    </div>
  )
}
