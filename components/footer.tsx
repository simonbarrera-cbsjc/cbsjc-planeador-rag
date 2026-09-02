import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sparkles,
  GraduationCap,
  ShieldCheck,
  FileCheck2,
  Cpu,
  FolderSync,
  BookOpen,
  ArrowUpRight,
  School,
  FileSpreadsheet,
} from 'lucide-react'

export interface FooterProps {
  className?: string
  compact?: boolean
}

export function Footer({ className = '', compact = false }: FooterProps) {
  const currentYear = new Date().getFullYear()

  if (compact) {
    return (
      <footer
        className={`w-full bg-[#0E1B4D] border-t border-[#0A1435] text-slate-300 py-6 px-4 sm:px-6 lg:px-8 ${className}`}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          {/* Institutional copyright */}
          <div className="flex items-center gap-3 text-center md:text-left">
            <div className="relative w-7 h-7 shrink-0 drop-shadow">
              <Image
                src="/logo.png"
                alt="Escudo Colegio Bilingüe San José Campestre"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-slate-300 font-medium">
                © {currentYear} <strong className="text-white">Colegio Bilingüe San José Campestre</strong>. Todos los derechos reservados.
              </p>
              <p className="text-[10px] text-slate-400">
                Planning Book SJB-RGA006 • Sistema Institucional de Planeación Curricular
              </p>
            </div>
          </div>

          {/* Scibaru AI Compact Tech Badge */}
          <div className="flex items-center gap-2.5 bg-[#030C26] border border-[#A6174B]/50 hover:border-[#A6174B] text-slate-200 px-4 py-2 rounded-full shadow-[0_0_18px_rgba(166,23,75,0.28)] transition-all duration-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A6174B] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A6174B]" />
            </span>
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              Desarrollado por{' '}
              <strong className="text-[#F2F2F2] font-black tracking-tight bg-gradient-to-r from-white via-pink-100 to-[#A6174B] bg-clip-text text-transparent">
                Scibaru AI
              </strong>
            </span>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={`w-full bg-gradient-to-b from-[#0E1B4D] via-[#0A1435] to-[#060D24] text-slate-300 border-t border-[#162874]/80 relative overflow-hidden ${className}`}
    >
      {/* Top Gold & Red Brand Stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-[#D71921] via-[#C8A84B] to-[#162874]" />

      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-48 bg-[#D71921]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-48 bg-[#A6174B]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Footer Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10 pb-10 border-b border-white/10">
          {/* COLUMN 1: CBSJC Institutional Identity (5 Cols) */}
          <div className="md:col-span-6 lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="relative w-12 h-12 shrink-0 drop-shadow-md">
                <Image
                  src="/logo.png"
                  alt="Escudo Oficial Colegio Bilingüe San José Campestre"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <span className="text-[10px] font-serif uppercase tracking-widest text-[#C8A84B] font-semibold block leading-tight">
                  Colegio Bilingüe
                </span>
                <h3 className="text-base font-black text-white uppercase tracking-tight leading-tight mt-0.5">
                  <span className="text-[#D71921]">San José</span> Campestre
                </h3>
                <span className="text-[11px] text-slate-300 font-medium block">
                  Educación de Excelencia & Bilingüismo
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-md">
              Plataforma institucional de planeación curricular y generación automatizada de secuencias didácticas bajo el formato oficial <strong>Planning Book (SJB-RGA006)</strong>, rúbricas pedagógicas por pilar y planillas de notas automatizadas en Excel para el cuerpo docente y directivo.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 pt-1">
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                <ShieldCheck className="h-3.5 w-3.5 text-[#C8A84B]" />
                <span>Lineamientos DBA & SIEE</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                <School className="h-3.5 w-3.5 text-[#D71921]" />
                <span>Normatividad MEN Colombia</span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Quick Links & Curricular Formats (3 Cols) */}
          <div className="md:col-span-3 lg:col-span-3 space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#C8A84B] flex items-center gap-2 font-mono">
              <BookOpen className="h-3.5 w-3.5 text-[#D71921]" />
              Módulos Curriculares
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link
                  href="/dashboard"
                  className="text-slate-300 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C8A84B] group-hover:scale-125 transition-transform" />
                  <span>Panel Principal</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/generate"
                  className="text-slate-300 hover:text-white transition-colors flex items-center gap-2 group font-semibold text-white"
                >
                  <Sparkles className="h-3 w-3 text-[#D71921]" />
                  <span>Generar Planning Book (3 en 1)</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/history"
                  className="text-slate-300 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <FileCheck2 className="h-3 w-3 text-emerald-400" />
                  <span>Historial de Secuencias</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/upload"
                  className="text-slate-300 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <FolderSync className="h-3 w-3 text-sky-400" />
                  <span>Base RAG / Documentos Rectores</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: PROMINENT SCIBARU AI TECH SPOTLIGHT (4 Cols) */}
          <div className="md:col-span-3 lg:col-span-4 space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#C8A84B] flex items-center gap-2 font-mono">
              <Cpu className="h-3.5 w-3.5 text-[#A6174B]" />
              Tecnología & Desarrollo
            </h4>

            {/* SCIBARU AI PROMINENT INSTITUTIONAL CARD */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#030C26] border border-[#A6174B]/40 hover:border-[#A6174B] shadow-[0_0_25px_rgba(166,23,75,0.22)] transition-all duration-300 group relative overflow-hidden">
              {/* Internal subtle radial glow */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-[#A6174B]/25 to-transparent rounded-full blur-xl pointer-events-none" />

              <div className="relative z-10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#590B36]/60 border border-[#A6174B]/50 text-[10px] font-bold text-pink-200">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pink-300" />
                    </span>
                    <span>AI Engineering Engine</span>
                  </div>
                  <Sparkles className="h-4 w-4 text-[#A6174B] group-hover:rotate-12 transition-transform" />
                </div>

                <div>
                  <p className="text-[11px] font-medium text-slate-300">
                    Desarrollado por
                  </p>
                  <h5 className="text-lg font-black tracking-tight text-[#F2F2F2] flex items-center gap-1.5">
                    <span className="bg-gradient-to-r from-white via-pink-100 to-[#A6174B] bg-clip-text text-transparent">
                      Scibaru AI
                    </span>
                  </h5>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Arquitectura RAG multimodal avanzada con embeddings semánticos vectoriales y modelos generativos de Google AI para optimización y rigurosidad del flujo curricular docente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR: Institutional Disclaimer, Copyright & Location */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="space-y-1 text-center md:text-left">
            <p className="text-slate-300">
              © {currentYear} <strong className="text-white font-semibold">Colegio Bilingüe San José Campestre</strong>. Todos los derechos reservados.
            </p>
            <p className="text-[10px] text-slate-400">
              Herramienta oficial de apoyo curricular y generación RAG para el cuerpo docente y directivo del CBSJC.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-300 flex-wrap justify-center">
            <span className="text-[#C8A84B] font-semibold">Planning Book SJB-RGA006</span>
            <span>•</span>
            <span>Gemini 2.0 Flash</span>
            <span>•</span>
            <span className="font-semibold text-slate-200">Bogotá D.C., Colombia</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
