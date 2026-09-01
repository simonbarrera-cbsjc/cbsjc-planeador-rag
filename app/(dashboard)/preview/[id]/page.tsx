'use client'

import { useState, useEffect, use } from 'react'
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

  // Sub-document states
  const [planningMarkdown, setPlanningMarkdown] = useState('')
  const [rubricsMarkdown, setRubricsMarkdown] = useState('')
  const [cibercolegiosSnippet, setCibercolegiosSnippet] = useState('')
  const [excelMetadata, setExcelMetadata] = useState<any>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  // Fetch document details
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/generated-documents?id=${documentId}`)
        const json = await res.json()
        if (json.success && json.document) {
          setDocument(json.document)

          // Try parsing combined JSON payload
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
            // plain markdown
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

  // Export handler
  const handleExport = async (format: 'pdf' | 'docx' | 'rubrics_docx' | 'excel' | 'zip') => {
    if (!document) return
    try {
      setExportingFormat(format)
      // Save changes first
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
        toast({ title: 'Descarga iniciada', description: `Tu archivo ${ext.toUpperCase()} está listo.`, variant: 'success' })
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

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#162874] mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Cargando paquete curricular CBSJC...</p>
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Bar Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
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
            3 Entregables Listos
          </Badge>
        </div>

        {/* Action Buttons */}
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
            className="bg-[#162874] hover:bg-[#0E1B4D] text-white text-xs font-bold shadow-sm rounded-xl h-9"
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
            1. Planning Book
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

        {/* TAB 1: PLANNING BOOK */}
        <TabsContent value="planning" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-slate-200 shadow-md rounded-2xl bg-white overflow-hidden">
                <div className="p-5 bg-[#0E1B4D] text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 shrink-0 drop-shadow">
                      <Image src="/logo.png" alt="Escudo CBSJC" fill className="object-contain" />
                    </div>
                    <div>
                      <span className="text-[10px] font-serif text-slate-300 block">Colegio bilingüe</span>
                      <h2 className="text-xs font-black uppercase tracking-wider text-white">
                        <span className="text-[#D71921]">San José</span> Campestre
                      </h2>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-300">
                    <p className="font-bold text-white">SJB-RGA006</p>
                    <p>{formatArea(document.area)}</p>
                  </div>
                </div>

                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Título de la Secuencia Didáctica</Label>
                    <h1 className="text-lg font-black text-slate-900">{document.title}</h1>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Contenido del Planning Book (Editable)</span>
                      {lastSaved && (
                        <span className="text-emerald-600 font-bold">
                          Guardado a las {lastSaved.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={planningMarkdown}
                      onChange={(e) => setPlanningMarkdown(e.target.value)}
                      rows={26}
                      className="font-mono text-xs leading-relaxed p-4 bg-white border-slate-300 focus:border-[#162874] rounded-xl"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Side Action Column */}
            <div className="space-y-5">
              <Card className="border-slate-200 shadow-md bg-white rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-[#0E1B4D] flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-[#D71921]" />
                    Descargar Planning Book
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Descarga la secuencia didáctica con el formato visual oficial del colegio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => handleExport('docx')}
                    disabled={exportingFormat !== null}
                    className="w-full h-11 bg-[#162874] hover:bg-[#0E1B4D] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      <span>Descargar Word (.docx)</span>
                    </div>
                    <span className="text-[10px] bg-[#0E1B4D] px-2 py-0.5 rounded font-mono">Word</span>
                  </Button>

                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={exportingFormat !== null}
                    className="w-full h-11 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Descargar PDF (.pdf)</span>
                    </div>
                    <span className="text-[10px] bg-red-900/60 px-2 py-0.5 rounded font-mono">PDF</span>
                  </Button>
                </CardContent>
              </Card>

              {/* Technical Details Card */}
              <Card className="border-slate-200 shadow-sm bg-slate-50/50 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Estructura Institucional SJB-RGA006
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 1. Identificación y Referentes (DBA/EBC)</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 2. Arco Antes, Durante y Después</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 3. Plan de Evaluación Continua</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 4. Pilares (35/35/20/10)</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 5. Rúbrica Menú de Desafíos</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 6. Bloque Cibercolegios</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 7. Bitácora de Secuencia</p>
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
              <Card className="border-amber-200 bg-amber-50/50 shadow-md rounded-2xl">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-amber-950 flex items-center gap-2">
                      <Copy className="h-4 w-4 text-amber-700" />
                      Bloque de Traslado Directo a Cibercolegios
                    </CardTitle>
                    <CardDescription className="text-xs text-amber-800">
                      Copia y pega este texto íntegro en la descripción de la tarea/evaluación en la plataforma Cibercolegios.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCopyCibercolegios}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm h-8"
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
                    className="bg-white border-amber-300 font-mono text-xs rounded-xl"
                  />
                </CardContent>
              </Card>

              {/* Rubrics Textarea */}
              <Card className="border-slate-200 shadow-md rounded-2xl bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-[#0E1B4D]">
                    Rúbricas Detalladas de la Secuencia Didáctica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={rubricsMarkdown}
                    onChange={(e) => setRubricsMarkdown(e.target.value)}
                    rows={20}
                    className="font-mono text-xs leading-relaxed p-4 bg-white border-slate-300 focus:border-[#162874] rounded-xl"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Side Action Column */}
            <div className="space-y-5">
              <Card className="border-slate-200 shadow-md bg-white rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-[#0E1B4D] flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-[#D71921]" />
                    Descargar Rúbricas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Exporta la matriz de evaluación y criterios en formato Word editable.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleExport('rubrics_docx')}
                    disabled={exportingFormat !== null}
                    className="w-full h-11 bg-[#162874] hover:bg-[#0E1B4D] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      <span>Descargar Rúbrica (.docx)</span>
                    </div>
                    <span className="text-[10px] bg-[#0E1B4D] px-2 py-0.5 rounded font-mono">Word</span>
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
                  <div className="p-3 bg-white rounded-xl border border-amber-300 font-medium">
                    <span className="font-bold text-amber-900 block">Gold (4.8 – 5.0)</span>
                    <span className="text-[11px] text-slate-500">Desempeño superior avanzado</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-300 font-medium">
                    <span className="font-bold text-slate-800 block">Silver (4.6 – 4.7)</span>
                    <span className="text-[11px] text-slate-500">Alto con elementos agregados</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-600 font-medium">
                    <span className="font-bold text-amber-800 block">Bronze (4.0 – 4.5)</span>
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
