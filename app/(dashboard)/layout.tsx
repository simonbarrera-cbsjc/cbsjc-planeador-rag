import { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  LayoutDashboard,
  UploadCloud,
  FileEdit,
  History,
  LogOut,
  Sparkles,
  BookOpen,
  GraduationCap,
} from 'lucide-react'
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8F9FB]">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0E1B4D] text-white flex flex-col border-r border-[#0A1435] shrink-0">
        {/* Institutional Branding Header */}
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0 drop-shadow">
            <Image
              src="/logo.png"
              alt="Logo CBSJC"
              fill
              priority
              className="object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-serif text-slate-300 block tracking-wide">
              Colegio bilingüe
            </span>
            <h2 className="text-xs font-black uppercase tracking-wider text-white truncate">
              <span className="text-[#D71921]">San José</span> Campestre
            </h2>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-[#D71921]" />
            <span>Panel Principal</span>
          </Link>

          <Link
            href="/upload"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <UploadCloud className="h-4 w-4 text-sky-400" />
            <span>Documentos Rectores</span>
          </Link>

          <Link
            href="/generate"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D71921] hover:bg-[#B81219] transition-colors shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-white" />
            <span>Generar Documento</span>
          </Link>

          <Link
            href="/history"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <History className="h-4 w-4 text-emerald-400" />
            <span>Historial de Docs</span>
          </Link>
        </nav>

        {/* Quick Info Box */}
        <div className="p-3.5 mx-3 mb-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-white">
            <GraduationCap className="h-4 w-4 text-[#D71921]" />
            <span>RAG Curricular Activo</span>
          </div>
          <p className="text-slate-400 leading-tight">
            Consultando en tiempo real los DBA, lineamientos y planes de área del CBSJC.
          </p>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName}
                className="w-8 h-8 rounded-full border border-white/20 object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#D71921] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 truncate">{userEmail}</p>
            </div>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              title="Cerrar sesión"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
