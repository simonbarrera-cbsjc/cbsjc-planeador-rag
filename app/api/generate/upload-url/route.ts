/**
 * @file app/api/generate/upload-url/route.ts
 * @description Generates signed upload URLs for direct client-to-Supabase Storage uploads.
 * This completely bypasses Vercel's 4.5 MB request body limit on Serverless Functions,
 * allowing large PDF and DOCX files to be uploaded safely directly from the browser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitResponse,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const STORAGE_BUCKET = 'source-documents'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB per file
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.md', '.txt']

const fileRequestSchema = z.object({
  files: z
    .array(
      z.object({
        key: z.string().min(1),
        filename: z.string().min(1),
        contentType: z.string().optional(),
        size: z.number().max(MAX_FILE_SIZE, 'El archivo supera el límite de 50 MB'),
      })
    )
    .min(1)
    .max(10),
})

function isAllowedFile(name: string): boolean {
  const lower = name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function sanitiseFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 100)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Sesión no válida o expirada. Por favor inicia sesión.' },
      { status: 401 }
    )
  }

  const rateLimitResult = rateLimit(request, RATE_LIMIT_PRESETS.default, user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      'Demasiadas solicitudes de subida. Por favor espera un momento.'
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Cuerpo de solicitud inválido (se esperaba JSON).' },
      { status: 400 }
    )
  }

  const parsed = fileRequestSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join('. ')
    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 })
  }

  const uploads: Array<{
    key: string
    filename: string
    storagePath: string
    signedUrl: string
    token: string
    contentType: string
  }> = []

  const timestamp = Date.now()

  for (const item of parsed.data.files) {
    if (!isAllowedFile(item.filename)) {
      return NextResponse.json(
        {
          success: false,
          error: `Formato no permitido en "${item.filename}". Permitidos: PDF, Word (.docx), Markdown (.md, .txt).`,
        },
        { status: 415 }
      )
    }

    const safeName = sanitiseFilename(item.filename)
    const randomSuffix = Math.random().toString(36).slice(2, 8)
    const storagePath = `temp-generation/${user.id}/${timestamp}-${randomSuffix}-${safeName}`

    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('[upload-url] Error creating signed URL:', error?.message)
      return NextResponse.json(
        {
          success: false,
          error: `Error preparando la subida segura para "${item.filename}": ${error?.message || 'Error desconocido'}`,
        },
        { status: 500 }
      )
    }

    uploads.push({
      key: item.key,
      filename: item.filename,
      storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
      contentType: item.contentType || 'application/octet-stream',
    })
  }

  return NextResponse.json({
    success: true,
    uploads,
  })
}
