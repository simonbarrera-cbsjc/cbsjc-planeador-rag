'use client'

import { useState } from 'react'
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
  Layers,
  GraduationCap,
  Globe,
  Loader2,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type {
  DocumentType,
  DocumentCategory,
  DocumentArea,
  Language,
  Periodo,
} from '@/types'

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string; desc: string }> = [
  {
    value: 'planeador',
    label: 'Planeador de Clase (Lesson Plan)',
    desc: 'Secuencia didáctica con momentos pedagógicos (Inicio, Desarrollo, Cierre), DBA, competencias y DUA.',
  },
  {
    value: 'plan_area',
    label: 'Plan de Área Curricular',
    desc: 'Estructura anual/periódica de contenidos, indicadores de desempeño, estándares y metodología bilingüe.',
  },
  {
    value: 'informe',
    label: 'Informe Académico / Pedagógico',
    desc: 'Diagnóstico de competencias, fortalezas, debilidades y plan de mejoramiento pedagógico.',
  },
  {
    value: 'circular',
    label: 'Circular Informativa Institucional',
    desc: 'Comunicación formal para padres, docentes o comunidad con directrices y cronogramas.',
  },
  {
    value: 'proyecto_pedagogico',
    label: 'Proyecto Pedagógico Transversal',
    desc: 'Propuesta pedagógica con justificación, objetivos, cronograma y articulación con el PEI.',
  },
]

const CATEGORIES: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'primaria', label: 'Primaria (1° a 5°)' },
  { value: 'secundaria', label: 'Secundaria (6° a 9°)' },
  { value: 'bachillerato', label: 'Media / Bachillerato (10° y 11°)' },
  { value: 'general', label: 'General Institucional' },
]

const AREAS: Array<{ value: DocumentArea; label: string }> = [
  { value: 'matematicas', label: 'Matemáticas' },
  { value: 'ciencias', label: 'Ciencias Naturales y Educación Ambiental' },
  { value: 'humanidades', label: 'Humanidades y Lengua Castellana' },
  { value: 'ingles', label: 'Inglés (Bilingual Program)' },
  { value: 'sociales', label: 'Ciencias Sociales e Historia' },
  { value: 'artes', label: 'Educación Artística' },
  { value: 'educacion_fisica', label: 'Educación Física y Deportes' },
  { value: 'tecnologia', label: 'Tecnología e Informática' },
  { value: 'religion', label: 'Ética, Valores y Religión' },
  { value: 'general', label: 'General / Directivo' },
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

const PERIODOS: Array<{ value: Periodo; label: string }> = [
  { value: 'I', label: 'Periodo I' },
  { value: 'II', label: 'Periodo II' },
  { value: 'III', label: 'Periodo III' },
  { value: 'IV', label: 'Periodo IV' },
]

export default function GeneratePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [documentType, setDocumentType] = useState<DocumentType>('planeador')
  const [title, setTitle] = useState('')
  const [nivel, setNivel] = useState<DocumentCategory>('primaria')
  const [area, setArea] = useState<DocumentArea>('matematicas')
  const [grado, setGrado] = useState('Grado 3°')
  const [periodo, setPeriodo] = useState<Periodo>('I')
  const [language, setLanguage] = useState<Language>('es')
  const [additionalInstructions, setAdditionalInstructions] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [stepMessage, setStepMessage] = useState('')

  const selectedTypeObj = DOCUMENT_TYPES.find((t) => t.value === documentType)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast({
        title: 'Título requerido',
        description: 'Por favor asigna un título descriptivo al documento.',
        variant: 'warning',
      })
      return
    }

    try {
      setIsGenerating(true)
      setStepMessage('Buscando fragmentos relevantes en documentos rectores...')

      const payload = {
        documentType,
        language,
        nivel,
        area,
        grado,
        periodo,
        additionalInstructions,
        title,
      }

      setStepMessage('Generando contenido pedagógico con Gemini 2.0 Flash...')

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al generar el documento')
      }

      toast({
        title: '¡Documento generado con éxito!',
        description: `Se utilizaron ${json.sourcesUsed || 0} fragmentos de la base de conocimiento del CBSJC.`,
        variant: 'success',
      })

      // Redirect to preview and editor
      router.push(`/preview/${json.documentId}`)
    } catch (err) {
      console.error('Generation error:', err)
      toast({
        title: 'Error de generación',
        description: err instanceof Error ? err.message : 'No se pudo generar el documento.',
        variant: 'error',
      })
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-[#0E1B4D]">Generador Curricular Inteligente</h1>
        <p className="text-sm text-slate-500 mt-1">
          Crea documentos pedagógicos e institucionales altamente estructurados a partir de los lineamientos del Colegio Bilingüe San José Campestre.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form Column (2 cols) */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 shadow-md rounded-2xl bg-white">
            <CardHeader>
              <CardTitle className="text-base text-[#0E1B4D] font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#D71921]" />
                Parámetros del Documento
              </CardTitle>
              <CardDescription>
                Define el tipo de documento, nivel, área y las instrucciones didácticas deseadas.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Document Type Selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="docType">Tipo de Documento Institucional *</Label>
                  <Select
                    value={documentType}
                    onValueChange={(val) => {
                      setDocumentType(val as DocumentType)
                      if (!title) {
                        const t = DOCUMENT_TYPES.find((d) => d.value === val)
                        if (t) setTitle(`${t.label}`)
                      }
                    }}
                  >
                    <SelectTrigger id="docType" className="h-11 rounded-xl">
                      <SelectValue placeholder="Selecciona el tipo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title">Título del Documento *</Label>
                  <Input
                    id="title"
                    placeholder="Ej: Secuencia Didáctica: Fracciones y Resolución de Problemas"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                {/* Language and Level Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="language">Idioma de Salida *</Label>
                    <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
                      <SelectTrigger id="language" className="rounded-xl">
                        <SelectValue placeholder="Idioma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español (Estándar Institucional)</SelectItem>
                        <SelectItem value="en">English (Bilingual Curricula)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nivel">Nivel Educativo *</Label>
                    <Select value={nivel} onValueChange={(val) => setNivel(val as DocumentCategory)}>
                      <SelectTrigger id="nivel" className="rounded-xl">
                        <SelectValue placeholder="Nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Area, Grade, Period */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="area">Área *</Label>
                    <Select value={area} onValueChange={(val) => setArea(val as DocumentArea)}>
                      <SelectTrigger id="area" className="rounded-xl">
                        <SelectValue placeholder="Área" />
                      </SelectTrigger>
                      <SelectContent>
                        {AREAS.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="grado">Grado</Label>
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
                    <Label htmlFor="periodo">Periodo</Label>
                    <Select value={periodo} onValueChange={(val) => setPeriodo(val as Periodo)}>
                      <SelectTrigger id="periodo" className="rounded-xl">
                        <SelectValue placeholder="Periodo" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODOS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Additional Instructions */}
                <div className="space-y-1.5">
                  <Label htmlFor="instructions" className="flex items-center justify-between">
                    <span>Instrucciones Específicas / Temas Clave (Opcional)</span>
                    <span className="text-[11px] font-normal text-slate-400">Lenguaje natural</span>
                  </Label>
                  <Textarea
                    id="instructions"
                    rows={4}
                    placeholder="Ej: Enfatizar el uso de material concreto para el Momento de Exploración. Incluir actividades en parejas para la práctica guiada y rúbrica para evaluación formativa adaptada a DUA."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full h-12 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 rounded-xl"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{stepMessage}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      <span>Generar Documento con RAG</span>
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Info Column (1 col) */}
        <div className="space-y-6">
          {/* Selected Document Info */}
          <Card className="border-slate-200 shadow-sm bg-slate-50/50 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#0E1B4D] flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-[#D71921]" />
                Estructura de Generación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{selectedTypeObj?.label}</p>
              <p className="leading-relaxed text-slate-500">{selectedTypeObj?.desc}</p>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <p className="font-bold text-slate-700">Garantías del sistema:</p>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Alineado a los Derechos Básicos de Aprendizaje (DBA).</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Incorpora momentos pedagógicos oficiales.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Exportable directamente a PDF, Word (.docx) y Google Docs.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Help Card */}
          <Card className="border-slate-200 shadow-sm bg-[#0E1B4D] text-white rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#D71921]">
                <Globe className="h-4 w-4" />
                <span className="text-white">Enfoque Bilingüe CBSJC</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Si seleccionas idioma <strong>English</strong>, el sistema generará los planes y vocabulario en inglés de acuerdo con los estándares internacionales del colegio.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
