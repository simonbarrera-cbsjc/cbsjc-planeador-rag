/**
 * @file app/api/generate/route.ts
 * @description POST /api/generate
 *
 * Accepts multipart/form-data with:
 * - 3 Mandatory files: plan_de_area, siap, cuadernillo (PDF, Word .docx, Markdown .md)
 * - Optional additional files (e.g. PRAE, departmental guides)
 * - Pedagogical metadata: docente, area, grado, periodo, semanas, tema, additionalInstructions
 *
 * Extracts text dynamically (with OCR fallback for scanned PDFs), calls Gemini 2.0 Flash
 * with the official SJB-RGA006 Planning Book prompt, generates the 3 deliverables,
 * persists the document, and returns the result.
 */

import { NextRequest, NextResponse } from 'next/server'
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

export const maxDuration = 60 // 60 seconds timeout for heavy OCR / generation

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  // Rate limit check
  const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.generate, user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      `Has excedido el límite de generación (${RATE_LIMIT_PRESETS.generate.limit} por minuto). Por favor espera ${rateLimitResult.retryAfterSeconds} segundos.`
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'FormData inválido o malformado' }, { status: 400 })
  }

  const docente = String(formData.get('docente') || formData.get('author') || '').trim()
  const area = String(formData.get('area') || 'general').trim()
  const grado = String(formData.get('grado') || '').trim()
  const periodo = String(formData.get('periodo') || 'I').trim()
  const semanas = String(formData.get('semanas') || '4 semanas (sesiones de 90 min)').trim()
  const tema = String(formData.get('tema') || formData.get('title') || 'Secuencia Didáctica').trim()
  const additionalInstructions = String(formData.get('additionalInstructions') || formData.get('instrucciones') || '').trim()

  if (!docente) {
    return NextResponse.json({ success: false, error: 'El nombre del docente es requerido' }, { status: 400 })
  }
  if (!tema) {
    return NextResponse.json({ success: false, error: 'El tema o título de la secuencia es requerido' }, { status: 400 })
  }

  // Extract uploaded files
  const planDeAreaFile = formData.get('plan_de_area') as File | null
  const siapFile = formData.get('siap') as File | null
  const cuadernilloFile = formData.get('cuadernillo') as File | null
  const adicionalesFiles = formData.getAll('adicionales') as File[]

  if (!planDeAreaFile || !(planDeAreaFile instanceof File)) {
    return NextResponse.json({ success: false, error: 'El documento Plan de Área es obligatorio' }, { status: 400 })
  }
  if (!siapFile || !(siapFile instanceof File)) {
    return NextResponse.json({ success: false, error: 'El documento SIAP es obligatorio' }, { status: 400 })
  }
  if (!cuadernilloFile || !(cuadernilloFile instanceof File)) {
    return NextResponse.json({ success: false, error: 'El documento Cuadernillo es obligatorio' }, { status: 400 })
  }

  try {
    // 1. Extract text from all files in parallel
    const [planDeAreaRes, siapRes, cuadernilloRes] = await Promise.all([
      planDeAreaFile.arrayBuffer().then((buf) => extractTextFromFile(Buffer.from(buf), planDeAreaFile.name)),
      siapFile.arrayBuffer().then((buf) => extractTextFromFile(Buffer.from(buf), siapFile.name)),
      cuadernilloFile.arrayBuffer().then((buf) => extractTextFromFile(Buffer.from(buf), cuadernilloFile.name)),
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
        const buf = await addFile.arrayBuffer()
        const extRes = await extractTextFromFile(Buffer.from(buf), addFile.name)
        contextDocs.push({
          tipo: 'adicional',
          filename: addFile.name,
          content: extRes.text,
        })
      }
    }

    // 2. Call AI Generator for official SJB-RGA006 Planning Book
    const generated = await generatePlanningDocument({
      docente,
      area,
      grado,
      periodo,
      semanas,
      tema,
      additionalInstructions,
      language: 'es',
      contextDocs,
    })

    // Store metadata & structured output as JSON inside content / additional_instructions
    const combinedPayload = JSON.stringify({
      planningBookMarkdown: generated.planningBookMarkdown,
      rubricsMarkdown: generated.rubricsMarkdown,
      cibercolegiosSnippet: generated.cibercolegiosSnippet,
      excelSpec: generated.excelSpec,
      metadata: {
        docente,
        area,
        grado,
        periodo,
        semanas,
        tema,
        files: contextDocs.map((d) => ({ tipo: d.tipo, name: d.filename })),
      },
    })

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
        periodo: periodo as any,
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
        { success: false, error: 'No se pudo registrar la planeación en la base de datos' },
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
    const msg = err instanceof Error ? err.message : 'Error desconocido en la generación'
    console.error('[POST /api/generate] Execution error:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
