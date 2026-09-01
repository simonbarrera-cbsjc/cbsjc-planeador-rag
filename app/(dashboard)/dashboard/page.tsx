import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  UploadCloud,
  FileText,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Calendar,
  Layers,
  GraduationCap,
} from 'lucide-react'
import { formatDate, formatDocumentType, formatArea } from '@/lib/utils'
import type { SourceDocument, GeneratedDocument } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch count of source documents
  const { data: sourceDocsData } = await supabase
    .from('source_documents')
    .select('id, title, category, area, status, created_at, chunk_count')
    .order('created_at', { ascending: false })

  const sourceDocs = (sourceDocsData || []) as SourceDocument[]

  // Fetch user's generated documents
  const { data: generatedDocsData } = await supabase
    .from('generated_documents')
    .select('id, title, document_type, language, area, nivel, grado, periodo, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  const generatedDocs = (generatedDocsData || []) as GeneratedDocument[]

  const totalSourceDocs = sourceDocs.length
  const readySourceDocs = sourceDocs.filter((d) => d.status === 'ready').length
  const totalGenerated = generatedDocs.length
  const totalChunks = sourceDocs.reduce((acc, curr) => acc + (curr.chunk_count || 0), 0)

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
            Sistema de Planeación Curricular & RAG
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Genera planeadores de clase, planes de área e informes pedagógicos alineados en tiempo real con los documentos rectores del colegio.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0 relative z-10">
          <Link href="/generate">
            <Button className="bg-[#D71921] hover:bg-[#B81219] text-white font-bold shadow-lg h-11 px-5 rounded-xl flex items-center gap-2 transition-transform hover:scale-[1.02]">
              <Sparkles className="h-4 w-4" />
              <span>Generar Documento</span>
            </Button>
          </Link>
          <Link href="/upload">
            <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-11 px-5 rounded-xl flex items-center gap-2 backdrop-blur-md">
              <UploadCloud className="h-4 w-4" />
              <span>Subir Rector</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Documentos Rectores
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#162874]/10 flex items-center justify-center text-[#162874]">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalSourceDocs}</div>
            <p className="text-xs text-slate-500 mt-1">
              {readySourceDocs} listos en base de conocimiento
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Fragmentos RAG
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#D71921]/10 flex items-center justify-center text-[#D71921]">
              <Sparkles className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalChunks}</div>
            <p className="text-xs text-slate-500 mt-1">
              Vectores pgvector de 768 dimensiones
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Documentos Creados
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalGenerated}</div>
            <p className="text-xs text-slate-500 mt-1">
              Disponibles para editar y exportar
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Motor Curricular
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Gemini 2.0 Flash Activo
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Google AI Studio & Supabase OK
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Recent Documents + Knowledge Base */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Generated Documents (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0E1B4D]">Últimos Documentos Generados</h2>
              <p className="text-xs text-slate-500">Documentos institucionales listos para abrir, editar o exportar</p>
            </div>
            <Link href="/history" className="text-xs font-bold text-[#162874] hover:text-[#D71921] flex items-center gap-1 transition-colors">
              Ver todos ({totalGenerated})
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
                        <Badge className="text-[10px] bg-[#162874] text-white">
                          {formatDocumentType(doc.document_type)}
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
                        Abrir y Editar
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center space-y-3">
                <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Aún no has generado ningún documento</p>
                  <p className="text-xs text-slate-500">Crea tu primer planeador de clase o plan de área en segundos.</p>
                </div>
                <Link href="/generate">
                  <Button size="sm" className="bg-[#D71921] hover:bg-[#B81219] text-white font-bold rounded-xl mt-1">
                    Crear primer documento
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Knowledge Base Summary (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0E1B4D]">Base de Conocimiento</h2>
              <p className="text-xs text-slate-500">Documentos rectores que alimentan el RAG</p>
            </div>
            <Link href="/upload" className="text-xs font-bold text-[#162874] hover:text-[#D71921] flex items-center gap-1 transition-colors">
              Subir más
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 space-y-3">
              {sourceDocs && sourceDocs.length > 0 ? (
                <div className="space-y-2.5">
                  {sourceDocs.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{doc.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {formatArea(doc.area)} • {doc.chunk_count || 0} fragmentos
                        </p>
                      </div>
                      <Badge
                        className={`text-[10px] shrink-0 font-bold ${
                          doc.status === 'ready'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.status === 'processing'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {doc.status === 'ready' ? 'Listo' : doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <UploadCloud className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">No hay documentos rectores subidos todavía.</p>
                  <Link href="/upload">
                    <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl mt-2 border-slate-300">
                      Subir documento rector (PDF)
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
