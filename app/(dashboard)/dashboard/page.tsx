import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  FileText,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Calendar,
  History,
  GraduationCap,
  FileSpreadsheet,
  TableProperties,
  Layers,
  FolderSync,
  Cpu,
  Eye,
} from 'lucide-react'
import { formatDate, formatArea } from '@/lib/utils'
import type { GeneratedDocument } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch user's generated documents
  const { data: generatedDocsData } = await supabase
    .from('generated_documents')
    .select('id, title, document_type, language, area, nivel, grado, periodo, status, created_at')
    .order('created_at', { ascending: false })
    .limit(6)

  // Fetch count of source documents in RAG
  const { count: sourceDocsCount } = await supabase
    .from('source_documents')
    .select('*', { count: 'exact', head: true })

  const generatedDocs = (generatedDocsData || []) as GeneratedDocument[]
  const totalGenerated = generatedDocs.length
  const totalRAGDocs = sourceDocsCount || 0

  return (
    <div className="space-y-8">
      {/* Institutional Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0E1B4D] via-[#162874] to-[#0A1435] text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-white/10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#D71921]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-[#A6174B]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4 max-w-2xl relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 shrink-0 drop-shadow">
              <Image
                src="/logo.png"
                alt="Escudo CBSJC"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <span className="text-[11px] font-serif uppercase tracking-wider text-slate-300 block">
                Colegio bilingüe
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                <span className="text-[#D71921]">San José</span> Campestre
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
            Sistema Oficial de Planeación Curricular & RAG
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Genera en un único proceso automatizado el <strong>Planning Book (SJB-RGA006)</strong>, las <strong>Rúbricas Evaluativas</strong> y la <strong>Planilla de Notas en Excel (.xlsx)</strong> a partir del Plan de Área, SIAP y Cuadernillo de Asignatura.
          </p>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Badge className="bg-white/10 border-white/20 text-white text-[11px] px-3 py-1 font-semibold flex items-center gap-1.5 backdrop-blur-md">
              <GraduationCap className="h-3.5 w-3.5 text-[#D71921]" />
              Formato SJB-RGA006
            </Badge>
            <Badge className="bg-emerald-950/60 border-emerald-500/40 text-emerald-300 text-[11px] px-3 py-1 font-semibold flex items-center gap-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Apoyado en Gemini
            </Badge>
            <Badge className="bg-[#030C26] border-[#A6174B]/40 text-pink-200 text-[11px] px-3 py-1 font-semibold flex items-center gap-1.5 shadow-[0_0_10px_rgba(166,23,75,0.2)]">
              <Cpu className="h-3.5 w-3.5 text-[#A6174B]" />
              Scibaru AI Engine
            </Badge>
          </div>
        </div>

        {/* Hero CTA Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 relative z-10 w-full lg:w-auto">
          <Link href="/generate" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-[#D71921] hover:bg-[#B81219] text-white font-bold shadow-lg h-12 px-6 rounded-xl flex items-center justify-center gap-2.5 transition-transform hover:scale-[1.02]">
              <Sparkles className="h-4 w-4" />
              <span>Generar Nueva Planeación</span>
            </Button>
          </Link>
          <Link href="/history" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/20 h-12 px-6 rounded-xl flex items-center justify-center gap-2 backdrop-blur-md font-semibold"
            >
              <History className="h-4 w-4 text-emerald-400" />
              <span>Ver Historial Completo</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Planeaciones Generadas</span>
            <div className="w-7 h-7 rounded-lg bg-[#162874]/10 text-[#162874] flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#0E1B4D]">{totalGenerated}</p>
          <p className="text-[11px] text-slate-400">En tu cuenta institucional</p>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Documentos Rectores</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#0E1B4D]">{totalRAGDocs}</p>
          <p className="text-[11px] text-slate-400">Planes de área, SIAP y guías</p>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Entregables por Secuencia</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700">3 en 1</p>
          <p className="text-[11px] text-slate-400">Word, PDF y Excel automáticos</p>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Formato Institucional</span>
            <div className="w-7 h-7 rounded-lg bg-[#D71921]/10 text-[#D71921] flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#D71921]">SJB-RGA006</p>
          <p className="text-[11px] text-slate-400">Vigencia 2026 oficial</p>
        </Card>
      </div>

      {/* Feature Triple Deliverable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#162874]/10 text-[#162874] flex items-center justify-center font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0E1B4D]">1. Planning Book (SJB-RGA006)</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Secuencia didáctica oficial: Referentes DBA/EBC, Arco Antes-Durante-Después, componente ACE bilingüe y bitácora pedagógica.
            </p>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#0E1B4D]/10 text-[#0E1B4D] flex items-center justify-center font-bold">
            <TableProperties className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0E1B4D]">2. Rúbricas & Cibercolegios</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Menú de Desafíos (Bronze, Silver, Gold), ponderación 35/35/20/10 y bloque listo para copiar directamente a Cibercolegios.
            </p>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0E1B4D]">3. Planilla en Excel (.xlsx)</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Plantilla formateada con fórmulas automáticas para promedios ponderados por los 4 pilares, cálculo de notas y estadísticas.
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Generated Documents Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0E1B4D]">Planeaciones Curriculares Recientes</h2>
            <p className="text-xs text-slate-500">
              Documentos generados listos para ver o descargar en Word, PDF, Excel o ZIP
            </p>
          </div>
          <Link
            href="/history"
            className="text-xs font-bold text-[#162874] hover:text-[#D71921] flex items-center gap-1 transition-colors"
          >
            <span>Ver todas</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
          {generatedDocs && generatedDocs.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {generatedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[10px] bg-[#0E1B4D] text-white font-bold">
                        SJB-RGA006
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-slate-300 text-slate-700 font-semibold"
                      >
                        {formatArea(doc.area)}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase font-bold text-[#D71921] bg-red-50"
                      >
                        {doc.language}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {doc.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(doc.created_at)}
                      </span>
                      {doc.grado && <span>• {doc.grado}</span>}
                      {doc.periodo && <span>• {doc.periodo}</span>}
                    </div>
                  </div>

                  <Link href={`/preview/${doc.id}`} className="shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-bold text-[#162874] border-[#162874]/30 hover:bg-[#162874] hover:text-white rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ver Paquete Completo</span>
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center space-y-3">
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Aún no has generado ninguna planeación
                </p>
                <p className="text-xs text-slate-500">
                  Sube el Plan de Área, SIAP y Cuadernillo para generar tu primer paquete curricular.
                </p>
              </div>
              <Link href="/generate">
                <Button
                  size="sm"
                  className="bg-[#D71921] hover:bg-[#B81219] text-white font-bold rounded-xl mt-1"
                >
                  Generar Primera Planeación
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
