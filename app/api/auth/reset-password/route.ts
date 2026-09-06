/**
 * @file app/api/auth/reset-password/route.ts
 * @description POST /api/auth/reset-password
 *
 * Allows CBSJC teachers to securely reset their password directly
 * without reliance on external email confirmation tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit, createRateLimitResponse } from '@/lib/security/rate-limit'

const resetSchema = z.object({
  email: z.string().trim().email('Correo electrónico no válido').toLowerCase(),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres').max(100),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 10 requests / minute per IP
  const rateLimitResult = rateLimit(request, { limit: 10, windowMs: 60 * 1000, prefix: 'api:auth:reset-password' })
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult,
      `Has superado el límite de intentos de restablecimiento. Espera ${rateLimitResult.retryAfterSeconds} segundos.`
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

  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Datos incompletos.'
    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 })
  }

  const { email, newPassword } = parsed.data

  try {
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('[POST /api/auth/reset-password] Error listing users:', listError)
    }

    const user = users?.find((u) => u.email?.toLowerCase() === email)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se encontró ninguna cuenta asociada a este correo electrónico. Por favor verifica o crea una nueva cuenta.',
        },
        { status: 404 }
      )
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
      email_confirm: true,
    })

    if (updateError) {
      console.error('[POST /api/auth/reset-password] Error updating password:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message || 'No fue posible restablecer la contraseña.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada y cuenta confirmada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
    })
  } catch (err) {
    console.error('[POST /api/auth/reset-password] Unexpected error:', err)
    return NextResponse.json(
      {
        success: false,
        error: 'Ocurrió un error inesperado al restablecer la contraseña.',
      },
      { status: 500 }
    )
  }
}
