'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  FileDown,
  FileText,
  Printer,
  Save,
  CheckCircle2,
  Copy,
  Sparkles,
  BookOpen,
  FileSpreadsheet,
  Layers,
  GraduationCap,
  Loader2,
  FolderArchive,
  TableProperties,
  Edit3,
  Eye,
  FileCode,
  Download,
  HelpCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatArea } from '@/lib/utils'
import type { GeneratedDocument } from '@/types'

interface PreviewPageProps {
  params: Promise<{ id: string }>
}

export default function PreviewPage({ params }: PreviewPageProps) {
  const resolvedParams = use(params)
  const documentId = resolvedParams.id
  const { toast } = useToast()

  const [document, setDocument] = useState<GeneratedDocument | null>(null)
  const [loading, setLoading] = useState(true)

  // Document states
  const [planningMarkdown, setPlanningMarkdown] = useState('')
  const [rubricsMarkdown, setRubricsMarkdown] = useState('')
  const [cibercolegiosSnippet, setCibercolegiosSnippet] = useState('')
  const [excelMetadata, setExcelMetadata] = useState<any>(null)

  // Editor mode: 'visual' (Word-like WYSIWYG) vs 'markdown'
  const [viewMode, setViewMode] = useState<'visual' | 'markdown'>('visual')

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  const editableDocumentRef = useRef<HTMLDivElement>(null)

  // Fetch document details
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/generated-documents?id=${documentId}`)
        const json = await res.json()
        if (json.success && json.document) {
          setDocument(json.document)

          try {
            const parsed = JSON.parse(json.document.content)
            if (parsed.planningBookMarkdown) {
              setPlanningMarkdown(parsed.planningBookMarkdown)
              setRubricsMarkdown(parsed.rubricsMarkdown || parsed.planningBookMarkdown)
              setCibercolegiosSnippet(parsed.cibercolegiosSnippet || '')
              setExcelMetadata(parsed.excelSpec || null)
              return
            }
          } catch {
            // plain markdown fallback
          }

          setPlanningMarkdown(json.document.content)
          setRubricsMarkdown(json.document.content)
        } else {
          toast({ title: 'Error', description: 'No se encontró la planeación solicitada.', variant: 'error' })
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
      const combinedPayload = JSON.stringify({
        planningBookMarkdown: planningMarkdown,
        rubricsMarkdown: rubricsMarkdown,
        cibercolegiosSnippet: cibercolegiosSnippet,
        excelSpec: excelMetadata,
      })

      const res = await fetch(`/api/generated-documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: document.id, content: combinedPayload }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setLastSaved(new Date())
        toast({ title: 'Cambios guardados', description: 'Planeación actualizada con éxito.', variant: 'success' })
      } else {
        throw new Error(json.error || 'Error al guardar')
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al guardar cambios', variant: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // Copy to clipboard helper
  const handleCopyCibercolegios = () => {
    if (!cibercolegiosSnippet) return
    navigator.clipboard.writeText(cibercolegiosSnippet)
    setCopiedSnippet(true)
    toast({ title: '¡Copiado!', description: 'Texto listo para pegar directamente en Cibercolegios.', variant: 'success' })
    setTimeout(() => setCopiedSnippet(false), 3000)
  }

  // Export handler (Word, PDF, Excel, ZIP)
  const handleExport = async (format: 'pdf' | 'docx' | 'rubrics_docx' | 'excel' | 'zip') => {
    if (!document) return
    try {
      setExportingFormat(format)
      await handleSave()

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, format }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al exportar')
      }

      if (json.downloadUrl) {
        const a = window.document.createElement('a')
        a.href = json.downloadUrl
        const ext = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : format === 'zip' ? 'zip' : 'docx'
        a.download = `${document.title}.${ext}`
        window.document.body.appendChild(a)
        a.click()
        window.document.body.removeChild(a)
        toast({ title: 'Descarga iniciada', description: `Tu archivo ${ext.toUpperCase()} oficial está listo.`, variant: 'success' })
      }
    } catch (err) {
      console.error('Export error:', err)
      toast({
        title: 'Error de exportación',
        description: err instanceof Error ? err.message : 'No se pudo exportar.',
        variant: 'error',
      })
    } finally {
      setExportingFormat(null)
    }
  }

  // Helper to render markdown lines into interactive Word-like HTML elements
  const renderVisualDocument = (content: string) => {
    if (!content) return null
    const lines = content.split('\n')
    const elements: React.ReactNode[] = []
    let currentTableRows: string[][] = []
    let tableKey = 0

    const flushTable = () => {
      if (currentTableRows.length > 0) {
        const rows = [...currentTableRows]
        const isHeader = rows[0]
        elements.push(
          <div key={`tbl-${tableKey++}`} className="my-4 overflow-x-auto rounded-xl border border-slate-300 shadow-sm bg-white">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0E1B4D] text-white">
                  {isHeader.map((col, cIdx) => (
                    <th key={cIdx} className="p-3 font-bold border border-slate-300 text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {row.map((col, cIdx) => (
                      <td key={cIdx} className="p-2.5 border border-slate-200 text-slate-800 leading-relaxed">
                        {col}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        currentTableRows = []
      }
    }

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim()

      if (line.startsWith('|') && line.endsWith('|')) {
        if (/^\|[\s\-:|]+\|$/.test(line)) return
        const cols = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim().replace(/\*\*/g, ''))
        currentTableRows.push(cols)
        return
      } else {
        flushTable()
      }

      if (!line) {
        elements.push(<div key={idx} className="h-2" />)
        return
      }

      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={idx} className="text-xl font-black text-[#0E1B4D] mt-6 mb-3 border-b-2 border-[#0E1B4D] pb-2">
            {line.substring(2).replace(/\*\*/g, '')}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={idx} className="text-base font-bold text-[#0E1B4D] mt-5 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D71921]" />
            {line.substring(3).replace(/\*\*/g, '')}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-sm font-bold text-[#D71921] mt-4 mb-1">
            {line.substring(4).replace(/\*\*/g, '')}
          </h3>
        )
      } else if (line.startsWith('#### ')) {
        elements.push(
          <h4 key={idx} className="text-xs font-bold text-slate-800 mt-3 mb-1">
            {line.substring(5).replace(/\*\*/g, '')}
          </h4>
        )
      } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
        const clean = line.replace(/^[-*]\s+|\d+\.\s+/, '')
        elements.push(
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 my-1 pl-3">
            <span className="text-[#D71921] font-bold">•</span>
            <span className="flex-1 leading-relaxed">
              {clean.includes('**') ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: clean.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#0E1B4D] font-bold">$1</strong>'),
                  }}
                />
              ) : (
                clean
              )}
            </span>
          </div>
        )
      } else {
        elements.push(
          <p
            key={idx}
            className="text-xs text-slate-800 leading-relaxed my-2"
            dangerouslySetInnerHTML={{
              __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#0E1B4D] font-bold">$1</strong>'),
            }}
          />
        )
      }
    })

    flushTable()
    return elements
  }

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#162874] mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Cargando paquete curricular CBSJC (18+ páginas)...</p>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="text-base font-bold text-slate-800">Documento no encontrado</p>
        <Link href="/history">
          <Button variant="outline" className="rounded-xl">Volver al Historial</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/history">
            <Button variant="ghost" size="sm" className="h-9 px-2.5 text-slate-600 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Historial
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <Badge className="bg-[#0E1B4D] text-xs font-bold">Planning Book SJB-RGA006</Badge>
          <Badge variant="outline" className="text-xs font-bold text-[#D71921] border-[#D71921]/30">
            Documento Completo (18+ Páginas)
          </Badge>
        </div>

        {/* Global Export & Save Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* COMPLETE ZIP BUNDLE BUTTON */}
          <Button
            size="sm"
            onClick={() => handleExport('zip')}
            disabled={exportingFormat !== null}
            className="bg-[#D71921] hover:bg-[#B81219] text-white text-xs font-bold shadow-md rounded-xl h-9 px-4 flex items-center gap-1.5"
          >
            {exportingFormat === 'zip' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderArchive className="h-3.5 w-3.5" />
            )}
            <span>Descargar Paquete Completo (.ZIP)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="text-xs font-bold rounded-xl border-slate-300 h-9"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Imprimir
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#0E1B4D] hover:bg-[#162874] text-white text-xs font-bold shadow-sm rounded-xl h-9"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* THREE TABS CONTAINER */}
      <Tabs defaultValue="planning" className="space-y-6">
        <TabsList className="bg-slate-200/70 p-1.5 rounded-2xl grid grid-cols-3 max-w-2xl">
          <TabsTrigger value="planning" className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-[#0E1B4D] data-[state=active]:text-white">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            1. Planning Book Oficial
          </TabsTrigger>
          <TabsTrigger value="rubrics" className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-[#0E1B4D] data-[state=active]:text-white">
            <TableProperties className="h-3.5 w-3.5 mr-1.5" />
            2. Rúbricas & Cibercolegios
          </TabsTrigger>
          <TabsTrigger value="excel" className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-[#0E1B4D] data-[state=active]:text-white">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
            3. Planilla Excel (.xlsx)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PLANNING BOOK (WORD-LIKE PAGINATED VIEW & EDITOR) */}
        <TabsContent value="planning" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left 3 Columns: Word-like Document Canvas */}
            <div className="lg:col-span-3 space-y-4">
              {/* Document Toolbar */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === 'visual' ? 'default' : 'outline'}
                    onClick={() => setViewMode('visual')}
                    className="h-8 text-xs font-bold rounded-xl"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Vista Formato Word
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'markdown' ? 'default' : 'outline'}
                    onClick={() => setViewMode('markdown')}
                    className="h-8 text-xs font-bold rounded-xl"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                    Editor de Texto
                  </Button>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Plantilla SJB-RGA006 (Formato 100% Oficial)</span>
                  {lastSaved && (
                    <span className="text-emerald-700 font-bold ml-2">
                      • Guardado: {lastSaved.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              {/* SIMULATED WORD PAGE CONTAINER */}
              {viewMode === 'visual' ? (
                <div className="bg-slate-100/80 p-4 sm:p-8 rounded-3xl border border-slate-200 shadow-inner flex justify-center">
                  <div className="w-full max-w-4xl bg-white shadow-2xl rounded-xl border border-slate-200 p-8 sm:p-14 space-y-6 min-h-[1100px] text-slate-900 font-sans">
                    {/* Official 3-Column Header Table */}
                    <div className="border border-slate-400 rounded-lg overflow-hidden grid grid-cols-12 text-xs">
                      {/* Logo Column */}
                      <div className="col-span-2 p-3 bg-white border-r border-slate-400 flex flex-col items-center justify-center">
                        <div className="relative w-14 h-14">
                          <Image src="/cbsjc-crest.png" alt="Escudo CBSJC" fill className="object-contain" priority />
                        </div>
                      </div>

                      {/* Center Title Column */}
                      <div className="col-span-7 p-3 border-r border-slate-400 text-center flex flex-col justify-center bg-white">
                        <h2 className="font-bold text-[#0E1B4D] text-xs uppercase tracking-wide">
                          Colegio Bilingüe San José Campestre
                        </h2>
                        <h3 className="font-black text-[#D71921] text-xs uppercase tracking-wide mt-0.5">
                          Planning Book Primary & Secondary
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Secuencia Didáctica: Antes — Durante — Después · Formato RGA006
                        </p>
                      </div>

                      {/* Right Metadata Column */}
                      <div className="col-span-3 p-3 bg-slate-50 flex flex-col justify-center text-[10px] text-right space-y-0.5">
                        <p className="font-bold text-[#0E1B4D]">CÓDIGO: SJB-RGA006</p>
                        <p className="text-slate-500">VERSIÓN: 4</p>
                        <p className="text-slate-500">VIGENCIA: 2026</p>
                        <p className="font-semibold text-slate-700">PÁGINA: 1 de 18+</p>
                      </div>
                    </div>

                    {/* Visual Rendered Document Body */}
                    <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-4">
                      {renderVisualDocument(planningMarkdown)}
                    </div>
                  </div>
                </div>
              ) : (
                <Card className="border-slate-200 shadow-md rounded-2xl bg-white overflow-hidden p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-[#0E1B4D]">Editor de Texto de la Planeación Curricular</Label>
                    <span className="text-xs text-slate-400">Total caracteres: {planningMarkdown.length}</span>
                  </div>
                  <Textarea
                    value={planningMarkdown}
                    onChange={(e) => setPlanningMarkdown(e.target.value)}
                    rows={30}
                    className="font-mono text-xs leading-relaxed p-4 bg-white border-slate-300 focus:border-[#162874] rounded-xl"
                  />
                </Card>
              )}
            </div>

            {/* Right Side Column: Actions & Download Cards */}
            <div className="space-y-5">
              {/* Primary Word & PDF Download Card */}
              <Card className="border-slate-200 shadow-md bg-white rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-[#0E1B4D] flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-[#D71921]" />
                    Descargar Planning Book Oficial
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Archivos generados con las 18 tablas institucionales oficiales.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => handleExport('docx')}
                    disabled={exportingFormat !== null}
                    className="w-full h-12 bg-[#0E1B4D] hover:bg-[#162874] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      {exportingFormat === 'docx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      <span>Descargar Word (.docx)</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">Word Oficial</span>
                  </Button>

                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={exportingFormat !== null}
                    className="w-full h-12 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      {exportingFormat === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      <span>Descargar PDF (.pdf)</span>
                    </div>
                    <span className="text-[10px] bg-red-950/40 px-2 py-0.5 rounded font-mono">PDF Imprimible</span>
                  </Button>
                </CardContent>
              </Card>

              {/* Full Package ZIP Card */}
              <Card className="border-slate-200 shadow-md bg-slate-50 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-[#0E1B4D] flex items-center gap-1.5">
                    <FolderArchive className="h-4 w-4 text-[#D71921]" />
                    Paquete Curricular Completo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-600">
                  <p className="text-[11px] text-slate-500">
                    Descarga en un solo archivo comprimido (.zip):
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                    <p className="flex items-center gap-1.5 font-medium text-slate-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      1. Planning Book Word (.docx)
                    </p>
                    <p className="flex items-center gap-1.5 font-medium text-slate-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      2. Rúbricas Menú de Desafíos (.docx)
                    </p>
                    <p className="flex items-center gap-1.5 font-medium text-slate-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      3. Planilla de Notas Excel (.xlsx)
                    </p>
                  </div>
                  <Button
                    onClick={() => handleExport('zip')}
                    disabled={exportingFormat !== null}
                    className="w-full bg-[#0E1B4D] hover:bg-[#162874] text-white text-xs font-bold rounded-xl mt-2"
                  >
                    {exportingFormat === 'zip' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FolderArchive className="h-3.5 w-3.5 mr-1" />}
                    Descargar Paquete ZIP
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: RUBRICS & CIBERCOLEGIOS */}
        <TabsContent value="rubrics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Cibercolegios Quick Copy Card */}
              <Card className="border-slate-200 bg-slate-50/80 shadow-md rounded-2xl">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#0E1B4D] flex items-center gap-2">
                      <Copy className="h-4 w-4 text-[#D71921]" />
                      Bloque de Traslado Directo a Cibercolegios
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600">
                      Copia y pega este texto íntegro en la descripción de la tarea/evaluación en la plataforma Cibercolegios.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCopyCibercolegios}
                    className="bg-[#0E1B4D] hover:bg-[#162874] text-white font-bold text-xs rounded-xl shadow-sm h-8"
                  >
                    {copiedSnippet ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copiedSnippet ? '¡Copiado!' : 'Copiar Texto'}
                  </Button>
                </CardHeader>
                <CardContent className="pt-2">
                  <Textarea
                    value={cibercolegiosSnippet}
                    onChange={(e) => setCibercolegiosSnippet(e.target.value)}
                    rows={4}
                    className="bg-white border-slate-300 font-mono text-xs rounded-xl"
                  />
                </CardContent>
              </Card>

              {/* Visual Rubrics Matrix & Anexos */}
              <Card className="border-slate-200 shadow-md rounded-2xl bg-white p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <CardTitle className="text-base font-bold text-[#0E1B4D]">
                    Rúbricas Detalladas y Anexos Evaluativos
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSave}
                    className="rounded-xl text-xs font-bold"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" /> Guardar Rúbricas
                  </Button>
                </div>

                <div className="prose prose-slate max-w-none text-xs leading-relaxed">
                  {renderVisualDocument(rubricsMarkdown)}
                </div>
              </Card>
            </div>

            {/* Side Action Column for Rubrics */}
            <div className="space-y-5">
              <Card className="border-slate-200 shadow-md bg-white rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-[#0E1B4D] flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-[#D71921]" />
                    Descargar Rúbricas (.docx)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Exporta la matriz de evaluación y criterios en formato Word editable.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleExport('rubrics_docx')}
                    disabled={exportingFormat !== null}
                    className="w-full h-11 bg-[#0E1B4D] hover:bg-[#162874] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      <span>Descargar Rúbrica (.docx)</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">Word</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: EXCEL SPREADSHEET */}
        <TabsContent value="excel" className="space-y-6">
          <Card className="border-slate-200 shadow-md rounded-2xl bg-white overflow-hidden">
            <div className="p-6 bg-[#0E1B4D] text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-[#D71921]" />
                  <h2 className="text-base font-black">Planilla de Notas Automatizada CBSJC (.xlsx)</h2>
                </div>
                <p className="text-xs text-slate-300">
                  Hoja de cálculo oficial configurada con las 4 competencias institucionales y fórmulas automáticas.
                </p>
              </div>

              <Button
                onClick={() => handleExport('excel')}
                disabled={exportingFormat !== null}
                className="bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs shadow-md rounded-xl h-11 px-6 flex items-center gap-2"
              >
                {exportingFormat === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span>Descargar Planilla Excel (.xlsx)</span>
              </Button>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Pillar Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                  <p className="text-[11px] font-bold text-[#162874] uppercase">Pilar 1: SABER</p>
                  <p className="text-lg font-black text-[#0E1B4D]">35%</p>
                  <p className="text-[11px] text-slate-600">Comprensión conceptual y explicación teórica.</p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                  <p className="text-[11px] font-bold text-[#162874] uppercase">Pilar 2: SABER HACER</p>
                  <p className="text-lg font-black text-[#0E1B4D]">35%</p>
                  <p className="text-[11px] text-slate-600">Resolución de problemas y producto ACE bilingüe.</p>
                </div>

                <div className="p-4 rounded-xl bg-red-50/70 border border-red-100 space-y-1">
                  <p className="text-[11px] font-bold text-[#D71921] uppercase">Pilar 3: SABER SER</p>
                  <p className="text-lg font-black text-[#D71921]">20%</p>
                  <p className="text-[11px] text-slate-600">Autonomía, metacognición y persistencia.</p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase">Pilar 4: SABER CONVIVIR</p>
                  <p className="text-lg font-black text-emerald-900">10%</p>
                  <p className="text-[11px] text-slate-600">Trabajo en equipo y transformación de conflictos.</p>
                </div>
              </div>

              {/* Band Reference Box */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-[#0E1B4D] uppercase tracking-wider">
                  Fórmulas y Bandas del Menú de Desafíos Integradas en el Excel
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 font-medium">
                    <span className="font-bold text-[#0E1B4D] block">Gold (4.8 – 5.0)</span>
                    <span className="text-[11px] text-slate-500">Desempeño superior avanzado</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 font-medium">
                    <span className="font-bold text-slate-800 block">Silver (4.6 – 4.7)</span>
                    <span className="text-[11px] text-slate-500">Alto con elementos agregados</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 font-medium">
                    <span className="font-bold text-slate-800 block">Bronze (4.0 – 4.5)</span>
                    <span className="text-[11px] text-slate-500">Aprendizaje esperado completo</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-red-300 font-medium">
                    <span className="font-bold text-red-700 block">Sin Categoría (1.0 – 3.9)</span>
                    <span className="text-[11px] text-slate-500">En proceso de consolidación</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
