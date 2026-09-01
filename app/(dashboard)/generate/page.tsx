'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  BookOpen,
  FileCheck2,
  UploadCloud,
  FileText,
  FileType,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  TableProperties,
  GraduationCap,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const AREAS = [
  'Ciencias Naturales y Educación Ambiental',
  'Matemáticas y Geometría',
  'Humanidades y Lengua Castellana',
  'Inglés (Bilingual Program)',
  'Ciencias Sociales, Historia y Democracia',
  'Educación Artística y Cultural',
  'Educación Física, Recreación y Deportes',
  'Tecnología e Informática',
  'Educación Religiosa, Ética y Valores',
  'Filosofía y Ciencias Políticas',
]

const GRADOS = [
  'Transición / Preescolar',
  'Grado 1°',
  'Grado 2°',
  'Grado 3°',
  'Grado 4°',
  'Grado 5°',
  'Grado 6°',
  'Grado 7°',
  'Grado 8°',
  'Grado 9°',
  'Grado 10°',
  'Grado 11°',
]

const PERIODOS = ['Periodo I', 'Periodo II', 'Periodo III', 'Periodo IV']

export default function GeneratePage() {
  const router = useRouter()
  const { toast } = useToast()

  // Form states
  const [docente, setDocente] = useState('')
  const [area, setArea] = useState(AREAS[0])
  const [grado, setGrado] = useState('Grado 6°')
  const [periodo, setPeriodo] = useState('Periodo I')
  const [semanas, setSemanas] = useState('4 semanas (sesiones de 90 min)')
  const [tema, setTema] = useState('')
  const [additionalInstructions, setAdditionalInstructions] = useState('')

  // Mandatory document slots
  const [planDeAreaFile, setPlanDeAreaFile] = useState<File | null>(null)
  const [siapFile, setSiapFile] = useState<File | null>(null)
  const [cuadernilloFile, setCuadernilloFile] = useState<File | null>(null)

  // Additional multi-documents slot
  const [adicionalesFiles, setAdicionalesFiles] = useState<File[]>([])

  // Refs for hidden inputs
  const planRef = useRef<HTMLInputElement>(null)
  const siapRef = useRef<HTMLInputElement>(null)
  const cuadernilloRef = useRef<HTMLInputElement>(null)
  const adicionalesRef = useRef<HTMLInputElement>(null)

  // Progress state
  const [isGenerating, setIsGenerating] = useState(false)
  const [stepMessage, setStepMessage] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)

  // File validator (PDF, DOCX, MD)
  const validateAndGetFile = (e: React.ChangeEvent<HTMLInputElement>): File | null => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const name = file.name.toLowerCase()
      const isValid =
        name.endsWith('.pdf') ||
        name.endsWith('.docx') ||
        name.endsWith('.doc') ||
        name.endsWith('.md') ||
        name.endsWith('.txt')

      if (!isValid) {
        toast({
          title: 'Formato no admitido',
          description: 'Únicamente se permiten archivos en formato PDF (.pdf), Word (.docx) o Markdown (.md)',
          variant: 'error',
        })
        return null
      }
      return file
    }
    return null
  }

  const handleAddAdicionales = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((file) => {
        const name = file.name.toLowerCase()
        return (
          name.endsWith('.pdf') ||
          name.endsWith('.docx') ||
          name.endsWith('.doc') ||
          name.endsWith('.md') ||
          name.endsWith('.txt')
        )
      })
      setAdicionalesFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeAdicional = (index: number) => {
    setAdicionalesFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!docente.trim()) {
      toast({ title: 'Campo requerido', description: 'Ingresa el nombre del docente.', variant: 'warning' })
      return
    }

    if (!tema.trim()) {
      toast({ title: 'Campo requerido', description: 'Ingresa el tema o título de la secuencia didáctica.', variant: 'warning' })
      return
    }

    if (!planDeAreaFile) {
      toast({ title: 'Plan de Área requerido', description: 'Debes subir el documento rector del Plan de Área.', variant: 'warning' })
      return
    }

    if (!siapFile) {
      toast({ title: 'SIAP requerido', description: 'Debes subir el documento del SIAP institucional.', variant: 'warning' })
      return
    }

    if (!cuadernilloFile) {
      toast({ title: 'Cuadernillo requerido', description: 'Debes subir el Cuadernillo o guía de la asignatura.', variant: 'warning' })
      return
    }

    try {
      setIsGenerating(true)
      setProgressPercent(15)
      setStepMessage('Extrayendo texto y analizando documentos rectores (Plan de Área, SIAP, Cuadernillo)...')

      const formData = new FormData()
      formData.append('docente', docente.trim())
      formData.append('area', area)
      formData.append('grado', grado)
      formData.append('periodo', periodo)
      formData.append('semanas', semanas.trim())
      formData.append('tema', tema.trim())
      formData.append('additionalInstructions', additionalInstructions.trim())

      formData.append('plan_de_area', planDeAreaFile)
      formData.append('siap', siapFile)
      formData.append('cuadernillo', cuadernilloFile)

      adicionalesFiles.forEach((file) => {
        formData.append('adicionales', file)
      })

      setProgressPercent(45)
      setStepMessage('Estructurando Planning Book oficial (SJB-RGA006), Rúbricas y Planilla con Gemini 2.0 Flash...')

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al generar la planeación')
      }

      setProgressPercent(100)
      setStepMessage('¡Planeación, Rúbricas y Planilla de Notas generadas con éxito!')

      toast({
        title: '¡Paquete Curricular Listo!',
        description: 'Se han generado los 3 entregables oficiales del CBSJC.',
        variant: 'success',
      })

      router.push(`/preview/${json.documentId}`)
    } catch (err) {
      console.error('Generation error:', err)
      toast({
        title: 'Error de generación',
        description: err instanceof Error ? err.message : 'No se pudo completar la generación.',
        variant: 'error',
      })
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0E1B4D]">Generador Oficial de Planeación Curricular</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sube los 3 documentos rectores obligatorios, ingresa los parámetros pedagógicos y genera simultáneamente el{' '}
          <strong className="text-slate-800 font-semibold">Planning Book (SJB-RGA006)</strong>, las{' '}
          <strong className="text-slate-800 font-semibold">Rúbricas de Evaluación</strong> y la{' '}
          <strong className="text-slate-800 font-semibold">Planilla de Notas en Excel (.xlsx)</strong>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: MANDATORY RECTOR DOCUMENTS */}
        <Card className="border-slate-200 shadow-md rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100">
            <CardTitle className="text-base text-[#0E1B4D] font-bold flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-[#D71921]" />
              1. Documentos Rectores Obligatorios y Complementarios
            </CardTitle>
            <CardDescription>
              Formatos permitidos: <strong>PDF (.pdf), Word (.docx) o Markdown (.md)</strong>. El motor RAG utilizará estos archivos como fuente de verdad.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* SLOT 1: Plan de Área */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#0E1B4D] flex items-center justify-between">
                  <span>1. Plan de Área *</span>
                  <Badge variant="outline" className="text-[10px] text-[#D71921] border-[#D71921]/30">Obligatorio</Badge>
                </Label>
                <div
                  onClick={() => planRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all min-h-[110px] flex flex-col items-center justify-center ${
                    planDeAreaFile
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-[#162874] bg-slate-50/60 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    ref={planRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.md,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = validateAndGetFile(e)
                      if (f) setPlanDeAreaFile(f)
                    }}
                  />
                  {planDeAreaFile ? (
                    <div className="flex items-center gap-2 text-left">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-900 truncate max-w-[170px]">{planDeAreaFile.name}</p>
                        <p className="text-[10px] text-emerald-700">{(planDeAreaFile.size / 1024).toFixed(0)} KB • Listo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <FileText className="h-6 w-6 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">Subir Plan de Área</p>
                      <p className="text-[10px] text-slate-400">PDF, Word o Markdown</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SLOT 2: SIAP */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#0E1B4D] flex items-center justify-between">
                  <span>2. SIAP Institucional *</span>
                  <Badge variant="outline" className="text-[10px] text-[#D71921] border-[#D71921]/30">Obligatorio</Badge>
                </Label>
                <div
                  onClick={() => siapRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all min-h-[110px] flex flex-col items-center justify-center ${
                    siapFile
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-[#162874] bg-slate-50/60 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    ref={siapRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.md,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = validateAndGetFile(e)
                      if (f) setSiapFile(f)
                    }}
                  />
                  {siapFile ? (
                    <div className="flex items-center gap-2 text-left">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-900 truncate max-w-[170px]">{siapFile.name}</p>
                        <p className="text-[10px] text-emerald-700">{(siapFile.size / 1024).toFixed(0)} KB • Listo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <FileText className="h-6 w-6 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">Subir Documento SIAP</p>
                      <p className="text-[10px] text-slate-400">PDF, Word o Markdown</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SLOT 3: Cuadernillo */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#0E1B4D] flex items-center justify-between">
                  <span>3. Cuadernillo de Asignatura *</span>
                  <Badge variant="outline" className="text-[10px] text-[#D71921] border-[#D71921]/30">Obligatorio</Badge>
                </Label>
                <div
                  onClick={() => cuadernilloRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all min-h-[110px] flex flex-col items-center justify-center ${
                    cuadernilloFile
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-[#162874] bg-slate-50/60 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    ref={cuadernilloRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.md,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = validateAndGetFile(e)
                      if (f) setCuadernilloFile(f)
                    }}
                  />
                  {cuadernilloFile ? (
                    <div className="flex items-center gap-2 text-left">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-900 truncate max-w-[170px]">{cuadernilloFile.name}</p>
                        <p className="text-[10px] text-emerald-700">{(cuadernilloFile.size / 1024).toFixed(0)} KB • Listo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <FileText className="h-6 w-6 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">Subir Cuadernillo</p>
                      <p className="text-[10px] text-slate-400">PDF, Word o Markdown</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SLOT 4: Documentos Adicionales / Complementarios (Multi-file) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-[#0E1B4D]">
                    4. Documentos Adicionales / Complementarios (Opcional - Ilimitado)
                  </Label>
                  <p className="text-[11px] text-slate-400">
                    Sube documentos específicos de tu área (ej. PRAE en Ciencias Naturales, guías de laboratorio, rúbricas transversales).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adicionalesRef.current?.click()}
                  className="text-xs font-semibold rounded-xl border-slate-300 flex items-center gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-[#D71921]" />
                  Agregar Archivo
                </Button>
                <input
                  ref={adicionalesRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.md,.txt"
                  className="hidden"
                  onChange={handleAddAdicionales}
                />
              </div>

              {adicionalesFiles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {adicionalesFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileType className="h-4 w-4 text-[#162874] shrink-0" />
                        <span className="truncate font-medium text-slate-800">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAdicional(idx)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: PEDAGOGICAL PARAMETERS */}
        <Card className="border-slate-200 shadow-md rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100">
            <CardTitle className="text-base text-[#0E1B4D] font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#D71921]" />
              2. Parámetros de la Secuencia Didáctica
            </CardTitle>
            <CardDescription>
              Información de identificación docente y enfoque de la secuencia.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="docente">Docente(s) Responsable(s) *</Label>
                <Input
                  id="docente"
                  placeholder="Ej: Lic. Simón Barrera & Prof. Carolina Gómez"
                  value={docente}
                  onChange={(e) => setDocente(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area">Área / Asignatura *</Label>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger id="area" className="rounded-xl">
                    <SelectValue placeholder="Selecciona el área" />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="grado">Grado / Grupo *</Label>
                <Select value={grado} onValueChange={setGrado}>
                  <SelectTrigger id="grado" className="rounded-xl">
                    <SelectValue placeholder="Grado" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADOS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="periodo">Período / Subciclo *</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger id="periodo" className="rounded-xl">
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="semanas">Número de Semanas / Fechas</Label>
                <Input
                  id="semanas"
                  placeholder="Ej: 4 semanas (Semana 1 a 4) · 90 min"
                  value={semanas}
                  onChange={(e) => setSemanas(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tema">Tema o Pregunta de Sentido de la Secuencia *</Label>
              <Input
                id="tema"
                placeholder="Ej: La célula como unidad funcional y estructural de los seres vivos"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                required
                className="rounded-xl font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instructions" className="flex items-center justify-between">
                <span>Directrices Didácticas Específicas / Adaptaciones (Opcional)</span>
                <span className="text-[11px] font-normal text-slate-400">Énfasis del docente</span>
              </Label>
              <Textarea
                id="instructions"
                rows={3}
                placeholder="Ej: Enfatizar la fase DURANTE con práctica de laboratorio. Articular con el proyecto PRAE y diseñar rúbrica Menú de Desafíos con producto final tipo póster científico."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: GENERATION SUMMARY & CTA */}
        <div className="p-6 rounded-2xl bg-[#0E1B4D] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D71921] uppercase tracking-wider">
              <GraduationCap className="h-5 w-5 text-white" />
              <span>Triple Entregable Automatizado CBSJC</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed max-w-xl">
              Al hacer clic en <strong>Generar</strong>, el sistema procesará los documentos rectores y creará simultáneamente:
              <br />
              • 📘 <strong>Planning Book Oficial (SJB-RGA006)</strong> en Word (.docx) y PDF.
              <br />
              • 🎯 <strong>Rúbricas Evaluativas</strong> con bloque de traslado a Cibercolegios.
              <br />
              • 📊 <strong>Planilla de Notas en Excel (.xlsx)</strong> con ponderaciones 35/35/20/10 y fórmulas automáticas.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isGenerating}
            className="w-full md:w-auto h-14 px-8 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-sm shadow-lg transition-all rounded-xl shrink-0 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Sparkles className="h-5 w-5 animate-spin" />
                <span>Generando Entregables...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Generar Planeación Completa</span>
              </>
            )}
          </Button>
        </div>

        {/* Progress Tracker Modal / Banner */}
        {isGenerating && (
          <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#0E1B4D]">
              <span>{stepMessage}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#D71921] h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
