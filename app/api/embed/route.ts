/**
 * @file app/api/embed/route.ts
 * @description POST /api/embed
 *
 * Accepts a sourceDocId, downloads the PDF from Supabase Storage,
 * extracts text, chunks it, generates embeddings in batches via text-embedding-004,
 * and persists them to document_chunks. Updates source_document status throughout.
 *
 * Auth: Supabase session required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { extractTextFromPdf } from '@/lib/ai/pdf-parser'
import { chunkText } from '@/lib/ai/chunker'
import { generateEmbeddings } from '@/lib/ai/embeddings'

const EMBED_BATCH_SIZE = 20

const embedBodySchema = z.object({
  sourceDocId: z.string().uuid('sourceDocId must be a valid UUID'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = embedBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { sourceDocId } = parsed.data

  // Fetch the source_document record
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('source_documents')
    .select('*')
    .eq('id', sourceDocId)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
  }

  // Mark as processing
  await supabaseAdmin
    .from('source_documents')
    .update({ status: 'processing', error_message: null })
    .eq('id', sourceDocId)

  try {
    // 1. Download the PDF from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('source-documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) {
      throw new Error(`Error descargando archivo de Storage: ${downloadError?.message ?? 'vacío'}`)
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

    // 2. Extract text from PDF
    const { text: rawText } = await extractTextFromPdf(pdfBuffer)

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('La extracción de texto del PDF devolvió contenido vacío.')
    }

    // 3. Chunk the text
    const chunks = chunkText(rawText)

    if (chunks.length === 0) {
      throw new Error('No se pudieron generar fragmentos de texto a partir del documento.')
    }

    // 4. Delete existing chunks (for idempotent re-processing)
    await supabaseAdmin
      .from('document_chunks')
      .delete()
      .eq('source_doc_id', sourceDocId)

    // 5. Embed and insert in batches
    let totalInserted = 0

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + EMBED_BATCH_SIZE)

      // Generate embeddings
      const embeddings = await generateEmbeddings(batchChunks)

      // Build insert rows
      const rows = batchChunks.map((chunkStr, idx) => ({
        source_doc_id: sourceDocId,
        content: chunkStr,
        embedding: embeddings[idx],
        chunk_index: i + idx,
        metadata: {
          area: doc.area,
          category: doc.category,
          source_title: doc.title,
        },
      }))

      const { error: insertError } = await supabaseAdmin
        .from('document_chunks')
        .insert(rows)

      if (insertError) {
        throw new Error(`Error insertando fragmentos en pgvector: ${insertError.message}`)
      }

      totalInserted += rows.length
    }

    // 6. Update source_document to 'ready'
    await supabaseAdmin
      .from('source_documents')
      .update({
        status: 'ready',
        chunk_count: totalInserted,
        error_message: null,
      })
      .eq('id', sourceDocId)

    return NextResponse.json({ success: true, chunkCount: totalInserted }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido durante la vectorización'

    await supabaseAdmin
      .from('source_documents')
      .update({ status: 'error', error_message: message })
      .eq('id', sourceDocId)

    console.error('[POST /api/embed] Error:', message)

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
