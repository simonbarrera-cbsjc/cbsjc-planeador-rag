import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TablesUpdate } from '@/types/supabase'
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitResponse,
  addRateLimitHeaders,
} from '@/lib/security/rate-limit'

const getQuerySchema = z.object({
  id: z.string().uuid('ID de documento debe ser un UUID válido').optional(),
})

const patchBodySchema = z.object({
  id: z.string().uuid('ID de documento debe ser un UUID válido'),
  title: z.string().min(1, 'El título no puede estar vacío').max(300, 'El título no puede exceder 300 caracteres').trim().optional(),
  content: z.string().min(1, 'El contenido no puede estar vacío').max(150000, 'El contenido excede el tamaño máximo permitido').optional(),
})

const deleteQuerySchema = z.object({
  id: z.string().uuid('ID de documento debe ser un UUID válido'),
})

// GET /api/generated-documents or GET /api/generated-documents?id=...
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.default, user.id)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        rateLimitResult,
        `Has excedido el límite de solicitudes (${RATE_LIMIT_PRESETS.default.limit} por minuto). Por favor espera ${rateLimitResult.retryAfterSeconds} segundos.`
      )
    }

    const { searchParams } = new URL(request.url)
    const rawId = searchParams.get('id') || undefined

    const parsed = getQuerySchema.safeParse({ id: rawId })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { id } = parsed.data

    if (id) {
      const { data: document, error } = await supabaseAdmin
        .from('generated_documents')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error || !document) {
        return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
      }

      const successResponse = NextResponse.json({ success: true, document })
      return addRateLimitHeaders(successResponse, rateLimitResult)
    }

    // List all user's generated documents
    const { data: documents, error } = await supabaseAdmin
      .from('generated_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const successResponse = NextResponse.json({ success: true, documents: documents || [] })
    return addRateLimitHeaders(successResponse, rateLimitResult)
  } catch (error) {
    console.error('Error fetching generated documents:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

// PATCH /api/generated-documents (update content/title)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.default, user.id)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        rateLimitResult,
        `Has excedido el límite de modificaciones. Por favor espera ${rateLimitResult.retryAfterSeconds} segundos.`
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
    }

    const parsed = patchBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { id, content, title } = parsed.data

    const updatePayload: TablesUpdate<'generated_documents'> = {
      updated_at: new Date().toISOString(),
    }
    if (content !== undefined) updatePayload.content = content
    if (title !== undefined) updatePayload.title = title

    const { data: updated, error } = await supabaseAdmin
      .from('generated_documents')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ success: false, error: 'Documento no encontrado o error al actualizar' }, { status: 404 })
    }

    const successResponse = NextResponse.json({ success: true, document: updated })
    return addRateLimitHeaders(successResponse, rateLimitResult)
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

// DELETE /api/generated-documents?id=...
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.upload, user.id)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        rateLimitResult,
        `Has excedido el límite de eliminación. Por favor espera ${rateLimitResult.retryAfterSeconds} segundos.`
      )
    }

    const { searchParams } = new URL(request.url)
    const rawId = searchParams.get('id')

    const parsed = deleteQuerySchema.safeParse({ id: rawId })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { id } = parsed.data

    const { error } = await supabaseAdmin
      .from('generated_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    const successResponse = NextResponse.json({ success: true })
    return addRateLimitHeaders(successResponse, rateLimitResult)
  } catch (error) {
    console.error('Error deleting generated document:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
