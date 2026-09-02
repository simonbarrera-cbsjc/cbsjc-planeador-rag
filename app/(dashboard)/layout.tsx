import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import type { Profile } from '@/types'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as Profile | null
  const userName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Docente'
  const userEmail = user.email || ''
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url
  const role = profile?.role || 'docente'

  const userProps = {
    id: user.id,
    name: userName,
    email: userEmail,
    avatarUrl,
    role,
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8F9FB] text-slate-900">
      {/* Desktop Persistent Institutional Sidebar */}
      <Sidebar
        user={userProps}
        className="hidden md:flex md:w-64 lg:w-72 sticky top-0 h-screen"
      />

      {/* Main Column: Header on Mobile + Scrollable Main Content + Institutional Footer */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile & Tablet Header with Navigation Drawer */}
        <Header user={userProps} className="md:hidden" />

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Institutional Footer */}
        <Footer />
      </div>
    </div>
  )
}
