/**
 * @file app/api/documents/route.ts
 * @description
 * GET /api/documents - Lists all source documents in the institutional knowledge base.
 * DELETE /api/documents?id= - Deletes a source document and its chunks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { DocumentArea, DocumentCategory, SourceDocumentStatus } from '@/types'

const STORAGE_BUCKET = 'source-documents'

const DOCUMENT_CATEGORIES = ['primaria', 'secundaria', 'bachillerato', 'general'] as const
const DOCUMENT_AREAS = [
  'matematicas',
  'ciencias',
  'humanidades',
  'ingles',
  'sociales',
  'artes',
  'educacion_fisica',
  'tecnologia',
  'religion',
  'general',
] as const
const SOURCE_STATUSES = ['pending', 'processing', 'ready', 'error'] as const

const listQuerySchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  area: z.enum(DOCUMENT_AREAS).optional(),
  status: z.enum(SOURCE_STATUSES).optional(),
})

const deleteQuerySchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawParams = {
    category: searchParams.get('category') || undefined,
    area: searchParams.get('area') || undefined,
    status: searchParams.get('status') || undefined,
  }

  const parsed = listQuerySchema.safeParse(rawParams)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { category, area, status } = parsed.data

  let query = supabaseAdmin
    .from('source_documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category as DocumentCategory)
  if (area) query = query.eq('area', area as DocumentArea)
  if (status) query = query.eq('status', status as SourceDocumentStatus)

  const { data: documents, error: dbError } = await query

  if (dbError) {
    console.error('[GET /api/documents] DB error:', dbError.message)
    return NextResponse.json(
      { success: false, error: 'Error al consultar documentos' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, documents: documents || [] }, { status: 200 })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = deleteQuerySchema.safeParse({ id: searchParams.get('id') })

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { id } = parsed.data

  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('source_documents')
    .select('id, storage_path')
    .eq('id', id)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
  }

  try {
    // 1. Delete associated chunks
    await supabaseAdmin
      .from('document_chunks')
      .delete()
      .eq('source_doc_id', id)

    // 2. Remove file from storage
    if (doc.storage_path) {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([doc.storage_path])
    }

    // 3. Delete source_documents record
    const { error: deleteError } = await supabaseAdmin
      .from('source_documents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw new Error(`Error al borrar registro: ${deleteError.message}`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar'
    console.error('[DELETE /api/documents] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
