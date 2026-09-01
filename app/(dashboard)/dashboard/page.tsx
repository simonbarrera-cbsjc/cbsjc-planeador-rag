import Link from 'next/link'
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
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#001D52] via-[#003087] to-[#004ab3] text-white p-6 sm:p-8 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <Badge variant="gold" className="text-xs px-3 py-1 font-semibold uppercase tracking-wider">
            Colegio Bilingüe San José Campestre
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Sistema de Planeación Curricular y Generación RAG
          </h1>
          <p className="text-slate-200 text-sm leading-relaxed">
            Genera planeadores de clase, planes de área, informes y circulares alineados con los documentos rectores y DBA del colegio.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <Link href="/generate">
            <Button className="bg-[#C8A84B] hover:bg-[#dfc06a] text-slate-950 font-bold shadow-md h-11 px-5 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Generar Documento</span>
            </Button>
          </Link>
          <Link href="/upload">
            <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-11 px-5 flex items-center gap-2">
              <UploadCloud className="h-4 w-4" />
              <span>Subir Rector</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Docs Rectores
            </CardTitle>
            <BookOpen className="h-5 w-5 text-[#003087]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalSourceDocs}</div>
            <p className="text-xs text-slate-500 mt-1">
              {readySourceDocs} listos en base de conocimiento
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fragmentos Vectorizados
            </CardTitle>
            <Sparkles className="h-5 w-5 text-[#C8A84B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalChunks}</div>
            <p className="text-xs text-slate-500 mt-1">
              Vectores pgvector de 768 dimensiones
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Documentos Generados
            </CardTitle>
            <FileText className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{totalGenerated}</div>
            <p className="text-xs text-slate-500 mt-1">
              Disponibles para edición y exportación
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Estado del Motor RAG
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Gemini 2.0 Flash Activo
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Google AI Studio Conectado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Generated Documents (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#003087]">Últimos Documentos Generados</h2>
              <p className="text-xs text-slate-500">Documentos listos para ver, editar o exportar</p>
            </div>
            <Link href="/history" className="text-xs font-semibold text-[#003087] hover:underline flex items-center gap-1">
              Ver todos ({totalGenerated})
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            {generatedDocs && generatedDocs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {generatedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="default" className="text-[10px] bg-[#003087]">
                          {formatDocumentType(doc.document_type)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {formatArea(doc.area)}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {doc.language}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 truncate">
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
                      <Button size="sm" variant="outline" className="text-xs font-semibold border-slate-300">
                        Abrir y Editar
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Aún no has generado ningún documento</p>
                  <p className="text-xs text-slate-500">Crea tu primer planeador de clase o plan de área en segundos.</p>
                </div>
                <Link href="/generate">
                  <Button size="sm" className="bg-[#003087] text-white">
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
              <h2 className="text-lg font-bold text-[#003087]">Base de Conocimiento</h2>
              <p className="text-xs text-slate-500">Documentos rectores que alimentan el RAG</p>
            </div>
            <Link href="/upload" className="text-xs font-semibold text-[#003087] hover:underline flex items-center gap-1">
              Subir más
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 space-y-3">
              {sourceDocs && sourceDocs.length > 0 ? (
                <div className="space-y-2.5">
                  {sourceDocs.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{doc.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {formatArea(doc.area)} • {doc.chunk_count || 0} fragmentos
                        </p>
                      </div>
                      <Badge
                        variant={
                          doc.status === 'ready'
                            ? 'success'
                            : doc.status === 'processing'
                            ? 'warning'
                            : 'destructive'
                        }
                        className="text-[10px] shrink-0 capitalize"
                      >
                        {doc.status === 'ready' ? 'Listo' : doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <UploadCloud className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600">No hay documentos rectores subidos todavía.</p>
                  <Link href="/upload">
                    <Button size="sm" variant="outline" className="text-xs mt-2">
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
