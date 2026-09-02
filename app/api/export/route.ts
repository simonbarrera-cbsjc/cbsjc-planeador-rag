/**
 * @file app/api/export/route.ts
 * @description POST /api/export
 *
 * Exports generated deliverables:
 * - 'pdf': Planning Book in PDF
 * - 'docx': Planning Book in Word .docx
 * - 'rubrics_docx': Rubrics in Word .docx
 * - 'excel': Grade Spreadsheet in Excel .xlsx
 * - 'zip': All deliverables bundled in a single ZIP file (including 30 AI Prompts Bank)
 * - 'prompts_txt': 30 AI Prompts for Teacher Extra Resources
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generatePdf } from '@/lib/export/pdf'
import { generateDocx } from '@/lib/export/docx'
import { generateRubricsDocx } from '@/lib/export/rubrics-docx'
import { generateGradeSpreadsheet } from '@/lib/export/excel'
import { createDeliverablesZip } from '@/lib/export/zip'
import { generatePromptsBankTxt } from '@/lib/ai/prompts-generator'
import { createGoogleDoc } from '@/lib/export/gdocs'
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
  format: z.enum(['pdf', 'docx', 'rubrics_docx', 'excel', 'zip', 'prompts_txt', 'gdocs']),
})

async function uploadAndSign(
  storagePath: string,
  fileBuffer: Buffer | string,
  contentType: string
): Promise<{ signedUrl: string }> {
  const { error: uploadError } = await supabaseAdmin.storage
    .from(EXPORTS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    })

  if (uploadError) {
    console.error('[POST /api/export] Storage upload error:', uploadError)
    throw new Error(`Failed to upload export artifact to storage: ${uploadError.message}`)
  }

  const { data: signData, error: signError } = await supabaseAdmin.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)

  if (signError || !signData?.signedUrl) {
    console.error('[POST /api/export] Signed URL error:', signError)
    throw new Error('Failed to create signed URL for export download')
  }

  return { signedUrl: signData.signedUrl }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }

  const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.export, user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
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

  const formattedDate = formatDate(doc.created_at, doc.language as 'es' | 'en')

  // Parse structured payload if stored as JSON
  let planningMarkdown = doc.content
  let rubricsMarkdown = doc.content
  let cibercolegiosSnippet = ''
  let excelSpec = {
    docente: 'Docente CBSJC',
    area: doc.area || 'General',
    grado: doc.grado || 'Primaria/Secundaria',
    periodo: String(doc.periodo || 'I'),
    tema: doc.title,
    evidenciaPrincipal: doc.title,
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

  // Extract true docente name from the document content or excelSpec (not default profile fallback)
  let authorName = 'Docente CBSJC'
  if (excelSpec?.docente && excelSpec.docente.trim().length > 0 && excelSpec.docente !== 'Docente CBSJC') {
    authorName = excelSpec.docente.trim()
  } else {
    const docMatch = planningMarkdown.match(/\|\s*\*\*Docente(?:\(s\))?\*\*\s*\|\s*([^|\r\n]+)\s*\|/i)
    if (docMatch && docMatch[1].trim().length > 0) {
      authorName = docMatch[1].trim()
    } else {
      authorName = profile?.full_name || user.email?.split('@')[0] || 'Docente CBSJC'
    }
  }

  const safeTitle = doc.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50)

  // Generate 30 AI Prompts bank for teacher
  const aiPromptsTxt = generatePromptsBankTxt({
    docente: authorName,
    area: doc.area || excelSpec.area || 'Ciencias',
    grado: doc.grado || excelSpec.grado || 'Grado 6°',
    periodo: String(doc.periodo || excelSpec.periodo || 'I'),
    tema: doc.title,
    evidenciaPrincipal: excelSpec.evidenciaPrincipal || doc.title,
  })

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
      const rubricsDocxBuffer = await generateRubricsDocx({
        title: `Rúbricas Evaluativas: ${doc.title}`,
        content: rubricsMarkdown,
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
        docente: authorName,
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

    // 5. Complete ZIP Package with all Deliverables
    if (format === 'zip') {
      let planningPdfBuf: Buffer | undefined = undefined
      try {
        planningPdfBuf = await generatePdf({
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
      } catch (pdfErr) {
        console.warn('[POST /api/export] PDF generation omitted from ZIP:', pdfErr)
      }

      const [planningDocxBuf, rubricsDocxBuf, excelBuf] = await Promise.all([
        generateDocx({
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
        }),
        generateRubricsDocx({
          title: `Rúbricas Menú de Desafíos: ${doc.title}`,
          content: rubricsMarkdown,
          language: doc.language as 'es' | 'en',
          metadata: {
            area: doc.area,
            nivel: doc.nivel,
            grado: doc.grado || undefined,
            periodo: doc.periodo || undefined,
            date: formattedDate,
            authorName,
          },
        }),
        generateGradeSpreadsheet({
          docente: authorName,
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
        aiPromptsTxt,
        cibercolegiosTxt: cibercolegiosSnippet,
      })

      const storagePath = `${user.id}/${documentId}/${safeTitle}-paquete-completo.zip`
      const { signedUrl } = await uploadAndSign(storagePath, zipBuffer, 'application/zip')
      const successResponse = NextResponse.json({ success: true, downloadUrl: signedUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    // 6. Direct Prompts Bank .txt Download
    if (format === 'prompts_txt') {
      const storagePath = `${user.id}/${documentId}/${safeTitle}-30-prompts-ia.txt`
      const { signedUrl } = await uploadAndSign(storagePath, aiPromptsTxt, 'text/plain; charset=utf-8')
      const successResponse = NextResponse.json({ success: true, downloadUrl: signedUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    // 7. Google Docs Export
    if (format === 'gdocs') {
      const { docUrl } = await createGoogleDoc({
        title: doc.title,
        content: planningMarkdown,
        userEmail: user.email,
      })
      const successResponse = NextResponse.json({ success: true, downloadUrl: docUrl })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    return NextResponse.json({ success: false, error: 'Formato no soportado' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error durante la exportación'
    console.error(`[POST /api/export] format="${format}" error:`, message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
