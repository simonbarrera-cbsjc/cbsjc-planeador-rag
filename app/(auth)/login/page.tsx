'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck, Sparkles, BookOpen, FileCheck2, Loader2, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
    } catch (err) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión con Google')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Branding Crest / Shield */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-24 h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-white/80 bg-white flex items-center justify-center p-2">
            <Image
              src="/logo.png"
              alt="Logo Colegio Bilingüe San José Campestre"
              width={88}
              height={88}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#003087]">
              Colegio Bilingüe San José Campestre
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C8A84B] mt-1">
              Sistema Inteligente de Planeación RAG
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200/80 shadow-xl bg-white/95 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-slate-800">
              Acceso Institucional
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Ingresa con tu correo institucional de Google para acceder al generador de documentos y base de conocimiento.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 text-sm font-semibold bg-[#003087] hover:bg-[#002060] text-white transition-all shadow-md flex items-center justify-center gap-3"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.5.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17c1.8 3.7 5.6 6.5 10.1 6.5z"
                  />
                </svg>
              )}
              {loading ? 'Iniciando sesión...' : 'Continuar con Google Workspace'}
            </Button>

            <div className="pt-2 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-[#003087]" />
                  <span>Planes de Área y Clase</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#C8A84B]" />
                  <span>IA Curricular Precisa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#003087]" />
                  <span>Documentos Rectores</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Seguridad Supabase</span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-100 bg-slate-50/50 py-3 rounded-b-xl">
            <p className="text-[11px] text-slate-500 text-center">
              Exclusivo para la comunidad docente y directiva del CBSJC
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
