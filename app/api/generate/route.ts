/**
 * @file app/api/generate/route.ts
 * @description POST /api/generate
 *
 * Accepts generation parameters, retrieves semantically relevant chunks
 * from the vector store, calls the LLM generator (Gemini 2.0 Flash),
 * persists the result, and returns the generated document.
 *
 * Auth: Supabase session required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { retrieveRelevantChunks } from '@/lib/ai/retrieval'
import { generateDocument } from '@/lib/ai/generator'
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitResponse,
  addRateLimitHeaders,
} from '@/lib/security/rate-limit'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const DOCUMENT_TYPES = [
  'planeador',
  'plan_area',
  'informe',
  'circular',
  'proyecto_pedagogico',
] as const

const DOCUMENT_CATEGORIES = [
  'primaria',
  'secundaria',
  'bachillerato',
  'general',
] as const

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

const PERIODOS = ['I', 'II', 'III', 'IV'] as const
const LANGUAGES = ['es', 'en'] as const

const generateBodySchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  language: z.enum(LANGUAGES),
  nivel: z.enum(DOCUMENT_CATEGORIES),
  area: z.enum(DOCUMENT_AREAS),
  grado: z.string().max(50).trim().optional(),
  periodo: z.enum(PERIODOS).optional(),
  additionalInstructions: z.string().max(3000).trim().optional(),
  title: z.string().min(1, 'El título es obligatorio').max(300, 'El título no puede exceder 300 caracteres').trim(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  // 2. Rate limit check (10 requests/minute per authenticated user or IP)
  const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.generate, user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      `Has excedido el límite de generación (${RATE_LIMIT_PRESETS.generate.limit} solicitudes por minuto). Por favor espera ${rateLimitResult.retryAfterSeconds} segundos antes de intentar nuevamente.`
    )
  }

  // 3. Parse + validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = generateBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const params = parsed.data

  // 4. Build a comprehensive search query for RAG retrieval
  const searchQuery = [
    params.title,
    params.documentType,
    params.area,
    params.nivel,
    params.grado,
    params.periodo ? `Periodo ${params.periodo}` : null,
    params.additionalInstructions,
  ]
    .filter(Boolean)
    .join(' ')

  // 5. Retrieve relevant chunks with area + category filters
  let contextChunks: Array<{ content: string; similarity: number }> = []
  try {
    const matched = await retrieveRelevantChunks(searchQuery, {
      filterArea: params.area,
      filterCategory: params.nivel,
      matchCount: 10,
      matchThreshold: 0.5,
    })
    contextChunks = (matched || []).map((m) => ({
      content: m.content,
      similarity: m.similarity,
    }))
  } catch (err) {
    console.warn('[POST /api/generate] Semantic retrieval note:', err)
    // Fallback: Proceed with general curricular knowledge
    contextChunks = []
  }

  // 6. Generate document via Gemini 2.0 Flash
  let generatedContent: string
  try {
    generatedContent = await generateDocument({
      documentType: params.documentType,
      language: params.language,
      nivel: params.nivel,
      area: params.area,
      grado: params.grado,
      periodo: params.periodo,
      additionalInstructions: params.additionalInstructions,
      title: params.title,
      contextChunks,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error durante la llamada a IA'
    console.error('[POST /api/generate] Generator error:', message)
    return NextResponse.json(
      { success: false, error: `Error generando documento: ${message}` },
      { status: 500 }
    )
  }

  // 7. Persist the generated document to Supabase
  const { data: savedDoc, error: insertError } = await supabaseAdmin
    .from('generated_documents')
    .insert({
      user_id: user.id,
      title: params.title,
      document_type: params.documentType,
      nivel: params.nivel,
      area: params.area,
      grado: params.grado || null,
      periodo: params.periodo || null,
      content: generatedContent,
      additional_instructions: params.additionalInstructions || null,
      sources_used: contextChunks.length,
      status: 'generated',
      language: params.language,
    })
    .select('id')
    .single()

  if (insertError || !savedDoc) {
    console.error('[POST /api/generate] DB insert error:', insertError?.message)
    return NextResponse.json(
      { success: false, error: 'No se pudo guardar el documento generado en la base de datos' },
      { status: 500 }
    )
  }

  // 8. Return success with rate limit headers
  const successResponse = NextResponse.json(
    {
      success: true,
      documentId: savedDoc.id,
      content: generatedContent,
      sourcesUsed: contextChunks.length,
    },
    { status: 200 }
  )

  return addRateLimitHeaders(successResponse, rateLimitResult)
}
