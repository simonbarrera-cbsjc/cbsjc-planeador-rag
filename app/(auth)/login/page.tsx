'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
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
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password')
  const [email, setEmail] = useState('simon.barrera@sanjosebilingue.edu.co')
  const [password, setPassword] = useState('cbsjcPassword2026!')
  const [showPassword, setShowPassword] = useState(false)
  const [honeypot, setHoneypot] = useState('') // Honeypot trap for bots
  const [emailSent, setEmailSent] = useState(false)

  // Password Login Handler
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      console.warn('Bot detected via honeypot trap.')
      return
    }

    if (!email || !email.includes('@')) {
      toast({ title: 'Correo inválido', description: 'Ingresa un correo institucional.', variant: 'error' })
      return
    }

    if (!password) {
      toast({ title: 'Contraseña requerida', description: 'Ingresa tu contraseña institucional.', variant: 'warning' })
      return
    }

    try {
      setIsLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) throw error

      toast({
        title: '¡Bienvenido!',
        description: 'Sesión iniciada correctamente. Redirigiendo al panel...',
        variant: 'success',
      })

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Password login error:', err)
      toast({
        title: 'Error de acceso',
        description: err instanceof Error ? err.message : 'Credenciales incorrectas.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    if (honeypot) return

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
        throw error
      }
    } catch (err) {
      console.error('Google OAuth error:', err)
      toast({
        title: 'Google OAuth pendiente en Supabase',
        description: 'Activa Google en Supabase Dashboard > Authentication > Providers o usa el formulario de contraseña abajo.',
        variant: 'warning',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Email Magic Link OTP Login
  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) return

    if (!email || !email.includes('@')) {
      toast({ title: 'Correo inválido', description: 'Ingresa un correo válido.', variant: 'error' })
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
        title: 'Enlace enviado',
        description: `Hemos enviado un enlace a ${email}.`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error al enviar enlace',
        description: err instanceof Error ? err.message : 'Error desconocido.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E1B4D] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-[#D71921] selection:text-white">
      {/* Dynamic Background Glows matching CBSJC Navy and Crimson Red */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#D71921]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] bg-[#162874]/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#D71921]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
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
          Sistema RAG v2.0
        </Badge>
      </header>

      {/* Main Center Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Hero */}
        <div className="lg:col-span-7 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-semibold text-slate-200">
            <GraduationCap className="h-4 w-4 text-[#D71921]" />
            <span>Inteligencia Artificial Curricular para el CBSJC</span>
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

          {/* Highlights */}
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

        {/* Right Column: Auth Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-8 sm:p-9 shadow-2xl border border-slate-100 text-slate-900 relative">
            {/* Top Red & Navy Brand Stripe */}
            <div className="absolute top-0 left-8 right-8 h-1.5 bg-gradient-to-r from-[#D71921] via-[#162874] to-[#D71921] rounded-b" />

            <div className="space-y-5 pt-1">
              {/* Card Header */}
              <div className="text-center space-y-2.5">
                <div className="relative w-16 h-16 mx-auto drop-shadow-md">
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
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ingresa con tu correo docente o directivo para acceder.
                  </p>
                </div>
              </div>

              {/* Password Login Form (Active) */}
              <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                {/* Honeypot Trap */}
                <input
                  type="text"
                  name="website_institution_check"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="opacity-0 absolute -left-[9999px] w-0 h-0 pointer-events-none"
                />

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Correo Institucional
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="simon.barrera@sanjosebilingue.edu.co"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-10 h-11 text-xs border-slate-200 focus:border-[#162874] rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-10 pr-10 h-11 text-xs border-slate-200 focus:border-[#162874] rounded-xl font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Ingresar al Sistema</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center justify-center pt-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  o ingresar con Google
                </span>
              </div>

              {/* Google Workspace Button */}
              <Button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                variant="outline"
                className="w-full h-11 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2.5"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Google Workspace</span>
              </Button>

              {/* Security & Verification Footer */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#D71921] shrink-0" />
                  <span>Base de datos cifrada y protegida por RLS</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Modelos Gemini 2.0 certificados con lineamientos MEN</span>
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
