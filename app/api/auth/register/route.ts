/**
 * @file app/api/auth/register/route.ts
 * @description POST /api/auth/register
 *
 * Secure server-side user registration for CBSJC teachers.
 * Creates the user in Supabase with auto-confirmation (email_confirm: true)
 * to avoid email delivery failures, spam filters, or broken confirmation links.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit, createRateLimitResponse } from '@/lib/security/rate-limit'

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre completo debe tener al menos 2 caracteres').max(100),
  email: z.string().trim().email('Correo electrónico no válido').toLowerCase(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 10 requests / minute per IP
  const rateLimitResult = rateLimit(request, { limit: 10, windowMs: 60 * 1000, prefix: 'api:auth:register' })
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      `Has superado el límite de intentos de registro. Espera ${rateLimitResult.retryAfterSeconds} segundos.`
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Cuerpo de solicitud no válido (JSON inválido).' },
      { status: 400 }
    )
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Datos de registro incompletos.'
    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 })
  }

  const { fullName, email, password } = parsed.data

  try {
    // Check if user already exists
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('[POST /api/auth/register] Error listing users:', listError)
    }

    const existingUser = users?.find((u) => u.email?.toLowerCase() === email)

    if (existingUser) {
      // If user exists but is unconfirmed, confirm them and update their password
      if (!existingUser.email_confirmed_at) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })

        if (updateError) {
          console.error('[POST /api/auth/register] Error updating unconfirmed user:', updateError)
          return NextResponse.json(
            { success: false, error: 'No fue posible validar la cuenta existente. Intenta iniciar sesión.' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Cuenta confirmada y contraseña actualizada exitosamente.',
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Este correo ya se encuentra registrado. Si no recuerdas tu contraseña, utiliza la opción "Restablecer contraseña".',
        },
        { status: 409 }
      )
    }

    // Create new user with email confirmed automatically
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (createError) {
      console.error('[POST /api/auth/register] Error creating user:', createError)
      return NextResponse.json(
        { success: false, error: createError.message || 'No fue posible crear la cuenta.' },
        { status: 500 }
      )
    }

    // Ensure profile row exists in public.profiles
    if (createData.user) {
      try {
        await supabaseAdmin.from('profiles').upsert({
          id: createData.user.id,
          email,
          full_name: fullName,
          role: 'teacher',
          language: 'es',
          updated_at: new Date().toISOString(),
        })
      } catch (profileErr) {
        console.warn('[POST /api/auth/register] Profile upsert warning:', profileErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cuenta de docente creada y confirmada exitosamente.',
    })
  } catch (err) {
    console.error('[POST /api/auth/register] Unexpected error:', err)
    return NextResponse.json(
      {
        success: false,
        error: 'Ocurrió un error inesperado al procesar el registro.',
      },
      { status: 500 }
    )
  }
}
