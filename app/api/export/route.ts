/**
 * @file app/api/export/route.ts
 * @description POST /api/export
 *
 * Exports generated deliverables:
 * - 'pdf': Planning Book in PDF
 * - 'docx': Planning Book in Word .docx
 * - 'rubrics_docx': Rubrics in Word .docx
 * - 'excel': Grade Spreadsheet in Excel .xlsx
 * - 'zip': All deliverables bundled in a single ZIP file
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generatePdf } from '@/lib/export/pdf'
import { generateDocx } from '@/lib/export/docx'
import { generateGradeSpreadsheet } from '@/lib/export/excel'
import { createDeliverablesZip } from '@/lib/export/zip'
import { formatDate } from '@/lib/utils'
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitResponse,
  addRateLimitHeaders,
} from '@/lib/security/rate-limit'

const EXPORTS_BUCKET = 'generated-exports'
const SIGNED_URL_EXPIRY_SECONDS = 3600 // 1 hour

const exportBodySchema = z.object({
  documentId: z.string().uuid('documentId must be a valid UUID'),
  format: z.enum(['pdf', 'docx', 'rubrics_docx', 'excel', 'zip', 'gdocs']),
})

async function uploadAndSign(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ path: string; signedUrl: string }> {
  const { error: uploadError } = await supabaseAdmin.storage
    .from(EXPORTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Error subiendo archivo al almacenamiento: ${uploadError.message}`)
  }

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Error generando enlace seguro de descarga: ${signError?.message ?? 'vacío'}`)
  }

  return { path: storagePath, signedUrl: signedData.signedUrl }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.export, user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      `Has excedido el límite de exportación. Por favor espera ${rateLimitResult.retryAfterSeconds} segundos.`
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = exportBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { documentId, format } = parsed.data

  const { data: doc, error: docError } = await supabaseAdmin
    .from('generated_documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const authorName = profile?.full_name || user.email?.split('@')[0] || 'Docente CBSJC'
  const formattedDate = formatDate(doc.created_at, doc.language as 'es' | 'en')

  // Parse structured payload if stored as JSON
  let planningMarkdown = doc.content
  let rubricsMarkdown = doc.content
  let cibercolegiosSnippet = ''
  let excelSpec = {
    docente: authorName,
    area: doc.area || 'General',
    grado: doc.grado || 'Primaria/Secundaria',
    periodo: String(doc.periodo || 'I'),
    tema: doc.title,
  }

  try {
    const parsedPayload = JSON.parse(doc.content)
    if (parsedPayload.planningBookMarkdown) {
      planningMarkdown = parsedPayload.planningBookMarkdown
      rubricsMarkdown = parsedPayload.rubricsMarkdown || parsedPayload.planningBookMarkdown
      cibercolegiosSnippet = parsedPayload.cibercolegiosSnippet || ''
      excelSpec = parsedPayload.excelSpec || excelSpec
    }
  } catch {
    // legacy plain markdown format
  }

  const safeTitle = doc.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50)

  try {
    // 1. PDF Export
    if (format === 'pdf') {
      const pdfBuffer = await generatePdf({
        title: doc.title,
        content: planningMarkdown,
        documentType: 'planeador',
        language: doc.language as 'es' | 'en',
        metadata: {
          area: doc.area,
          nivel: doc.nivel,
          grado: doc.grado || undefined,
          periodo: doc.periodo || undefined,
          date: formattedDate,
          authorName,
        },
      })

      const storagePath = `${user.id}/${documentId}/${safeTitle}-planning.pdf`
      const { signedUrl } = await uploadAndSign(storagePath, pdfBuffer, 'application/pdf')
      const successResponse = NextResponse.json({ success: true, downloadUrl: signedUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    // 2. Word .docx Export (Planning Book)
    if (format === 'docx') {
      const docxBuffer = await generateDocx({
        title: doc.title,
        content: planningMarkdown,
        documentType: 'planeador',
        language: doc.language as 'es' | 'en',
        metadata: {
          area: doc.area,
          nivel: doc.nivel,
          grado: doc.grado || undefined,
          periodo: doc.periodo || undefined,
          date: formattedDate,
          authorName,
        },
      })

      const storagePath = `${user.id}/${documentId}/${safeTitle}-planning.docx`
      const { signedUrl } = await uploadAndSign(
        storagePath,
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      const successResponse = NextResponse.json({ success: true, downloadUrl: signedUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    // 3. Rubrics Word .docx Export
    if (format === 'rubrics_docx') {
      const rubricsDocxBuffer = await generateDocx({
        title: `Rúbricas Evaluativas: ${doc.title}`,
        content: rubricsMarkdown,
        documentType: 'planeador',
        language: doc.language as 'es' | 'en',
        metadata: {
          area: doc.area,
          nivel: doc.nivel,
          grado: doc.grado || undefined,
          periodo: doc.periodo || undefined,
          date: formattedDate,
          authorName,
        },
      })

      const storagePath = `${user.id}/${documentId}/${safeTitle}-rubricas.docx`
      const { signedUrl } = await uploadAndSign(
        storagePath,
        rubricsDocxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      const successResponse = NextResponse.json({ success: true, downloadUrl: signedUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    // 4. Excel .xlsx Grade Spreadsheet
    if (format === 'excel') {
      const excelBuffer = await generateGradeSpreadsheet({
        docente: excelSpec.docente,
        area: excelSpec.area,
        grado: excelSpec.grado,
        periodo: excelSpec.periodo,
        tema: excelSpec.tema,
      })

      const storagePath = `${user.id}/${documentId}/${safeTitle}-planilla.xlsx`
      const { signedUrl } = await uploadAndSign(
        storagePath,
        excelBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      const successResponse = NextResponse.json({ success: true, downloadUrl: signedUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    // 5. Complete ZIP Package with all 3 Deliverables
    if (format === 'zip') {
      const [planningDocxBuf, planningPdfBuf, rubricsDocxBuf, excelBuf] = await Promise.all([
        generateDocx({
          title: doc.title,
          content: planningMarkdown,
          documentType: 'planeador',
          language: doc.language as 'es' | 'en',
          metadata: { area: doc.area, nivel: doc.nivel, grado: doc.grado || undefined, periodo: doc.periodo || undefined, date: formattedDate, authorName },
        }),
        generatePdf({
          title: doc.title,
          content: planningMarkdown,
          documentType: 'planeador',
          language: doc.language as 'es' | 'en',
          metadata: { area: doc.area, nivel: doc.nivel, grado: doc.grado || undefined, periodo: doc.periodo || undefined, date: formattedDate, authorName },
        }),
        generateDocx({
          title: `Rúbricas: ${doc.title}`,
          content: rubricsMarkdown,
          documentType: 'planeador',
          language: doc.language as 'es' | 'en',
          metadata: { area: doc.area, nivel: doc.nivel, grado: doc.grado || undefined, periodo: doc.periodo || undefined, date: formattedDate, authorName },
        }),
        generateGradeSpreadsheet({
          docente: excelSpec.docente,
          area: excelSpec.area,
          grado: excelSpec.grado,
          periodo: excelSpec.periodo,
          tema: excelSpec.tema,
        }),
      ])

      const zipBuffer = await createDeliverablesZip({
        title: doc.title,
        planningDocx: planningDocxBuf,
        planningPdf: planningPdfBuf,
        rubricsDocx: rubricsDocxBuf,
        excelSpreadsheet: excelBuf,
        cibercolegiosTxt: cibercolegiosSnippet,
      })

      const storagePath = `${user.id}/${documentId}/${safeTitle}-paquete-completo.zip`
      const { signedUrl } = await uploadAndSign(storagePath, zipBuffer, 'application/zip')
      const successResponse = NextResponse.json({ success: true, downloadUrl: signedUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    return NextResponse.json({ success: false, error: 'Formato no soportado' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error durante la exportación'
    console.error(`[POST /api/export] format="${format}" error:`, message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
