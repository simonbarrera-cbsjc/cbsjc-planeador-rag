'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  FileDown,
  FileText,
  ExternalLink,
  Printer,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  Globe,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatDocumentType, formatArea, formatNivel } from '@/lib/utils'
import type { GeneratedDocument, ExportFormat } from '@/types'

interface PreviewPageProps {
  params: Promise<{ id: string }>
}

export default function PreviewPage({ params }: PreviewPageProps) {
  const resolvedParams = use(params)
  const documentId = resolvedParams.id
  const { toast } = useToast()

  const [document, setDocument] = useState<GeneratedDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Export states
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)

  // Fetch document details
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/generated-documents?id=${documentId}`)
        const json = await res.json()
        if (json.success && json.document) {
          setDocument(json.document)
          setContent(json.document.content)
        } else {
          toast({ title: 'Error', description: 'No se encontró el documento solicitado.', variant: 'error' })
        }
      } catch (err) {
        console.error('Error fetching document:', err)
        toast({ title: 'Error', description: 'Error al cargar el documento.', variant: 'error' })
      } finally {
        setLoading(false)
      }
    }

    if (documentId) {
      fetchDoc()
    }
  }, [documentId])

  // Save changes handler
  const handleSave = async () => {
    if (!document) return
    try {
      setIsSaving(true)
      const res = await fetch(`/api/generated-documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: document.id, content }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setLastSaved(new Date())
        toast({ title: 'Cambios guardados', description: 'El documento ha sido actualizado en la base de datos.', variant: 'success' })
      } else {
        throw new Error(json.error || 'Error al guardar')
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al guardar cambios', variant: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // Export handler
  const handleExport = async (format: ExportFormat) => {
    if (!document) return
    try {
      setExportingFormat(format)
      // Save latest content first
      await fetch(`/api/generated-documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: document.id, content }),
      })

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, format }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al exportar documento')
      }

      if (format === 'gdocs' && json.gdocsUrl) {
        window.open(json.gdocsUrl, '_blank')
        toast({ title: 'Google Docs Creado', description: 'El documento se abrió en una pestaña nueva.', variant: 'success' })
      } else if (json.downloadUrl) {
        // Trigger browser download
        const a = window.document.createElement('a')
        a.href = json.downloadUrl
        a.download = `${document.title}.${format === 'pdf' ? 'pdf' : 'docx'}`
        window.document.body.appendChild(a)
        a.click()
        window.document.body.removeChild(a)
        toast({ title: 'Descarga iniciada', description: `Tu archivo ${format.toUpperCase()} está listo.`, variant: 'success' })
      }
    } catch (err) {
      console.error('Export error:', err)
      toast({
        title: 'Error de exportación',
        description: err instanceof Error ? err.message : 'No se pudo exportar el documento.',
        variant: 'error',
      })
    } finally {
      setExportingFormat(null)
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#003087] mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Cargando documento institucional...</p>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="text-base font-bold text-slate-800">Documento no encontrado</p>
        <Link href="/history">
          <Button variant="outline">Volver al Historial</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Bar Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/history">
            <Button variant="ghost" size="sm" className="h-9 px-2.5 text-slate-600">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Historial
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <Badge variant="default" className="bg-[#003087] text-xs">
            {formatDocumentType(document.document_type)}
          </Badge>
          <Badge variant="secondary" className="uppercase text-xs font-bold">
            {document.language}
          </Badge>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="text-xs font-semibold"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Imprimir
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#003087] hover:bg-[#002060] text-white text-xs font-bold shadow-sm"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Main Preview & Export Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Editor / Viewer (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200 shadow-md">
            {/* Formal Institutional Header in the Document Card */}
            <div className="p-6 bg-slate-50/80 border-b border-slate-200 rounded-t-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black tracking-wide text-[#003087] uppercase">
                    Colegio Bilingüe San José Campestre
                  </h2>
                  <p className="text-[11px] font-semibold text-[#C8A84B] uppercase">
                    Sistema de Gestión y Planeación Curricular Oficial
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <p className="font-semibold text-slate-700">{formatDate(document.created_at)}</p>
                  <p>{formatArea(document.area)}</p>
                </div>
              </div>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="docTitle" className="text-xs text-slate-400">Título del Documento</Label>
                <h1 className="text-xl font-bold text-slate-900">{document.title}</h1>
              </div>

              {/* Editable Markdown / Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Contenido del Documento (Editable)</span>
                  {lastSaved && (
                    <span className="text-emerald-600 font-medium">
                      Guardado a las {lastSaved.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={26}
                  className="font-mono text-xs leading-relaxed p-4 bg-white border-slate-300 focus:border-[#003087]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Export Panel (1 col) */}
        <div className="space-y-6">
          {/* Export Formats Card */}
          <Card className="border-slate-200 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#003087] flex items-center gap-2">
                <FileDown className="h-4 w-4 text-[#C8A84B]" />
                Exportar Documento
              </CardTitle>
              <CardDescription className="text-xs">
                Descarga el documento en el formato institucional deseado o edítalo en Google Docs.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* PDF Button */}
              <Button
                onClick={() => handleExport('pdf')}
                disabled={exportingFormat !== null}
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Descargar en PDF (.pdf)</span>
                </div>
                {exportingFormat === 'pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-[10px] bg-red-800/60 px-2 py-0.5 rounded font-mono">PDF</span>
                )}
              </Button>

              {/* DOCX Button */}
              <Button
                onClick={() => handleExport('docx')}
                disabled={exportingFormat !== null}
                className="w-full h-11 bg-[#003087] hover:bg-[#002060] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <FileDown className="h-4 w-4" />
                  <span>Descargar en Word (.docx)</span>
                </div>
                {exportingFormat === 'docx' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-[10px] bg-[#001D52] px-2 py-0.5 rounded font-mono">DOCX</span>
                )}
              </Button>

              {/* Google Docs Button */}
              <Button
                onClick={() => handleExport('gdocs')}
                disabled={exportingFormat !== null}
                variant="outline"
                className="w-full h-11 border-slate-300 hover:bg-slate-50 font-bold text-xs text-slate-800 flex items-center justify-between px-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-amber-600" />
                  <span>Abrir en Google Docs</span>
                </div>
                {exportingFormat === 'gdocs' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Drive</span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Metadata Card */}
          <Card className="border-slate-200 shadow-sm bg-slate-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ficha Técnica del Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Área:</span>
                <span className="font-semibold text-slate-800">{formatArea(document.area)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Nivel Educativo:</span>
                <span className="font-semibold text-slate-800">{formatNivel(document.nivel)}</span>
              </div>
              {document.grado && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Grado:</span>
                  <span className="font-semibold text-slate-800">{document.grado}</span>
                </div>
              )}
              {document.periodo && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Periodo Académico:</span>
                  <span className="font-semibold text-slate-800">Periodo {document.periodo}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Fuentes RAG:</span>
                <span className="font-semibold text-emerald-700">{document.sources_used} fragmentos</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Motor IA:</span>
                <span className="font-semibold text-slate-800">Gemini 2.0 Flash</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
