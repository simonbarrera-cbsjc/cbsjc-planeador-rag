'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  Loader2,
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
  const [semanasEfectivas, setSemanasEfectivas] = useState('4 semanas efectivas de clase directa')
  const [tema, setTema] = useState('')
  const [additionalInstructions, setAdditionalInstructions] = useState('')

  // Mandatory document slots
  const [planDeAreaFile, setPlanDeAreaFile] = useState<File | null>(null)
  const [siapFile, setSiapFile] = useState<File | null>(null)
  const [cuadernilloFile, setCuadernilloFile] = useState<File | null>(null)

  // Additional multi-documents slot
  const [adicionalesFiles, setAdicionalesFiles] = useState<File[]>([])

  // Validation errors list
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Refs for hidden inputs and sections
  const planRef = useRef<HTMLInputElement>(null)
  const siapRef = useRef<HTMLInputElement>(null)
  const cuadernilloRef = useRef<HTMLInputElement>(null)
  const adicionalesRef = useRef<HTMLInputElement>(null)
  const docenteInputRef = useRef<HTMLInputElement>(null)
  const temaInputRef = useRef<HTMLInputElement>(null)

  // Progress state
  const [isGenerating, setIsGenerating] = useState(false)
  const [stepMessage, setStepMessage] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)

  // Pre-populate docente from user session
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle()
          const fullName = (profile as { full_name?: string } | null)?.full_name
          if (fullName && !docente) {
            setDocente(fullName)
          } else if (user.email && !docente) {
            setDocente(user.email.split('@')[0])
          }
        }
      } catch (err) {
        console.warn('Could not prefill user profile:', err)
      }
    }
    loadUserProfile()
  }, [])

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
      setValidationErrors((prev) => prev.filter((err) => !err.includes('documento') && !err.includes(name)))
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

    const errors: string[] = []

    if (!planDeAreaFile) {
      errors.push('Subir el documento rector "1. Plan de Área"')
    }
    if (!siapFile) {
      errors.push('Subir el documento rector "2. SIAP Institucional"')
    }
    if (!cuadernilloFile) {
      errors.push('Subir el documento rector "3. Cuadernillo de Asignatura"')
    }
    if (!docente.trim()) {
      errors.push('Ingresar el "Docente(s) Responsable(s)"')
    }
    if (!tema.trim()) {
      errors.push('Ingresar el "Tema o Pregunta de Sentido"')
    }

    if (errors.length > 0) {
      setValidationErrors(errors)
      toast({
        title: 'Faltan campos obligatorios',
        description: `Por favor completa: ${errors[0]}`,
        variant: 'warning',
      })

      if (!planDeAreaFile) {
        planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (!docente.trim()) {
        docenteInputRef.current?.focus()
      } else if (!tema.trim()) {
        temaInputRef.current?.focus()
      }
      return
    }

    setValidationErrors([])

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
      formData.append('semanasEfectivas', semanasEfectivas.trim())
      formData.append('tema', tema.trim())
      formData.append('additionalInstructions', additionalInstructions.trim())

      formData.append('plan_de_area', planDeAreaFile!)
      formData.append('siap', siapFile!)
      formData.append('cuadernillo', cuadernilloFile!)

      adicionalesFiles.forEach((file) => {
        formData.append('adicionales', file)
      })

      // Simulate dynamic progression while AI runs in parallel
      const timer1 = setTimeout(() => {
        setProgressPercent(45)
        setStepMessage('Ejecutando motor multi-etapa: Generando Identificación y Arco Pedagógico (Semanas 1 a 4)...')
      }, 4000)

      const timer2 = setTimeout(() => {
        setProgressPercent(75)
        setStepMessage('Generando Rúbricas Menú de Desafíos, Planilla de Notas y Evaluaciones Finales...')
      }, 12000)

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      clearTimeout(timer1)
      clearTimeout(timer2)

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al generar la planeación')
      }

      setProgressPercent(100)
      setStepMessage('¡Planeación de 18+ páginas, Rúbricas y Planilla generadas con éxito!')

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
                <Label htmlFor="docente" className={validationErrors.some(e => e.includes('Docente')) ? 'text-red-600 font-bold' : ''}>
                  Docente(s) Responsable(s) *
                </Label>
                <Input
                  ref={docenteInputRef}
                  id="docente"
                  placeholder="Ej: Lic. Simón Barrera & Prof. Carolina Gómez"
                  value={docente}
                  onChange={(e) => {
                    setDocente(e.target.value)
                    setValidationErrors((prev) => prev.filter((err) => !err.includes('Docente')))
                  }}
                  required
                  className={`rounded-xl ${validationErrors.some(e => e.includes('Docente')) ? 'border-red-500 bg-red-50/30' : ''}`}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                <Label htmlFor="semanas">Semanas Totales / Fechas</Label>
                <Input
                  id="semanas"
                  placeholder="Ej: 4 semanas (1 feb - 28 feb)"
                  value={semanas}
                  onChange={(e) => setSemanas(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="semanasEfectivas" className="flex items-center justify-between text-[#0E1B4D] font-bold">
                  <span>Semanas Efectivas *</span>
                  <Badge variant="outline" className="text-[9px] text-[#162874] border-[#162874]/30">Docencia neta</Badge>
                </Label>
                <Input
                  id="semanasEfectivas"
                  placeholder="Ej: 4 semanas efectivas de clase (o 3)"
                  value={semanasEfectivas}
                  onChange={(e) => setSemanasEfectivas(e.target.value)}
                  className="rounded-xl font-medium border-[#162874]/40 bg-blue-50/20"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 -mt-2">
              💡 <strong>Semanas efectivas de clase:</strong> Número de semanas de clase directa en aula (excluyendo semanas de exámenes institucionales, eventos o recesos). El sistema distribuirá los <strong>micro-porcentajes evaluativos (SABER, HACER, SER, CONVIVIR)</strong> entre estas semanas efectivas de modo que su sumatoria exacta dé el porcentaje total del período.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="tema" className={validationErrors.some(e => e.includes('Tema')) ? 'text-red-600 font-bold' : ''}>
                Tema o Pregunta de Sentido de la Secuencia *
              </Label>
              <Input
                ref={temaInputRef}
                id="tema"
                placeholder="Ej: La célula como unidad funcional y estructural de los seres vivos"
                value={tema}
                onChange={(e) => {
                  setTema(e.target.value)
                  setValidationErrors((prev) => prev.filter((err) => !err.includes('Tema')))
                }}
                required
                className={`rounded-xl font-medium ${validationErrors.some(e => e.includes('Tema')) ? 'border-red-500 bg-red-50/30' : ''}`}
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

        {/* Validation Errors Box */}
        {validationErrors.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Por favor completa los siguientes campos obligatorios antes de generar:</span>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 pl-1 text-amber-800">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* SECTION 3: GENERATION SUMMARY & CTA */}
        <div className="p-6 rounded-2xl bg-[#0E1B4D] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D71921] uppercase tracking-wider">
              <GraduationCap className="h-5 w-5 text-white" />
              <span>Triple Entregable Automatizado CBSJC</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed max-w-xl">
              Al hacer clic en <strong className="text-white">Generar</strong>, el motor RAG procesará los documentos rectores y creará simultáneamente:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-200">
                <BookOpen className="h-3.5 w-3.5 text-[#D71921] shrink-0" />
                <span>Planning Book (Word & PDF)</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-200">
                <TableProperties className="h-3.5 w-3.5 text-white shrink-0" />
                <span>Rúbricas & Cibercolegios</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-200">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Planilla de Notas Excel (.xlsx)</span>
              </div>
            </div>
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
          <div className="p-6 rounded-2xl bg-blue-50 border-2 border-blue-300 shadow-lg space-y-3 animate-pulse">
            <div className="flex items-center justify-between text-xs font-bold text-[#0E1B4D]">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#D71921]" />
                {stepMessage}
              </span>
              <span className="text-sm font-black text-[#D71921]">{progressPercent}%</span>
            </div>
            <div className="w-full bg-blue-200 h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#D71921] h-full transition-all duration-700 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Por favor no cierres esta pestaña. Gemini está estructurando ~65.000 caracteres (18 a 24 páginas). Tiempo estimado: 25 a 35 segundos.
            </p>
          </div>
        )}
      </form>
    </div>
  )
}
