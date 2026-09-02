'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sparkles,
  GraduationCap,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  History,
  FolderSync,
  ShieldCheck,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface HeaderUserProps {
  id?: string
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  role?: string | null
}

export interface HeaderProps {
  user?: HeaderUserProps | null
  variant?: 'dashboard' | 'auth' | 'standalone'
  className?: string
  showNavLinks?: boolean
}

export function Header({
  user,
  variant = 'dashboard',
  className = '',
  showNavLinks = true,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const isAuth = variant === 'auth'

  const displayName =
    user?.name ||
    user?.email?.split('@')[0] ||
    (isAuth ? '' : 'Docente CBSJC')
  const displayEmail = user?.email || ''
  const displayAvatar = user?.avatarUrl

  const navLinks = [
    { label: 'Panel', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Generar Planeación', href: '/generate', icon: Sparkles, highlight: true },
    { label: 'Historial', href: '/history', icon: History },
    { label: 'Documentos Rectores', href: '/upload', icon: FolderSync },
  ]

  return (
    <header
      className={`relative z-30 w-full transition-colors ${
        isAuth
          ? 'bg-[#0E1B4D]/90 backdrop-blur-md border-b border-white/10 text-white'
          : 'bg-[#0E1B4D] border-b border-[#0A1435] text-white shadow-md'
      } ${className}`}
    >
      {/* Top Gold & Red Institutional Accent Ribbon */}
      <div className="h-1 w-full bg-gradient-to-r from-[#D71921] via-[#C8A84B] to-[#162874]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* LEFT: Institutional Logo & Typography */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <Link
              href={user ? '/dashboard' : '/login'}
              className="group flex items-center gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A84B] rounded-xl p-1 -m-1"
            >
              {/* Institutional Shield */}
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0 transition-transform group-hover:scale-105 duration-200">
                <div className="absolute inset-0 bg-[#C8A84B]/15 rounded-full blur-md group-hover:bg-[#C8A84B]/30 transition-colors" />
                <Image
                  src="/logo.png"
                  alt="Escudo Oficial Colegio Bilingüe San José Campestre"
                  fill
                  priority
                  className="object-contain relative z-10 drop-shadow-md"
                />
              </div>

              {/* Typography Hierarchy */}
              <div className="min-w-0 flex flex-col justify-center">
                <span className="text-[10px] sm:text-[11px] font-serif uppercase tracking-widest text-[#C8A84B] font-semibold leading-tight">
                  Colegio Bilingüe
                </span>
                <h1 className="text-xs sm:text-sm lg:text-base font-black tracking-tight text-white uppercase leading-none truncate mt-0.5">
                  <span className="text-[#D71921]">San José</span> Campestre
                </h1>
                <span className="text-[10px] sm:text-xs text-slate-300 font-medium tracking-tight truncate hidden md:inline-block mt-0.5">
                  Sistema de Planeación Curricular & RAG
                </span>
              </div>
            </Link>
          </div>

          {/* CENTER: Desktop Active Navigation Tabs (when in dashboard) */}
          {user && showNavLinks && (
            <nav
              className="hidden xl:flex items-center gap-1.5 bg-[#0A1435]/60 p-1.5 rounded-2xl border border-white/10"
              aria-label="Navegación superior"
            >
              {navLinks.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))

                if (item.highlight) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isActive
                          ? 'bg-[#D71921] text-white ring-2 ring-[#C8A84B]'
                          : 'bg-[#D71921] text-white hover:bg-[#B81219]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </Link>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white font-bold border-b-2 border-[#C8A84B]'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        isActive ? 'text-[#C8A84B]' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          )}

          {/* CENTER-RIGHT: Institutional Badges (Desktop) */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Badge
              variant="outline"
              className="bg-white/5 border-white/15 text-slate-200 text-xs px-3 py-1 font-semibold flex items-center gap-1.5 backdrop-blur-md"
            >
              <GraduationCap className="h-3.5 w-3.5 text-[#C8A84B]" />
              <span>Planning Book SJB-RGA006</span>
            </Badge>

            <Badge
              variant="outline"
              className="bg-emerald-950/40 border-emerald-500/30 text-emerald-300 text-xs px-3 py-1 font-semibold flex items-center gap-2 backdrop-blur-md"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Motor RAG Activo</span>
            </Badge>
          </div>

          {/* RIGHT: User Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-2.5">
                {/* Active User Card */}
                <div className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-2xl px-3 py-1.5 backdrop-blur-md">
                  <div className="relative shrink-0">
                    {displayAvatar ? (
                      <img
                        src={displayAvatar}
                        alt={displayName}
                        className="w-8 h-8 rounded-full border border-[#C8A84B]/60 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D71921] to-[#0E1B4D] text-white font-black text-xs flex items-center justify-center border border-[#C8A84B]/50 shadow-inner">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0E1B4D]"
                      title="Sesión activa"
                    />
                  </div>

                  <div className="hidden sm:block text-left min-w-0 max-w-[130px] md:max-w-[160px]">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-[#C8A84B] truncate leading-tight font-medium">
                      {user.role === 'admin'
                        ? 'Administrador'
                        : user.role === 'coordinator'
                        ? 'Coordinación'
                        : displayEmail || 'Docente'}
                    </p>
                  </div>
                </div>

                {/* Sign Out Action Button */}
                <form action="/auth/signout" method="post">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    title="Cerrar sesión institucional"
                    className="h-9 px-2.5 text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-xl transition-colors text-xs font-semibold"
                  >
                    <LogOut className="h-4 w-4 text-rose-400 sm:mr-1.5" />
                    <span className="hidden md:inline">Salir</span>
                  </Button>
                </form>
              </div>
            ) : isAuth ? (
              <Badge
                variant="outline"
                className="bg-white/5 border-white/20 text-slate-200 text-xs px-3.5 py-1.5 font-semibold flex items-center gap-2 backdrop-blur-md"
              >
                <ShieldCheck className="h-4 w-4 text-[#C8A84B]" />
                <span className="hidden sm:inline">Acceso Institucional Seguro</span>
                <span className="sm:hidden">Seguro</span>
              </Badge>
            ) : (
              <Link href="/login">
                <Button
                  size="sm"
                  className="bg-[#D71921] hover:bg-[#B81219] text-white text-xs font-bold rounded-xl shadow-md px-4 h-9"
                >
                  Iniciar Sesión
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            {user && showNavLinks && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
                aria-label="Abrir menú de navegación"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Dropdown with Institutional Polish */}
        {user && showNavLinks && mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 bg-[#0A1435]/95 rounded-b-2xl px-2 pb-5 mt-1 shadow-2xl">
            <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-[#C8A84B] uppercase tracking-wider font-mono font-bold">
              <span>Navegación Curricular CBSJC</span>
              <span className="text-[10px] text-emerald-400 font-sans">RAG Activo</span>
            </div>

            {navLinks.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              if (item.highlight) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold text-white bg-[#D71921] hover:bg-[#B81219] transition-colors shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-white" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] font-extrabold bg-[#C8A84B] text-[#0E1B4D] px-2 py-0.5 rounded-full">
                      3 en 1
                    </span>
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white border-l-4 border-[#C8A84B]'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-[#C8A84B]' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="h-4 w-4 text-[#C8A84B]" />}
                </Link>
              )
            })}

            {/* Quick Mobile Info Card */}
            <div className="pt-2 px-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-2 text-white font-bold">
                  <GraduationCap className="h-3.5 w-3.5 text-[#C8A84B]" />
                  <span>Planning Book SJB-RGA006</span>
                </div>
                <p className="text-slate-400 text-[10px]">
                  Generación de Planning Book, Rúbricas y Planilla de Notas en Excel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
