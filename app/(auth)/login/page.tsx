'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles,
  BookOpen,
  FileCheck2,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Mail,
  GraduationCap,
  AlertCircle,
} from 'lucide-react'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('') // Honeypot trap for bots
  const [emailSent, setEmailSent] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'google' | 'email'>('google')
  const { toast } = useToast()
  const supabase = createClient()

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    // Bot check
    if (honeypot) {
      console.warn('Bot detected via honeypot trap.')
      return
    }

    try {
      setIsLoading(true)
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
      if (error) {
        if (error.message.includes('provider is not enabled') || error.message.includes('Unsupported provider')) {
          toast({
            title: 'Google OAuth pendiente de activación en Supabase',
            description: 'Puedes ingresar directamente con tu correo institucional en el formulario inferior.',
            variant: 'warning',
          })
          setLoginMethod('email')
        } else {
          throw error
        }
      }
    } catch (err) {
      console.error('Login error:', err)
      toast({
        title: 'Error de autenticación',
        description: err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Institutional Magic Link / Email Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    // Honeypot bot protection: silently reject automated submissions
    if (honeypot && honeypot.trim().length > 0) {
      console.warn('Bot submission blocked via honeypot trap.')
      setEmailSent(true)
      return
    }

    if (!email || !email.includes('@')) {
      toast({
        title: 'Correo inválido',
        description: 'Por favor ingresa un correo institucional válido.',
        variant: 'error',
      })
      return
    }

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setEmailSent(true)
      toast({
        title: 'Enlace de acceso enviado',
        description: `Hemos enviado un enlace mágico a ${email}. Revisa tu bandeja de entrada.`,
        variant: 'success',
      })
    } catch (err) {
      console.error('Email login error:', err)
      toast({
        title: 'Error al enviar enlace',
        description: err instanceof Error ? err.message : 'No se pudo enviar el enlace de acceso.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E1B4D] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-[#D71921] selection:text-white">
      {/* Background Glows matching CBSJC Navy and Crimson Red */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#D71921]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] bg-[#162874]/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#D71921]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Institutional Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="relative w-12 h-12 drop-shadow-md">
            <Image
              src="/logo.png"
              alt="Escudo Colegio Bilingüe San José Campestre"
              fill
              priority
              className="object-contain"
            />
          </div>
          <div>
            <span className="font-serif text-xs text-slate-300 block tracking-wide">
              Colegio bilingüe
            </span>
            <span className="text-sm font-black tracking-tight text-white uppercase flex items-center gap-1.5">
              <span className="text-[#D71921]">San José</span> Campestre
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className="bg-white/5 border-white/20 text-slate-200 text-xs px-3 py-1 font-semibold flex items-center gap-1.5 backdrop-blur-md"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Sistema RAG Curricular
        </Badge>
      </header>

      {/* Main Center Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Hero & Pedagogical Value */}
        <div className="lg:col-span-7 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-semibold text-slate-200">
            <GraduationCap className="h-4 w-4 text-[#D71921]" />
            <span>Inteligencia Artificial Curricular para Docentes y Directivos</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Planeación pedagógica <br className="hidden sm:inline" />
              <span className="text-slate-100 font-extrabold">alineada con los</span>{' '}
              <span className="text-[#D71921] underline decoration-white/20 underline-offset-8">
                Documentos Rectores
              </span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl font-normal leading-relaxed">
              Genera planeadores de clase, planes de área e informes pedagógicos con la precisión de <strong className="text-white font-semibold">Gemini 2.0 Flash</strong> y el motor <strong className="text-white font-semibold">RAG de Supabase</strong>, cumpliendo los DBA y lineamientos del CBSJC.
            </p>
          </div>

          {/* Institutional Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#D71921]/20 flex items-center justify-center text-[#D71921]">
                <BookOpen className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Documentos Rectores
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Indexación automática de PDFs institucionales y planes de área.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Momentos de Clase
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Estructura DBA, inicio, desarrollo, evaluación y recursos.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Multi-Exportación
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Descarga en PDF oficial con escudo, Word (.docx) o Google Docs.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Premium Auth Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-8 sm:p-9 shadow-2xl border border-slate-100 text-slate-900 relative">
            {/* Top Red & Navy Brand Stripe */}
            <div className="absolute top-0 left-8 right-8 h-1.5 bg-gradient-to-r from-[#D71921] via-[#162874] to-[#D71921] rounded-b" />

            <div className="space-y-6 pt-1">
              {/* Card Brand Header */}
              <div className="text-center space-y-3">
                <div className="relative w-20 h-20 mx-auto drop-shadow-md">
                  <Image
                    src="/logo.png"
                    alt="Escudo Oficial CBSJC"
                    fill
                    priority
                    className="object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#0E1B4D] tracking-tight">
                    Acceso Institucional
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Ingresa con tu cuenta de correo para acceder a la base de conocimiento y generador curricular.
                  </p>
                </div>
              </div>

              {emailSent ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                  <h3 className="text-sm font-bold text-emerald-900">¡Enlace de acceso enviado!</h3>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Hemos enviado un enlace mágico a <strong>{email}</strong>. Haz clic en el enlace de tu correo para ingresar directamente.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailSent(false)}
                    className="text-xs mt-2 border-emerald-300 text-emerald-800"
                  >
                    Usar otro correo
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Google Workspace Button */}
                  <Button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full h-12 bg-[#162874] hover:bg-[#0E1B4D] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="h-5 w-5 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Continuar con Google Workspace</span>
                      </>
                    )}
                  </Button>

                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <span className="relative bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      o con correo institucional
                    </span>
                  </div>

                  {/* Direct Institutional Email OTP Form */}
                  <form onSubmit={handleEmailLogin} className="space-y-3">
                    {/* Honeypot Trap Input (hidden from real users, filled by bots) */}
                    <div className="opacity-0 absolute -left-[9999px] top-0 h-0 w-0 pointer-events-none overflow-hidden" aria-hidden="true">
                      <label htmlFor="website_institution_check">Do not fill this field</label>
                      <input
                        id="website_institution_check"
                        type="text"
                        name="website_institution_check"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="email"
                          placeholder="tu.nombre@sanjosebilingue.edu.co"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                          required
                          className="pl-10 h-11 text-xs border-slate-200 focus:border-[#162874] rounded-xl"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span>Enviar enlace de acceso directo</span>
                      )}
                    </Button>
                  </form>
                </div>
              )}

              {/* Trust & Security Notes */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <ShieldCheck className="h-4 w-4 text-[#D71921] shrink-0" />
                  <span>Base de datos segura con autenticación Supabase</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Modelos certificados con directrices del MEN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Colegio Bilingüe San José Campestre. Todos los derechos reservados.</p>
        <p className="text-slate-400">
          Sistema de Inteligencia Artificial Curricular RAG
        </p>
      </footer>
    </div>
  )
}
