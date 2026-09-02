'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Sparkles,
  History,
  GraduationCap,
  LogOut,
} from 'lucide-react'

export interface SidebarUserProps {
  id?: string
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  role?: string | null
}

interface SidebarProps {
  user?: SidebarUserProps | null
  className?: string
  onItemClick?: () => void
}

export function Sidebar({ user, className = '', onItemClick }: SidebarProps) {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'Panel Principal',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'Generar Planeación',
      href: '/generate',
      icon: Sparkles,
      highlight: true,
      badge: '3 en 1',
    },
    {
      label: 'Historial de Planeaciones',
      href: '/history',
      icon: History,
      badge: null,
    },
  ]

  const displayName = user?.name || user?.email?.split('@')[0] || 'Docente'
  const displayEmail = user?.email || ''
  const avatarUrl = user?.avatarUrl

  return (
    <aside
      className={`w-full md:w-64 lg:w-72 bg-[#0E1B4D] text-white flex flex-col border-r border-white/10 shrink-0 min-h-full ${className}`}
    >
      {/* Top Red & White Institutional Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-[#D71921] via-white/40 to-[#162874]" />

      {/* Institutional Branding Header */}
      <div className="p-5 border-b border-white/10 flex items-center gap-3.5 bg-[#0A1435]/60">
        <Link
          href="/dashboard"
          onClick={onItemClick}
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xl"
        >
          <div className="relative w-11 h-11 shrink-0 drop-shadow-md transition-transform group-hover:scale-105 duration-200">
            <Image
              src="/logo.png"
              alt="Escudo Colegio Bilingüe San José Campestre"
              fill
              priority
              className="object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-serif uppercase tracking-widest text-white/90 font-semibold block leading-tight">
              Colegio Bilingüe
            </span>
            <h2 className="text-xs font-black uppercase tracking-wider text-white truncate leading-tight mt-0.5">
              <span className="text-[#D71921]">San José</span> Campestre
            </h2>
            <span className="text-[10px] text-slate-300 font-medium block truncate">
              Planning Book SJB-RGA006
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
        <div className="px-3 pt-2 pb-1.5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70 font-mono">
            Módulos Curriculares
          </p>
        </div>

        <nav className="space-y-1.5" aria-label="Navegación principal del dashboard">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))

            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-md ${
                    isActive
                      ? 'bg-gradient-to-r from-[#D71921] to-[#B81219] text-white ring-2 ring-white/80 shadow-red-950/40'
                      : 'bg-[#D71921] hover:bg-[#B81219] text-white hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-black uppercase tracking-wide bg-white text-[#0E1B4D] px-2 py-0.5 rounded-full shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white font-bold border-l-4 border-white shadow-sm pl-2.5'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Institutional Info Card */}
      <div className="p-3 mx-3 mb-3 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-2 relative overflow-hidden">
        <div className="flex items-center gap-2 font-bold text-white">
          <GraduationCap className="h-4 w-4 text-white shrink-0" />
          <span className="text-[11px] uppercase tracking-wide text-white font-semibold">
            SJB-RGA006 Oficial
          </span>
        </div>
        <p className="text-[11px] text-slate-300 leading-snug">
          Alineado con el SIEE, DBA 2026 y ponderaciones 35/35/20/10 del CBSJC.
        </p>
        <div className="pt-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sistema Curricular Oficial Activo</span>
        </div>
      </div>

      {/* User Profile & Sign Out Footer */}
      <div className="p-4 border-t border-white/10 bg-[#0A1435] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-9 h-9 rounded-full border border-white/50 object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D71921] to-[#0E1B4D] text-white font-black text-xs flex items-center justify-center border border-white/50 shadow-inner">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0E1B4D]"
              title="Sesión activa"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-white/80 truncate leading-tight font-medium">
              {user?.role === 'admin'
                ? 'Administrador'
                : user?.role === 'coordinator'
                ? 'Coordinación Académica'
                : displayEmail || 'Docente'}
            </p>
          </div>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title="Cerrar sesión institucional"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors"
          >
            <LogOut className="h-4 w-4 text-rose-400" />
          </button>
        </form>
      </div>
    </aside>
  )
}
