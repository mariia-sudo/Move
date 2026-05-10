import { AppNav } from '@/components/AppNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="md:pl-60 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
