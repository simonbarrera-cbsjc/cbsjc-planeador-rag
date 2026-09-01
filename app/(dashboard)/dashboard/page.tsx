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
    .limit(5)

  const generatedDocs = (generatedDocsData || []) as GeneratedDocument[]
  const totalGenerated = generatedDocs.length

  return (
    <div className="space-y-8">
      {/* Institutional Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0E1B4D] via-[#162874] to-[#0A1435] text-white p-6 sm:p-8 shadow-xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#D71921]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 max-w-2xl relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 drop-shadow">
              <Image
                src="/logo.png"
                alt="Escudo CBSJC"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <span className="text-[11px] font-serif text-slate-300 block">Colegio bilingüe</span>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                <span className="text-[#D71921]">San José</span> Campestre
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Sistema Oficial de Planeación Curricular & RAG
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Genera en un único paso la secuencia didáctica <strong>Planning Book (SJB-RGA006)</strong>, las <strong>Rúbricas Evaluativas</strong> y la <strong>Planilla de Notas en Excel (.xlsx)</strong> a partir del Plan de Área, SIAP y Cuadernillo.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0 relative z-10">
          <Link href="/generate">
            <Button className="bg-[#D71921] hover:bg-[#B81219] text-white font-bold shadow-lg h-11 px-5 rounded-xl flex items-center gap-2 transition-transform hover:scale-[1.02]">
              <Sparkles className="h-4 w-4" />
              <span>Generar Planeación</span>
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-11 px-5 rounded-xl flex items-center gap-2 backdrop-blur-md">
              <History className="h-4 w-4" />
              <span>Ver Historial</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Feature Triple Deliverable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#162874]/10 text-[#162874] flex items-center justify-center font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0E1B4D]">1. Planning Book (SJB-RGA006)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Secuencia didáctica oficial: Referentes DBA/EBC, Arco Antes-Durante-Después, componente ACE bilingüe y bitácora.
            </p>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <TableProperties className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0E1B4D]">2. Rúbricas & Cibercolegios</h3>
            <p className="text-xs text-slate-500 mt-1">
              Menú de Desafíos (Bronze, Silver, Gold), ponderación 35/35/20/10 y bloque listo para copiar a Cibercolegios.
            </p>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0E1B4D]">3. Planilla en Excel (.xlsx)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Plantilla formateada con fórmulas automáticas para promedios ponderados por pilar, cálculo de notas y estadísticas.
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Generated Documents Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0E1B4D]">Planeaciones Recientes</h2>
            <p className="text-xs text-slate-500">Documentos curriculares generados listos para descargar en Word, PDF, Excel o ZIP</p>
          </div>
          <Link href="/history" className="text-xs font-bold text-[#162874] hover:text-[#D71921] flex items-center gap-1 transition-colors">
            Ver todas ({totalGenerated})
            <ArrowRight className="h-3 w-3" />
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
                      <Badge className="text-[10px] bg-[#0E1B4D] text-white">
                        SJB-RGA006
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700">
                        {formatArea(doc.area)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold text-[#D71921] bg-red-50">
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
                      {doc.grado && <span>{doc.grado}</span>}
                      {doc.periodo && <span>Periodo {doc.periodo}</span>}
                    </div>
                  </div>

                  <Link href={`/preview/${doc.id}`} className="shrink-0">
                    <Button size="sm" variant="outline" className="text-xs font-bold border-[#162874]/30 hover:bg-[#162874] hover:text-white rounded-xl transition-colors">
                      Ver Paquete Completo
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center space-y-3">
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <div>
                <p className="text-sm font-bold text-slate-800">Aún no has generado ninguna planeación</p>
                <p className="text-xs text-slate-500">Sube el Plan de Área, SIAP y Cuadernillo para generar tu primer paquete curricular.</p>
              </div>
              <Link href="/generate">
                <Button size="sm" className="bg-[#D71921] hover:bg-[#B81219] text-white font-bold rounded-xl mt-1">
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
