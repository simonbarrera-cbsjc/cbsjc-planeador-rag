'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Search,
  Eye,
  Trash2,
  FileDown,
  Download,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatDocumentType, formatArea } from '@/lib/utils'
import type { GeneratedDocument, DocumentType, DocumentArea, Language } from '@/types'

export default function HistoryPage() {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [languageFilter, setLanguageFilter] = useState<string>('all')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/generated-documents')
      const json = await res.json()
      if (json.success && json.documents) {
        setDocuments(json.documents)
      }
    } catch (err) {
      console.error('Error fetching history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento generado de tu historial?')) return

    try {
      setDeletingId(id)
      const res = await fetch(`/api/generated-documents?id=${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast({ title: 'Documento eliminado', description: 'El documento fue removido del historial.', variant: 'success' })
        setDocuments((prev) => prev.filter((d) => d.id !== id))
      } else {
        throw new Error(json.error || 'Error al eliminar')
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al eliminar documento', variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType = typeFilter === 'all' || doc.document_type === typeFilter
    const matchesArea = areaFilter === 'all' || doc.area === areaFilter
    const matchesLang = languageFilter === 'all' || doc.language === languageFilter

    return matchesSearch && matchesType && matchesArea && matchesLang
  })

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#003087]">Historial de Documentos Generados</h1>
          <p className="text-sm text-slate-500 mt-1">
            Consulta, edita o descarga los planeadores y documentos creados anteriormente.
          </p>
        </div>

        <Link href="/generate">
          <Button className="bg-[#003087] hover:bg-[#002060] text-white font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#C8A84B]" />
            <span>Generar Nuevo Documento</span>
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por título o contenido..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Tipos</SelectItem>
                <SelectItem value="planeador">Planeador de Clase</SelectItem>
                <SelectItem value="plan_area">Plan de Área</SelectItem>
                <SelectItem value="informe">Informe Académico</SelectItem>
                <SelectItem value="circular">Circular Institucional</SelectItem>
                <SelectItem value="proyecto_pedagogico">Proyecto Pedagógico</SelectItem>
              </SelectContent>
            </Select>

            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Áreas</SelectItem>
                <SelectItem value="matematicas">Matemáticas</SelectItem>
                <SelectItem value="ciencias">Ciencias Naturales</SelectItem>
                <SelectItem value="humanidades">Humanidades / Español</SelectItem>
                <SelectItem value="ingles">Inglés</SelectItem>
                <SelectItem value="sociales">Ciencias Sociales</SelectItem>
                <SelectItem value="artes">Artes</SelectItem>
                <SelectItem value="educacion_fisica">Educación Física</SelectItem>
                <SelectItem value="tecnologia">Tecnología</SelectItem>
                <SelectItem value="religion">Religión / Ética</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Idiomas</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents List / Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-[#003087]" />
            Cargando historial de documentos...
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3.5">Título del Documento</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Área / Grado</th>
                  <th className="p-3.5">Idioma</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 max-w-sm truncate">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#003087] shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge variant="default" className="text-[10px] bg-[#003087]">
                        {formatDocumentType(doc.document_type)}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-800">{formatArea(doc.area)}</span>
                        {doc.grado && (
                          <span className="text-[10px] text-slate-400 block">{doc.grado}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                        {doc.language}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/preview/${doc.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs font-semibold text-[#003087] border-[#003087]/20 hover:bg-[#003087]/5"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Abrir
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Eliminar documento"
                          onClick={() => handleDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron documentos</p>
            <p className="text-xs text-slate-500">
              {searchQuery || typeFilter !== 'all' || areaFilter !== 'all'
                ? 'Prueba cambiando los filtros de búsqueda.'
                : 'Aún no has generado ningún documento curricular.'}
            </p>
            <Link href="/generate">
              <Button size="sm" className="bg-[#003087] text-white mt-2">
                Generar primer documento
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
