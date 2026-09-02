'use client'

import { useState, useEffect, use, useRef, useMemo, useCallback } from 'react'
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
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatArea } from '@/lib/utils'
import type { GeneratedDocument } from '@/types'
import {
  parseMarkdownToBlocks,
  blocksToMarkdown,
  splitBlocksIntoPages,
  DocumentBlock,
} from '@/components/preview/document-parser'
import { WordPageSheet } from '@/components/preview/word-page-sheet'
import { WordToolbar } from '@/components/preview/word-toolbar'
import { RubricsMatrixEditor } from '@/components/preview/rubrics-matrix-editor'

interface PreviewPageProps {
  params: Promise<{ id: string }>
}

const SECTIONS_LIST = [
  { id: 'sec-1', label: '1. Identificación y Referentes', keyword: 'IDENTIFICACIÓN Y REFERENTES' },
  { id: 'sec-2', label: '2. Arco Pedagógico (Antes/Durante/Después)', keyword: 'ARCO PEDAGÓGICO' },
  { id: 'sec-3', label: '3. Plan de Evaluación Continua', keyword: 'PLAN DE EVALUACIÓN' },
  { id: 'sec-4', label: '4. Pilares y Competencias (35/35/20/10)', keyword: 'PILARES Y COMPETENCIAS' },
  { id: 'sec-5', label: '5. Rúbrica Menú de Desafíos', keyword: 'RÚBRICA GLOBAL' },
  { id: 'sec-6', label: '6. Bloque Cibercolegios', keyword: 'CIBERCOLEGIOS' },
  { id: 'sec-7', label: '7. Bitácora y Firmas', keyword: 'BITÁCORA' },
  { id: 'sec-8', label: '8. Anexos Evaluativos (Prueba/Lab/Oral)', keyword: 'ANEXO INSTITUCIONAL' },
]

export default function PreviewPage({ params }: PreviewPageProps) {
  const resolvedParams = use(params)
  const documentId = resolvedParams.id
  const { toast } = useToast()

  const [document, setDocument] = useState<GeneratedDocument | null>(null)
  const [loading, setLoading] = useState(true)

  // Document raw states
  const [planningMarkdown, setPlanningMarkdown] = useState('')
  const [rubricsMarkdown, setRubricsMarkdown] = useState('')
  const [cibercolegiosSnippet, setCibercolegiosSnippet] = useState('')
  const [excelMetadata, setExcelMetadata] = useState<any>(null)

  // Structured blocks for WYSIWYG editing
  const [blocks, setBlocks] = useState<DocumentBlock[]>([])

  // View mode: 'pages' (Word A4 paginated), 'continuous' (web layout), 'markdown' (raw text)
  const [viewMode, setViewMode] = useState<'pages' | 'continuous' | 'markdown'>('pages')
  const [isEditable, setIsEditable] = useState(true)
  const [zoomScale, setZoomScale] = useState(1)

  // Save & Dirty states
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)

  const documentContainerRef = useRef<HTMLDivElement>(null)

  // Fetch document details on mount
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/generated-documents?id=${documentId}`)
        const json = await res.json()
        if (json.success && json.document) {
          setDocument(json.document)

          let planMd = json.document.content
          let rubMd = json.document.content
          let ciberSnip = ''
          let xlsSpec = null

          try {
            const parsed = JSON.parse(json.document.content)
            if (parsed.planningBookMarkdown) {
              planMd = parsed.planningBookMarkdown
              rubMd = parsed.rubricsMarkdown || parsed.planningBookMarkdown
              ciberSnip = parsed.cibercolegiosSnippet || ''
              xlsSpec = parsed.excelSpec || null
            }
          } catch {
            // legacy plain markdown format
          }

          setPlanningMarkdown(planMd)
          setRubricsMarkdown(rubMd)
          setCibercolegiosSnippet(ciberSnip)
          setExcelMetadata(xlsSpec)

          // Parse markdown to blocks
          const parsedBlocks = parseMarkdownToBlocks(planMd)
          setBlocks(parsedBlocks)
          setIsDirty(false)
        } else {
          toast({
            title: 'Error',
            description: 'No se encontró la planeación solicitada.',
            variant: 'error',
          })
        }
      } catch (err) {
        console.error('Error fetching document:', err)
        toast({
          title: 'Error',
          description: 'Error al cargar el documento curricular.',
          variant: 'error',
        })
      } finally {
        setLoading(false)
      }
    }

    if (documentId) {
      fetchDoc()
    }
  }, [documentId])

  // Sync blocks to planningMarkdown whenever blocks change
  const handleUpdateBlock = useCallback(
    (blockId: string, updatedBlock: Partial<DocumentBlock>) => {
      setBlocks((prevBlocks) => {
        const nextBlocks = prevBlocks.map((b) => (b.id === blockId ? { ...b, ...updatedBlock } : b))
        const newMarkdown = blocksToMarkdown(nextBlocks)
        setPlanningMarkdown(newMarkdown)
        setIsDirty(true)
        return nextBlocks
      })
    },
    []
  )

  const handleAddBlock = useCallback((targetBlockId: string, newType: DocumentBlock['type']) => {
    setBlocks((prevBlocks) => {
      const index = prevBlocks.findIndex((b) => b.id === targetBlockId)
      const newBlock: DocumentBlock = {
        id: 'b_' + Math.random().toString(36).substring(2, 9),
        type: newType,
        content: newType === 'h3' ? 'NUEVO SUBTÍTULO' : 'Nuevo contenido...',
      }

      const nextBlocks = [...prevBlocks]
      nextBlocks.splice(index + 1, 0, newBlock)
      const newMarkdown = blocksToMarkdown(nextBlocks)
      setPlanningMarkdown(newMarkdown)
      setIsDirty(true)
      return nextBlocks
    })
  }, [])

  const handleDeleteBlock = useCallback((blockId: string) => {
    setBlocks((prevBlocks) => {
      if (prevBlocks.length <= 1) return prevBlocks
      const nextBlocks = prevBlocks.filter((b) => b.id !== blockId)
      const newMarkdown = blocksToMarkdown(nextBlocks)
      setPlanningMarkdown(newMarkdown)
      setIsDirty(true)
      return nextBlocks
    })
  }, [])

  // Handle raw markdown textarea changes
  const handleRawMarkdownChange = (newMd: string) => {
    setPlanningMarkdown(newMd)
    const newBlocks = parseMarkdownToBlocks(newMd)
    setBlocks(newBlocks)
    setIsDirty(true)
  }

  // Split blocks into A4 pages
  const pages = useMemo(() => {
    return splitBlocksIntoPages(blocks)
  }, [blocks])

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
        setIsDirty(false)
        toast({
          title: 'Cambios guardados con éxito',
          description: 'Documento curricular actualizado en el sistema institucional.',
          variant: 'success',
        })
      } else {
        throw new Error(json.error || 'Error al guardar')
      }
    } catch (err) {
      toast({
        title: 'Error al guardar',
        description: err instanceof Error ? err.message : 'No se pudieron guardar los cambios.',
        variant: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Keyboard shortcut Ctrl+S / Cmd+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [document, planningMarkdown, rubricsMarkdown, cibercolegiosSnippet, excelMetadata])

  // Export handler (Word, PDF, Excel, ZIP)
  const handleExport = async (format: 'pdf' | 'docx' | 'rubrics_docx' | 'excel' | 'zip') => {
    if (!document) return
    try {
      setExportingFormat(format)
      if (isDirty) {
        await handleSave()
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, format }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al exportar archivo')
      }

      if (json.downloadUrl) {
        const a = window.document.createElement('a')
        a.href = json.downloadUrl
        const ext =
          format === 'pdf'
            ? 'pdf'
            : format === 'excel'
            ? 'xlsx'
            : format === 'zip'
            ? 'zip'
            : 'docx'
        a.download = `${document.title}.${ext}`
        window.document.body.appendChild(a)
        a.click()
        window.document.body.removeChild(a)
        toast({
          title: 'Descarga completada',
          description: `El archivo ${ext.toUpperCase()} oficial del CBSJC ha sido generado.`,
          variant: 'success',
        })
      }
    } catch (err) {
      console.error('Export error:', err)
      toast({
        title: 'Error de exportación',
        description: err instanceof Error ? err.message : 'No se pudo generar la exportación.',
        variant: 'error',
      })
    } finally {
      setExportingFormat(null)
    }
  }

  // Scroll to specific section in document
  const handleScrollToSection = (sectionKeyword: string) => {
    if (!documentContainerRef.current) return
    const elements = documentContainerRef.current.querySelectorAll('h1, h2, h3, h4, th, div')
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement
      if (el.textContent && el.textContent.toUpperCase().includes(sectionKeyword.toUpperCase())) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        el.classList.add('bg-blue-100/50')
        setTimeout(() => el.classList.remove('bg-blue-100/50'), 2000)
        break
      }
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4">
        <Loader2 className="h-9 w-9 animate-spin text-[#0E1B4D] mx-auto" />
        <p className="text-sm font-bold text-slate-800">
          Cargando entorno curricular CBSJC (Plantilla SJB-RGA006)...
        </p>
        <p className="text-xs text-slate-500">
          Procesando estructura paginada A4 y matrices de evaluación.
        </p>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="text-base font-bold text-slate-800">Documento no encontrado</p>
        <Link href="/history">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Volver al Historial
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Global Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/history">
            <Button variant="ghost" size="sm" className="h-9 px-2.5 text-slate-600 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Historial
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <Badge className="bg-[#0E1B4D] text-xs font-bold">Planning Book SJB-RGA006</Badge>
          <Badge variant="outline" className="text-xs font-bold text-[#D71921] border-[#D71921]/30">
            18+ Páginas Oficiales
          </Badge>
          {document.grado && (
            <Badge variant="secondary" className="text-xs font-bold bg-slate-100 text-slate-800">
              Grado: {document.grado}
            </Badge>
          )}
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
            <span>Descargar Paquete ZIP (Completo)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="text-xs font-bold rounded-xl border-slate-300 h-9 text-slate-700"
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
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            <span>Guardar</span>
          </Button>
        </div>
      </div>

      {/* THREE MAIN TABS CONTAINER */}
      <Tabs defaultValue="planning" className="space-y-6">
        <TabsList className="bg-slate-200/80 p-1.5 rounded-2xl grid grid-cols-3 max-w-2xl">
          <TabsTrigger
            value="planning"
            className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-[#0E1B4D] data-[state=active]:text-white transition-all"
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            1. Planning Book Oficial
          </TabsTrigger>
          <TabsTrigger
            value="rubrics"
            className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-[#0E1B4D] data-[state=active]:text-white transition-all"
          >
            <TableProperties className="h-3.5 w-3.5 mr-1.5" />
            2. Rúbricas & Cibercolegios
          </TabsTrigger>
          <TabsTrigger
            value="excel"
            className="rounded-xl text-xs font-bold py-2 data-[state=active]:bg-[#0E1B4D] data-[state=active]:text-white transition-all"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
            3. Planilla Excel (.xlsx)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PLANNING BOOK (WORD-LIKE WYSIWYG CANVAS & TOOLBAR) */}
        <TabsContent value="planning" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left 3 Columns: Word-like Document Canvas */}
            <div className="lg:col-span-3 space-y-4" ref={documentContainerRef}>
              {/* Word-like Formatting & Navigation Toolbar */}
              <WordToolbar
                viewMode={viewMode}
                setViewMode={setViewMode}
                isEditable={isEditable}
                setIsEditable={setIsEditable}
                zoomScale={zoomScale}
                setZoomScale={setZoomScale}
                isDirty={isDirty}
                isSaving={isSaving}
                lastSaved={lastSaved}
                onSave={handleSave}
                onPrint={() => window.print()}
                onScrollToSection={handleScrollToSection}
                sectionsList={SECTIONS_LIST}
              />

              {/* VIEW MODE 1: PAGINATED A4 SHEETS (WORD-LIKE) */}
              {viewMode === 'pages' && (
                <div className="bg-slate-200/70 p-3 sm:p-8 rounded-3xl border border-slate-300 shadow-inner overflow-x-auto min-h-[1200px]">
                  {pages.map((page, pIdx) => (
                    <WordPageSheet
                      key={`page-${page.pageNumber}-${pIdx}`}
                      page={page}
                      pageIndex={pIdx}
                      totalPages={pages.length}
                      isEditable={isEditable}
                      zoomScale={zoomScale}
                      onUpdateBlock={handleUpdateBlock}
                      onAddBlock={handleAddBlock}
                      onDeleteBlock={handleDeleteBlock}
                    />
                  ))}
                </div>
              )}

              {/* VIEW MODE 2: CONTINUOUS WEB-LAYOUT VIEW */}
              {viewMode === 'continuous' && (
                <div className="bg-slate-100 p-4 sm:p-8 rounded-3xl border border-slate-200 shadow-inner flex justify-center">
                  <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl border border-slate-300 p-8 sm:p-14 space-y-6 min-h-[1100px]">
                    {/* Single Master Sheet Continuous Container */}
                    <div className="border-2 border-slate-700 rounded-sm overflow-hidden grid grid-cols-12 text-xs mb-6 bg-white">
                      <div className="col-span-2 p-3 bg-white border-r-2 border-slate-700 flex flex-col items-center justify-center">
                        <div className="relative w-16 h-16">
                          <Image
                            src="/cbsjc-crest.png"
                            alt="Escudo Oficial CBSJC"
                            fill
                            className="object-contain"
                            priority
                          />
                        </div>
                      </div>
                      <div className="col-span-7 p-3 border-r-2 border-slate-700 text-center flex flex-col justify-center bg-white space-y-0.5">
                        <h2 className="font-extrabold text-[#0E1B4D] text-xs uppercase tracking-wide">
                          Colegio Bilingüe San José Campestre
                        </h2>
                        <h3 className="font-black text-[#D71921] text-xs uppercase tracking-wide">
                          Planning Book Primary & Secondary
                        </h3>
                        <p className="text-[10px] text-slate-600 font-medium">
                          Secuencia Didáctica: Antes — Durante — Después · Formato SJB-RGA006
                        </p>
                      </div>
                      <div className="col-span-3 p-3 bg-slate-50 flex flex-col justify-center text-[10px] text-right space-y-0.5">
                        <p className="font-bold text-[#0E1B4D]">CÓDIGO: SJB-RGA006</p>
                        <p className="text-slate-600">VERSIÓN: 4</p>
                        <p className="text-slate-600">VIGENCIA: 2026</p>
                        <p className="font-bold text-slate-800">DOCUMENTO COMPLETO</p>
                      </div>
                    </div>

                    {/* Render All Blocks Continuously */}
                    {pages.map((p, idx) => (
                      <WordPageSheet
                        key={`cont-page-${idx}`}
                        page={p}
                        pageIndex={idx}
                        totalPages={pages.length}
                        isEditable={isEditable}
                        zoomScale={1}
                        onUpdateBlock={handleUpdateBlock}
                        onAddBlock={handleAddBlock}
                        onDeleteBlock={handleDeleteBlock}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW MODE 3: FULL MARKDOWN CODE EDITOR */}
              {viewMode === 'markdown' && (
                <Card className="border-slate-200 shadow-md rounded-2xl bg-white overflow-hidden p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-[#0E1B4D]">
                      Editor de Código Markdown de la Planeación Curricular
                    </Label>
                    <span className="text-xs text-slate-500 font-mono">
                      {planningMarkdown.length} caracteres
                    </span>
                  </div>
                  <Textarea
                    value={planningMarkdown}
                    onChange={(e) => handleRawMarkdownChange(e.target.value)}
                    rows={30}
                    className="font-mono text-xs leading-relaxed p-4 bg-slate-50 border-slate-300 focus:border-[#162874] rounded-xl text-slate-900"
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
                    Generado con todas las 18 tablas y anexos institucionales del CBSJC.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => handleExport('docx')}
                    disabled={exportingFormat !== null}
                    className="w-full h-12 bg-[#0E1B4D] hover:bg-[#162874] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      {exportingFormat === 'docx' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      <span>Descargar Word (.docx)</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                      Word Oficial
                    </span>
                  </Button>

                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={exportingFormat !== null}
                    className="w-full h-12 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs flex items-center justify-between px-4 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      {exportingFormat === 'pdf' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      <span>Descargar PDF (.pdf)</span>
                    </div>
                    <span className="text-[10px] bg-red-950/40 px-2 py-0.5 rounded font-mono">
                      PDF Imprimible
                    </span>
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
                    className="w-full bg-[#0E1B4D] hover:bg-[#162874] text-white text-xs font-bold rounded-xl mt-2 h-9"
                  >
                    {exportingFormat === 'zip' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <FolderArchive className="h-3.5 w-3.5 mr-1" />
                    )}
                    Descargar Paquete ZIP
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: RUBRICS & CIBERCOLEGIOS */}
        <TabsContent value="rubrics" className="space-y-6">
          <RubricsMatrixEditor
            rubricsMarkdown={rubricsMarkdown}
            setRubricsMarkdown={setRubricsMarkdown}
            cibercolegiosSnippet={cibercolegiosSnippet}
            setCibercolegiosSnippet={setCibercolegiosSnippet}
            onSave={handleSave}
            onExportRubricsDocx={() => handleExport('rubrics_docx')}
            isExporting={exportingFormat === 'rubrics_docx'}
          />
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
                {exportingFormat === 'excel' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
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
