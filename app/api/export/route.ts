/**
 * @file app/api/export/route.ts
 * @description POST /api/export
 *
 * Exports a generated document to PDF, DOCX, or Google Docs.
 * - PDF/DOCX: uploaded to Supabase Storage `generated-exports` bucket,
 *   returns a signed URL with a 1-hour expiry.
 * - Google Docs: calls createGoogleDoc, returns the public gdocs URL.
 *
 * Auth: Supabase session required. Document must belong to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generatePdf } from '@/lib/export/pdf'
import { generateDocx } from '@/lib/export/docx'
import { createGoogleDoc } from '@/lib/export/gdocs'
import { formatDate } from '@/lib/utils'
import type { GeneratedDocumentStatus } from '@/types'
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
  format: z.enum(['pdf', 'docx', 'gdocs']),
})

async function uploadAndSign(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ path: string; signedUrl: string }> {
  // Ensure bucket exists / upload
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

  // Rate limit check (20 requests/minute per authenticated user or IP)
  const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.export, user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      `Has excedido el límite de exportación (${RATE_LIMIT_PRESETS.export.limit} solicitudes por minuto). Por favor espera ${rateLimitResult.retryAfterSeconds} segundos.`
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

  try {
    if (format === 'pdf') {
      const pdfBuffer = await generatePdf({
        title: doc.title,
        content: doc.content,
        documentType: doc.document_type,
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

      const safeTitle = doc.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50)
      const storagePath = `${user.id}/${documentId}/${safeTitle}.pdf`
      const { path, signedUrl } = await uploadAndSign(storagePath, pdfBuffer, 'application/pdf')

      await supabaseAdmin
        .from('generated_documents')
        .update({
          status: 'exported_pdf' satisfies GeneratedDocumentStatus,
          pdf_storage_path: path,
        })
        .eq('id', documentId)

      const response = NextResponse.json({ success: true, downloadUrl: signedUrl }, { status: 200 })
      return addRateLimitHeaders(response, rateLimitResult)
    }

    if (format === 'docx') {
      const docxBuffer = await generateDocx({
        title: doc.title,
        content: doc.content,
        documentType: doc.document_type,
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

      const safeTitle = doc.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50)
      const storagePath = `${user.id}/${documentId}/${safeTitle}.docx`
      const { path, signedUrl } = await uploadAndSign(
        storagePath,
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )

      await supabaseAdmin
        .from('generated_documents')
        .update({
          status: 'exported_docx' satisfies GeneratedDocumentStatus,
          docx_storage_path: path,
        })
        .eq('id', documentId)

      const response = NextResponse.json({ success: true, downloadUrl: signedUrl }, { status: 200 })
      return addRateLimitHeaders(response, rateLimitResult)
    }

    if (format === 'gdocs') {
      const { docUrl } = await createGoogleDoc({
        title: doc.title,
        content: doc.content,
        userEmail: user.email || undefined,
      })

      await supabaseAdmin
        .from('generated_documents')
        .update({
          status: 'exported_gdocs' satisfies GeneratedDocumentStatus,
          gdocs_url: docUrl,
        })
        .eq('id', documentId)

      const response = NextResponse.json({ success: true, gdocsUrl: docUrl }, { status: 200 })
      return addRateLimitHeaders(response, rateLimitResult)
    }

    return NextResponse.json({ success: false, error: 'Formato no soportado' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error durante la exportación'
    console.error(`[POST /api/export] format="${format}" error:`, message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
