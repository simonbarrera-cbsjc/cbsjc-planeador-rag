'use client'

import React from 'react'
import {
  Eye,
  FileText,
  Edit3,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Printer,
  FileDown,
  FolderArchive,
  Layers,
  BookOpen,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bold,
  Italic,
  List,
  Heading2,
  Navigation,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface WordToolbarProps {
  viewMode: 'pages' | 'continuous' | 'markdown'
  setViewMode: (mode: 'pages' | 'continuous' | 'markdown') => void
  isEditable: boolean
  setIsEditable: (editable: boolean) => void
  zoomScale: number
  setZoomScale: (scale: number | ((prev: number) => number)) => void
  isDirty: boolean
  isSaving: boolean
  lastSaved: Date | null
  onSave: () => void
  onPrint: () => void
  onScrollToSection: (sectionKeyword: string) => void
  sectionsList: Array<{ id: string; label: string; keyword: string }>
}

export function WordToolbar({
  viewMode,
  setViewMode,
  isEditable,
  setIsEditable,
  zoomScale,
  setZoomScale,
  isDirty,
  isSaving,
  lastSaved,
  onSave,
  onPrint,
  onScrollToSection,
  sectionsList,
}: WordToolbarProps) {
  return (
    <div className="sticky top-2 z-30 bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-2xl p-2.5 space-y-2 print:hidden">
      {/* Top Row: Main View Mode & Document Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: View Modes */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
          <Button
            size="sm"
            variant={viewMode === 'pages' ? 'default' : 'ghost'}
            onClick={() => setViewMode('pages')}
            className={`h-8 px-3 text-xs font-bold rounded-lg ${
              viewMode === 'pages'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Hojas A4 (Word)
          </Button>

          <Button
            size="sm"
            variant={viewMode === 'continuous' ? 'default' : 'ghost'}
            onClick={() => setViewMode('continuous')}
            className={`h-8 px-3 text-xs font-bold rounded-lg ${
              viewMode === 'continuous'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Flujo Continuo
          </Button>

          <Button
            size="sm"
            variant={viewMode === 'markdown' ? 'default' : 'ghost'}
            onClick={() => setViewMode('markdown')}
            className={`h-8 px-3 text-xs font-bold rounded-lg ${
              viewMode === 'markdown'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Código Markdown
          </Button>
        </div>

        {/* Center: Section Jumper Dropdown */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs">
            <Navigation className="h-3.5 w-3.5 text-[#0E1B4D]" />
            <select
              onChange={(e) => {
                if (e.target.value) onScrollToSection(e.target.value)
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer max-w-[190px] sm:max-w-[240px] truncate"
              defaultValue=""
            >
              <option value="" disabled>
                Ir a sección...
              </option>
              {sectionsList.map((sec) => (
                <option key={sec.id} value={sec.keyword}>
                  {sec.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Zoom & Save Action */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          {viewMode !== 'markdown' && (
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-700">
              <button
                onClick={() => setZoomScale((z) => Math.max(0.65, Math.round((z - 0.1) * 10) / 10))}
                className="p-1 hover:bg-slate-200 rounded text-slate-600"
                title="Reducir Zoom"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-12 text-center text-[11px] font-bold font-mono">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((z) => Math.min(1.3, Math.round((z + 0.1) * 10) / 10))}
                className="p-1 hover:bg-slate-200 rounded text-slate-600"
                title="Aumentar Zoom"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setZoomScale(1)}
                className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-[#0E1B4D] border border-slate-200 rounded shadow-2xs"
                title="Restablecer 100%"
              >
                100%
              </button>
            </div>
          )}

          {/* Save Button */}
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="bg-[#0E1B4D] hover:bg-[#162874] text-white text-xs font-bold rounded-xl h-8 px-3 shadow-xs flex items-center gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Guardar</span>
            <span className="text-[10px] opacity-70 hidden sm:inline">(Ctrl+S)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onPrint}
            className="h-8 px-2.5 text-xs font-bold rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100"
            title="Imprimir formato oficial A4"
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Bottom Sub-row: Quick Status & WYSIWYG Hint Bar */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
        <div className="flex items-center gap-2">
          {viewMode !== 'markdown' && (
            <button
              onClick={() => setIsEditable(!isEditable)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold transition-colors ${
                isEditable
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Edit3 className="h-3 w-3 text-emerald-600" />
              <span>{isEditable ? 'Modo Edición Activo (Clic para editar texto y celdas)' : 'Modo Solo Lectura'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 font-medium">
          {isDirty ? (
            <span className="flex items-center gap-1 text-[#D71921] font-bold">
              <AlertCircle className="h-3.5 w-3.5" />
              Cambios pendientes de guardar
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Guardado a las {lastSaved.toLocaleTimeString()}
            </span>
          ) : (
            <span className="text-slate-400">Plantilla SJB-RGA006 Oficial</span>
          )}
        </div>
      </div>
    </div>
  )
}
