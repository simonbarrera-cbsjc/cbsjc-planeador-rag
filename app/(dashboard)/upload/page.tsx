'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UploadCloud,
  FileText,
  FileType,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatArea, formatNivel } from '@/lib/utils'
import type { DocumentArea, DocumentCategory, SourceDocument } from '@/types'

const CATEGORIES: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'general', label: 'Toda la Institución (General)' },
  { value: 'primaria', label: 'Primaria (Grados 1° a 5°)' },
  { value: 'secundaria', label: 'Secundaria (Grados 6° a 9°)' },
  { value: 'bachillerato', label: 'Media / Bachillerato (Grados 10° y 11°)' },
]

const AREAS: Array<{ value: DocumentArea; label: string }> = [
  { value: 'general', label: 'General Institucional (PEI, Manual, SIEE)' },
  { value: 'matematicas', label: 'Matemáticas' },
  { value: 'ciencias', label: 'Ciencias Naturales y Educación Ambiental' },
  { value: 'humanidades', label: 'Humanidades y Lengua Castellana' },
  { value: 'ingles', label: 'Inglés (Formación Bilingüe)' },
  { value: 'sociales', label: 'Ciencias Sociales, Historia y Democracia' },
  { value: 'artes', label: 'Educación Artística y Cultural' },
  { value: 'educacion_fisica', label: 'Educación Física, Recreación y Deportes' },
  { value: 'tecnologia', label: 'Tecnología e Informática' },
  { value: 'religion', label: 'Educación Religiosa, Ética y Valores' },
]

export default function UploadPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('general')
  const [area, setArea] = useState<DocumentArea>('general')

  // Upload & processing state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')

  // Documents list state
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)

  // Fetch existing documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents')
      const json = await res.json()
      if (json.success && json.documents) {
        setDocuments(json.documents)
      }
    } catch (err) {
      console.error('Error fetching source documents:', err)
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // File selection handler (accepts PDF and DOCX)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const name = selectedFile.name.toLowerCase()
      const isPdf = name.endsWith('.pdf')
      const isDocx = name.endsWith('.docx') || name.endsWith('.doc')

      if (!isPdf && !isDocx) {
        toast({
          title: 'Formato no soportado',
          description: 'Por favor selecciona archivos en formato PDF (.pdf) o Word (.docx)',
          variant: 'error',
        })
        return
      }
      setFile(selectedFile)
      if (!title) {
        setTitle(selectedFile.name.replace(/\.(pdf|docx|doc)$/i, ''))
      }
    }
  }

  // Submit and embed handler
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast({ title: 'Archivo requerido', description: 'Selecciona un archivo PDF o Word para continuar', variant: 'warning' })
      return
    }

    if (!title.trim()) {
      toast({ title: 'Título requerido', description: 'Escribe un nombre para el documento rector', variant: 'warning' })
      return
    }

    try {
      setIsUploading(true)
      setUploadProgress(20)
      setStatusMessage('Subiendo archivo al almacenamiento institucional...')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      formData.append('description', description)
      formData.append('category', category)
      formData.append('area', area)

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const uploadJson = await uploadRes.json()
      if (!uploadRes.ok || !uploadJson.success) {
        throw new Error(uploadJson.error || 'Error al subir el archivo')
      }

      setUploadProgress(60)
      setStatusMessage('Extrayendo texto y generando embeddings con Google AI Studio...')

      // Trigger Embedding
      const embedRes = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId: uploadJson.documentId }),
      })

      const embedJson = await embedRes.json()
      if (!embedRes.ok || !embedJson.success) {
        throw new Error(embedJson.error || 'Error durante la vectorización del documento')
      }

      setUploadProgress(100)
      setStatusMessage('¡Documento rector vectorizado e integrado con éxito!')

      toast({
        title: '¡Documento listo en RAG!',
        description: `Se han generado e indexado ${embedJson.chunkCount} fragmentos en la base de datos vectorial.`,
        variant: 'success',
      })

      // Reset form
      setFile(null)
      setTitle('')
      setDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchDocuments()
    } catch (err) {
      console.error('Upload & embed error:', err)
      toast({
        title: 'Error en el procesamiento',
        description: err instanceof Error ? err.message : 'Ocurrió un error inesperado al procesar el archivo.',
        variant: 'error',
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setStatusMessage('')
    }
  }

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento rector y todos sus vectores asociados?')) return

    try {
      setDeletingId(id)
      const res = await fetch(`/api/documents?id=${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast({ title: 'Documento eliminado', description: 'El documento y sus vectores fueron eliminados.', variant: 'success' })
        setDocuments((prev) => prev.filter((d) => d.id !== id))
      } else {
        throw new Error(json.error || 'Error al eliminar')
      }
    } catch (err) {
      toast({ title: 'Error al eliminar', description: err instanceof Error ? err.message : 'Error desconocido', variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  // Re-embed handler
  const handleReprocess = async (id: string) => {
    try {
      setReprocessingId(id)
      toast({ title: 'Procesando...', description: 'Regenerando embeddings para el documento.', variant: 'default' })
      const res = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId: id }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast({ title: 'Completado', description: `Vectorizado con éxito (${json.chunkCount} fragmentos)`, variant: 'success' })
        await fetchDocuments()
      } else {
        throw new Error(json.error || 'Error al re-procesar')
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al procesar', variant: 'error' })
    } finally {
      setReprocessingId(null)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0E1B4D]">Documentos Rectores y Base de Conocimiento</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sube planes de área, mallas curriculares, lineamientos y formatos institucionales en <strong className="text-slate-800 font-semibold">PDF o Word (.docx)</strong> para alimentar el motor RAG.
        </p>
      </div>

      {/* Upload Form Card */}
      <Card className="border-slate-200 shadow-md rounded-2xl bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-[#0E1B4D] font-bold">
            <UploadCloud className="h-5 w-5 text-[#D71921]" />
            Subir Nuevo Documento Rector (PDF o Word .docx)
          </CardTitle>
          <CardDescription>
            El sistema extraerá automáticamente el contenido, lo dividirá en fragmentos semánticos y creará vectores de búsqueda con Google AI Studio.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleUpload} className="space-y-5">
            {/* Drag and Drop Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                file
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-[#D71921] bg-slate-50/50 hover:bg-slate-100/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className={`p-3 rounded-xl ${file ? 'bg-emerald-100 text-emerald-700' : 'bg-[#162874]/10 text-[#162874]'}`}>
                  {file?.name.endsWith('.docx') || file?.name.endsWith('.doc') ? (
                    <FileType className="h-7 w-7 text-sky-600" />
                  ) : (
                    <FileText className="h-7 w-7" />
                  )}
                </div>
                {file ? (
                  <div>
                    <p className="text-sm font-bold text-emerald-900">{file.name}</p>
                    <p className="text-xs text-emerald-700">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.name.endsWith('.docx') ? 'Documento Word (.docx)' : 'Documento PDF'} • Listo para procesar
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      Haz clic para seleccionar o arrastra un archivo PDF o Word (.docx)
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Formatos compatibles: PDF, Word (.docx) • Máximo 50 MB por archivo
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Título del Documento *</Label>
                <Input
                  id="title"
                  placeholder="Ej: Plan de Área Matemáticas 2026 - Primaria"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">Nivel Educativo *</Label>
                <Select value={category} onValueChange={(val) => setCategory(val as DocumentCategory)}>
                  <SelectTrigger id="category" className="rounded-xl">
                    <SelectValue placeholder="Selecciona el nivel" />
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

              <div className="space-y-1.5">
                <Label htmlFor="area">Área del Conocimiento *</Label>
                <Select value={area} onValueChange={(val) => setArea(val as DocumentArea)}>
                  <SelectTrigger id="area" className="rounded-xl">
                    <SelectValue placeholder="Selecciona el área" />
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
                <Label htmlFor="description">Descripción / Notas Adicionales (Opcional)</Label>
                <Input
                  id="description"
                  placeholder="Ej: Actualizado según DBA 2026 y lineamientos SIEE"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Progress Bar when uploading */}
            {isUploading && (
              <div className="space-y-2 p-4 rounded-xl bg-blue-50/70 border border-blue-100">
                <div className="flex items-center justify-between text-xs font-bold text-[#162874]">
                  <span>{statusMessage}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isUploading || !file}
              className="w-full sm:w-auto bg-[#D71921] hover:bg-[#B81219] text-white font-bold px-6 h-11 rounded-xl shadow-md transition-colors"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Indexando documento...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Subir y Vectorizar en RAG
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Documents Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0E1B4D]">Documentos Indexados en el Sistema</h2>
            <p className="text-xs text-slate-500">Documentos rectores actualmente consultables por la IA</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchDocuments}
            disabled={loadingDocs}
            className="text-xs font-bold flex items-center gap-1.5 rounded-xl border-slate-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
          {loadingDocs ? (
            <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#162874]" />
              Cargando documentos rectores...
            </div>
          ) : documents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="p-3.5">Documento</th>
                    <th className="p-3.5">Formato</th>
                    <th className="p-3.5">Área / Nivel</th>
                    <th className="p-3.5">Estado</th>
                    <th className="p-3.5">Fragmentos</th>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => {
                    const isDocx =
                      doc.storage_path?.toLowerCase().endsWith('.docx') ||
                      doc.storage_path?.toLowerCase().endsWith('.doc') ||
                      doc.file_type === 'docx'

                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 max-w-xs truncate">
                          <div className="flex items-center gap-2">
                            {isDocx ? (
                              <FileType className="h-4 w-4 text-sky-600 shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-[#162874] shrink-0" />
                            )}
                            <span className="truncate">{doc.title}</span>
                          </div>
                          {doc.description && (
                            <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">{doc.description}</p>
                          )}
                        </td>
                        <td className="p-3.5">
                          <Badge variant="outline" className={`text-[10px] font-bold ${isDocx ? 'border-sky-300 text-sky-700 bg-sky-50' : 'border-rose-300 text-rose-700 bg-rose-50'}`}>
                            {isDocx ? 'Word (.docx)' : 'PDF'}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-800">{formatArea(doc.area)}</p>
                            <p className="text-[10px] text-slate-400">{formatNivel(doc.category)}</p>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <Badge
                            variant={
                              doc.status === 'ready'
                                ? 'success'
                                : doc.status === 'processing'
                                ? 'warning'
                                : doc.status === 'error'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="capitalize text-[10px] font-bold"
                          >
                            {doc.status === 'ready' ? 'Listo (RAG)' : doc.status}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-700">{doc.chunk_count || 0}</span>
                          <span className="text-slate-400 text-[10px] ml-1">vectores</span>
                        </td>
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Re-procesar vectores"
                              onClick={() => handleReprocess(doc.id)}
                              disabled={reprocessingId === doc.id}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-[#162874]"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${reprocessingId === doc.id ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Eliminar documento rector"
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center space-y-2">
              <UploadCloud className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No hay documentos rectores subidos</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Sube planes de área o manuales en formato PDF o Word (.docx) para que la inteligencia artificial pueda generar documentos precisos basados en ellos.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
