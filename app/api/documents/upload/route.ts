/**
 * @file app/api/documents/upload/route.ts
 * @description POST /api/documents/upload
 *
 * Accepts multipart/form-data upload with a PDF file plus metadata.
 * Saves file to Supabase Storage and creates record in `source_documents`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { DocumentCategory, DocumentArea } from '@/types'

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
const ALLOWED_MIME_TYPE = 'application/pdf'
const STORAGE_BUCKET = 'source-documents'

function sanitiseFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 150)
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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Form data inválido' }, { status: 400 })
  }

  const file = formData.get('file')
  const title = (formData.get('title') || formData.get('name') || '') as string
  const category = (formData.get('category') || 'general') as DocumentCategory
  const area = (formData.get('area') || 'general') as DocumentArea
  const description = (formData.get('description') || null) as string | null

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'Se requiere un archivo PDF' }, { status: 400 })
  }

  if (!title.trim()) {
    return NextResponse.json({ success: false, error: 'El título es obligatorio' }, { status: 400 })
  }

  if (file.type !== ALLOWED_MIME_TYPE && !file.name.endsWith('.pdf')) {
    return NextResponse.json(
      { success: false, error: 'Únicamente se permiten archivos en formato PDF (.pdf)' },
      { status: 415 }
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: 'El archivo supera el límite máximo permitido de 50 MB' },
      { status: 413 }
    )
  }

  const timestamp = Date.now()
  const safeName = sanitiseFilename(file.name)
  const storagePath = `${user.id}/${timestamp}-${safeName}`

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // Upload to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: ALLOWED_MIME_TYPE,
      upsert: false,
    })

  if (uploadError) {
    console.error('[POST /api/documents/upload] Storage error:', uploadError.message)
    return NextResponse.json(
      { success: false, error: `Error guardando archivo en almacenamiento: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // Insert into source_documents table
  const { data: newDoc, error: insertError } = await supabaseAdmin
    .from('source_documents')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description ? description.trim() : null,
      category,
      area,
      storage_path: storagePath,
      file_type: ALLOWED_MIME_TYPE,
      file_size: file.size,
      status: 'pending',
      chunk_count: null,
      error_message: null,
      metadata: {},
    })
    .select('id')
    .single()

  if (insertError || !newDoc) {
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath])
    console.error('[POST /api/documents/upload] DB insert error:', insertError?.message)
    return NextResponse.json(
      { success: false, error: 'Error guardando registro en base de datos' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, documentId: newDoc.id }, { status: 201 })
}
