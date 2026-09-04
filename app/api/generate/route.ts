/**
 * @file app/api/generate/route.ts
 * @description POST /api/generate
 *
 * Accepts multipart/form-data with:
 * - 3 Mandatory files: plan_de_area, siap, cuadernillo (PDF, Word .docx, Markdown .md)
 * - Optional additional files (e.g. PRAE, departmental guides)
 * - Pedagogical metadata: docente, area, grado, periodo, semanas, tema, additionalInstructions
 *
 * Extracts text polymorphically (with OCR fallback for scanned PDFs), calls Gemini
 * multi-model fallback with the official SJB-RGA006 Planning Book prompt, generates
 * the 3 deliverables, persists the document in Supabase, and returns the result.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generatePlanningDocument } from '@/lib/ai/generator'
import { extractTextFromFile } from '@/lib/ai/file-extractor'
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitResponse,
  addRateLimitHeaders,
} from '@/lib/security/rate-limit'

export const maxDuration = 300 // 300 seconds timeout for exhaustive 18+ page AI generation and deep extraction

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB per file
const MAX_TOTAL_SIZE_BYTES = 60 * 1024 * 1024 // 60 MB total payload
const MAX_ADDITIONAL_FILES = 5

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.md', '.txt']

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

const generateFormSchema = z.object({
  docente: z.string().trim().min(1, 'El nombre del docente es obligatorio').max(200, 'El nombre no puede superar 200 caracteres'),
  area: z.string().trim().max(100, 'El área no puede superar 100 caracteres').default('general'),
  grado: z.string().trim().max(100, 'El grado no puede superar 100 caracteres').default(''),
  periodo: z.enum(['I', 'II', 'III', 'IV']).default('I'),
  semanas: z.string().trim().max(150, 'El campo semanas no puede superar 150 caracteres').default('4 semanas (sesiones de 90 min)'),
  semanasEfectivas: z.string().trim().max(150, 'El campo semanas efectivas no puede superar 150 caracteres').default('4 semanas efectivas de clase directa'),
  tema: z.string().trim().min(1, 'El tema o pregunta de sentido es obligatorio').max(300, 'El tema no puede superar 300 caracteres'),
  additionalInstructions: z.string().trim().max(3000, 'Las instrucciones adicionales no pueden superar 3000 caracteres').default(''),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Sesión no válida o expirada. Por favor, inicia sesión nuevamente en el sistema CBSJC.',
      },
      { status: 401 }
    )
  }

  // Rate limit check
  const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.generate, user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      `Has alcanzado el límite de generación (${RATE_LIMIT_PRESETS.generate.limit} por minuto). Por favor espera ${rateLimitResult.retryAfterSeconds} segundos antes de intentar nuevamente.`
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Los datos del formulario están dañados o no pudieron ser procesados (FormData inválido).',
      },
      { status: 400 }
    )
  }

  const rawPeriodo = String(formData.get('periodo') || 'I').trim().toUpperCase()
  let normalizedPeriodo: 'I' | 'II' | 'III' | 'IV' = 'I'
  if (rawPeriodo.includes('IV') || rawPeriodo === '4') normalizedPeriodo = 'IV'
  else if (rawPeriodo.includes('III') || rawPeriodo === '3') normalizedPeriodo = 'III'
  else if (rawPeriodo.includes('II') || rawPeriodo === '2') normalizedPeriodo = 'II'
  else normalizedPeriodo = 'I'

  const rawFormData = {
    docente: String(formData.get('docente') || formData.get('author') || '').trim(),
    area: String(formData.get('area') || 'general').trim(),
    grado: String(formData.get('grado') || '').trim(),
    periodo: normalizedPeriodo,
    semanas: String(formData.get('semanas') || '4 semanas (sesiones de 90 min)').trim(),
    semanasEfectivas: String(formData.get('semanasEfectivas') || formData.get('semanas_efectivas') || '4 semanas efectivas de clase directa').trim(),
    tema: String(formData.get('tema') || formData.get('title') || 'Secuencia Didáctica').trim(),
    additionalInstructions: String(formData.get('additionalInstructions') || formData.get('instrucciones') || '').trim(),
  }

  const parsedFields = generateFormSchema.safeParse(rawFormData)
  if (!parsedFields.success) {
    return NextResponse.json(
      { success: false, error: parsedFields.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { docente, area, grado, periodo, semanas, semanasEfectivas, tema, additionalInstructions } = parsedFields.data

  // Extract uploaded files
  const planDeAreaFile = formData.get('plan_de_area') as File | null
  const siapFile = formData.get('siap') as File | null
  const cuadernilloFile = formData.get('cuadernillo') as File | null
  const adicionalesFiles = formData.getAll('adicionales') as File[]

  if (!planDeAreaFile || !(planDeAreaFile instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: 'El documento rector "Plan de Área" es obligatorio para la alineación curricular del CBSJC.',
      },
      { status: 400 }
    )
  }
  if (!siapFile || !(siapFile instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: 'El documento "SIAP" (Malla Curricular Institucional) es obligatorio para estructurar la secuencia.',
      },
      { status: 400 }
    )
  }
  if (!cuadernilloFile || !(cuadernilloFile instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: 'El documento "Cuadernillo de Asignatura" es obligatorio como referente evaluativo.',
      },
      { status: 400 }
    )
  }

  // Validate file types and sizes
  const mandatoryFiles = [
    { file: planDeAreaFile, label: 'Plan de Área' },
    { file: siapFile, label: 'SIAP' },
    { file: cuadernilloFile, label: 'Cuadernillo' },
  ]

  let totalBytes = 0
  for (const { file, label } of mandatoryFiles) {
    if (!isAllowedFile(file)) {
      return NextResponse.json(
        { success: false, error: `Formato no permitido para "${label}" (${file.name}). Permitidos: PDF, Word (.docx), Markdown (.md, .txt).` },
        { status: 415 }
      )
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `El archivo "${label}" supera el tamaño máximo permitido de 25 MB.` },
        { status: 413 }
      )
    }
    totalBytes += file.size
  }

  if (adicionalesFiles.length > MAX_ADDITIONAL_FILES) {
    return NextResponse.json(
      { success: false, error: `Se permite un máximo de ${MAX_ADDITIONAL_FILES} documentos adicionales.` },
      { status: 400 }
    )
  }

  for (const addFile of adicionalesFiles) {
    if (addFile instanceof File && addFile.size > 0) {
      if (!isAllowedFile(addFile)) {
        return NextResponse.json(
          { success: false, error: `Formato no permitido en documento adicional (${addFile.name}).` },
          { status: 415 }
        )
      }
      if (addFile.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: `El documento adicional "${addFile.name}" supera los 25 MB.` },
          { status: 413 }
        )
      }
      totalBytes += addFile.size
    }
  }

  if (totalBytes > MAX_TOTAL_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: `El tamaño acumulado de los archivos excede el límite de 60 MB.` },
      { status: 413 }
    )
  }

  try {
    // 1. Extract text from all files in parallel with descriptive error tracking
    const extractFileSafely = async (file: File, label: string) => {
      try {
        const buf = await file.arrayBuffer()
        return await extractTextFromFile(Buffer.from(buf), file.name, file.type)
      } catch (extractErr) {
        const detail = extractErr instanceof Error ? extractErr.message : String(extractErr)
        throw new Error(`Error en el documento "${label}" (${file.name}): ${detail}`)
      }
    }

    const [planDeAreaRes, siapRes, cuadernilloRes] = await Promise.all([
      extractFileSafely(planDeAreaFile, 'Plan de Área'),
      extractFileSafely(siapFile, 'SIAP'),
      extractFileSafely(cuadernilloFile, 'Cuadernillo'),
    ])

    const contextDocs: Array<{
      tipo: 'plan_de_area' | 'siap' | 'cuadernillo' | 'adicional'
      filename: string
      content: string
    }> = [
      { tipo: 'plan_de_area', filename: planDeAreaFile.name, content: planDeAreaRes.text },
      { tipo: 'siap', filename: siapFile.name, content: siapRes.text },
      { tipo: 'cuadernillo', filename: cuadernilloFile.name, content: cuadernilloRes.text },
    ]

    // Process additional files if present
    for (const addFile of adicionalesFiles) {
      if (addFile instanceof File && addFile.size > 0) {
        try {
          const extRes = await extractFileSafely(addFile, 'Documento Adicional')
          contextDocs.push({
            tipo: 'adicional',
            filename: addFile.name,
            content: extRes.text,
          })
        } catch (addErr) {
          console.warn(`[POST /api/generate] Skipping unreadable additional file ${addFile.name}:`, addErr)
        }
      }
    }

    // Verify that at least some readable text was extracted
    const totalChars = contextDocs.reduce((acc, doc) => acc + doc.content.length, 0)
    if (totalChars < 50) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Los documentos subidos contienen muy poco texto o no pudieron ser leídos. Por favor verifica que los archivos PDF, Word o Markdown contengan texto o imágenes nítidas.',
        },
        { status: 422 }
      )
    }

    // 2. Call AI Generator for official SJB-RGA006 Planning Book
    const generated = await generatePlanningDocument({
      docente,
      area,
      grado,
      periodo: normalizedPeriodo,
      semanas,
      semanasEfectivas,
      tema,
      additionalInstructions,
      language: 'es',
      contextDocs,
    })

    // Store metadata & structured output as JSON inside content
    const combinedPayload = JSON.stringify({
      planningBookMarkdown: generated.planningBookMarkdown,
      rubricsMarkdown: generated.rubricsMarkdown,
      cibercolegiosSnippet: generated.cibercolegiosSnippet,
      excelSpec: generated.excelSpec,
      metadata: {
        docente,
        area,
        grado,
        periodo: normalizedPeriodo,
        semanas,
        semanasEfectivas,
        tema,
        files: contextDocs.map((d) => ({ tipo: d.tipo, name: d.filename })),
      },
    })

    // Ensure user profile exists to avoid FK constraint errors
    await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Docente',
          avatar_url: user.user_metadata?.avatar_url || null,
        },
        { onConflict: 'id' }
      )

    // 3. Save to generated_documents table in Supabase
    const { data: savedDoc, error: insertError } = await supabaseAdmin
      .from('generated_documents')
      .insert({
        user_id: user.id,
        title: `Secuencia Didáctica: ${tema} (${grado || area})`,
        document_type: 'planeador',
        nivel: 'general',
        area: area as any,
        grado: grado || null,
        periodo: normalizedPeriodo,
        content: combinedPayload,
        additional_instructions: additionalInstructions || null,
        sources_used: contextDocs.length,
        status: 'generated',
        language: 'es',
      })
      .select('id')
      .single()

    if (insertError || !savedDoc) {
      console.error('[POST /api/generate] DB insert error:', insertError?.message)
      return NextResponse.json(
        {
          success: false,
          error:
            'No se pudo registrar la planeación en la base de datos institucional. Por favor intenta de nuevo.',
        },
        { status: 500 }
      )
    }

    const successResponse = NextResponse.json(
      {
        success: true,
        documentId: savedDoc.id,
        title: tema,
        sourcesUsed: contextDocs.length,
      },
      { status: 201 }
    )

    return addRateLimitHeaders(successResponse, rateLimitResult)
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Error inesperado durante la generación'
    console.error('[POST /api/generate] Generation failure:', rawMsg)

    // Determine appropriate HTTP status code based on error nature
    let statusCode = 500
    if (rawMsg.includes('alta demanda') || rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
      statusCode = 503
    } else if (rawMsg.includes('límite de tasa') || rawMsg.includes('cuota') || rawMsg.includes('429')) {
      statusCode = 429
    } else if (rawMsg.includes('Error en el documento') || rawMsg.includes('dañado')) {
      statusCode = 422
    }

    return NextResponse.json({ success: false, error: rawMsg }, { status: statusCode })
  }
}
