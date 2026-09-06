'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  User,
  GraduationCap,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  RotateCcw,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [isLoading, setIsLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [honeypot, setHoneypot] = useState('') // Anti-bot honeypot trap

  // Check URL parameters for auth callback notifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const errorParam = params.get('error')
      if (errorParam === 'auth_callback_failed') {
        toast({
          title: 'Aviso de autenticación',
          description:
            'Si estabas validando tu cuenta por correo, ahora puedes iniciar sesión directamente o restablecer tu contraseña si es necesario.',
          variant: 'warning',
        })
      }
    }
  }, [toast])

  // Handle Login
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      setIsLoading(true)
      await new Promise((res) => setTimeout(res, 1200))
      setIsLoading(false)
      toast({
        title: 'Error de autenticación',
        description: 'No fue posible verificar las credenciales proporcionadas.',
        variant: 'error',
      })
      return
    }

    if (!email || !email.includes('@')) {
      toast({
        title: 'Correo requerido',
        description: 'Por favor ingresa un correo electrónico válido.',
        variant: 'warning',
      })
      return
    }

    if (!password) {
      toast({
        title: 'Contraseña requerida',
        description: 'Por favor ingresa tu contraseña.',
        variant: 'warning',
      })
      return
    }

    try {
      setIsLoading(true)
      const cleanEmail = email.trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Credenciales incorrectas. Si eres un usuario nuevo o no recuerdas tu clave, haz clic en "¿Olvidaste tu contraseña?" para restablecerla o validarla.')
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Tu correo aún no ha sido confirmado. Puedes restablecer tu contraseña abajo para validar tu cuenta al instante.')
        }
        throw error
      }

      toast({
        title: '¡Bienvenido al CBSJC!',
        description: 'Sesión iniciada con éxito. Accediendo al sistema...',
        variant: 'success',
      })

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Sign-in error:', err)
      toast({
        title: 'Error de inicio de sesión',
        description: err instanceof Error ? err.message : 'Credenciales incorrectas.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Sign Up (Server-side auto-confirm for instant access)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      setIsLoading(true)
      await new Promise((res) => setTimeout(res, 1200))
      setIsLoading(false)
      toast({
        title: 'Error de registro',
        description: 'No fue posible completar la solicitud en este momento.',
        variant: 'error',
      })
      return
    }

    if (!fullName.trim()) {
      toast({
        title: 'Nombre requerido',
        description: 'Por favor ingresa tu nombre completo.',
        variant: 'warning',
      })
      return
    }

    if (!email || !email.includes('@')) {
      toast({
        title: 'Correo requerido',
        description: 'Por favor ingresa un correo válido.',
        variant: 'warning',
      })
      return
    }

    if (!password || password.length < 6) {
      toast({
        title: 'Contraseña débil',
        description: 'La contraseña debe tener al menos 6 caracteres.',
        variant: 'warning',
      })
      return
    }

    try {
      setIsLoading(true)
      const cleanEmail = email.trim().toLowerCase()

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          password,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'No fue posible registrar la cuenta.')
      }

      // Auto sign-in immediately after server auto-confirm
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (signInError) {
        toast({
          title: 'Cuenta creada y validada',
          description: 'Tu cuenta ha sido activada con éxito. Por favor inicia sesión con tu contraseña.',
          variant: 'success',
        })
        setMode('signin')
      } else {
        toast({
          title: '¡Cuenta creada con éxito!',
          description: 'Accediendo directamente a la plataforma CBSJC...',
          variant: 'success',
        })
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      console.error('Sign-up error:', err)
      toast({
        title: 'Error en el registro',
        description: err instanceof Error ? err.message : 'No se pudo crear la cuenta.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Password Reset / Account Validation
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      setIsLoading(true)
      await new Promise((res) => setTimeout(res, 1200))
      setIsLoading(false)
      return
    }

    if (!email || !email.includes('@')) {
      toast({
        title: 'Correo requerido',
        description: 'Por favor ingresa tu correo electrónico.',
        variant: 'warning',
      })
      return
    }

    if (!password || password.length < 6) {
      toast({
        title: 'Contraseña requerida',
        description: 'La nueva contraseña debe tener al menos 6 caracteres.',
        variant: 'warning',
      })
      return
    }

    try {
      setIsLoading(true)
      const cleanEmail = email.trim().toLowerCase()

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          newPassword: password,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'No se pudo restablecer la contraseña.')
      }

      // Auto sign-in with new password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (signInError) {
        toast({
          title: 'Contraseña actualizada',
          description: 'Tu contraseña ha sido actualizada y tu cuenta validada. Inicia sesión ahora.',
          variant: 'success',
        })
        setMode('signin')
      } else {
        toast({
          title: '¡Contraseña actualizada!',
          description: 'Cuenta validada exitosamente. Accediendo al sistema...',
          variant: 'success',
        })
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      console.error('Reset password error:', err)
      toast({
        title: 'Error al restablecer',
        description: err instanceof Error ? err.message : 'No fue posible actualizar la contraseña.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E1B4D] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-[#D71921] selection:text-white">
      {/* Background Glows with CBSJC Navy & Crimson Red */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#D71921]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] bg-[#162874]/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#A6174B]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Institutional Top Header */}
      <Header variant="auth" />

      {/* Main Center Grid */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Pedagogical Value */}
        <div className="lg:col-span-7 space-y-7 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-semibold text-slate-200">
            <GraduationCap className="h-4 w-4 text-[#D71921]" />
            <span>Inteligencia Artificial Curricular para Docentes y Directivos</span>
          </div>

          <div className="space-y-3.5">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Planeación pedagógica <br className="hidden sm:inline" />
              <span className="text-slate-100 font-extrabold">alineada con los</span>{' '}
              <span className="text-[#D71921] underline decoration-white/20 underline-offset-8">
                Documentos Rectores
              </span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl font-normal leading-relaxed">
              Genera en un único flujo de trabajo la secuencia didáctica <strong className="text-white font-semibold">Planning Book (SJB-RGA006)</strong>, las <strong className="text-white font-semibold">Rúbricas Evaluativas</strong> y la <strong className="text-white font-semibold">Planilla de Notas en Excel</strong>, <strong className="text-white font-semibold">apoyado en Gemini</strong> y el motor <strong className="text-white font-semibold">RAG de Supabase</strong>.
            </p>
          </div>

          {/* Feature Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#D71921]/20 flex items-center justify-center text-[#D71921]">
                <BookOpen className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Documentos Rectores
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Indexación de Plan de Área, SIAP institucional y Cuadernillos oficiales.
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
                Estructura antes-durante-después, componente ACE bilingüe y bitácora.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1.5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Triple Entregable
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Descarga en Word (.docx), PDF institucional y Planilla Excel (.xlsx).
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Standalone Auth Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-7 sm:p-8 shadow-2xl border border-slate-100 text-slate-900 relative">
            {/* Top Red & Navy Brand Stripe */}
            <div className="absolute top-0 left-8 right-8 h-1.5 bg-gradient-to-r from-[#D71921] via-[#162874] to-[#D71921] rounded-b" />

            <div className="space-y-5 pt-1">
              {/* Card Brand Header */}
              <div className="text-center space-y-2">
                <div className="relative w-14 h-14 mx-auto drop-shadow-md">
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
                    {mode === 'signin' && 'Acceso al Sistema'}
                    {mode === 'signup' && 'Crear Cuenta Docente'}
                    {mode === 'forgot' && 'Restablecer Contraseña'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {mode === 'signin' && 'Ingresa con tu correo y contraseña.'}
                    {mode === 'signup' && 'Regístrate con tu correo para validación inmediata.'}
                    {mode === 'forgot' && 'Define una nueva contraseña para ingresar de inmediato.'}
                  </p>
                </div>
              </div>

              {/* Mode Toggle Switch */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'signin'
                      ? 'bg-white text-[#0E1B4D] shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Iniciar Sesión</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setPassword('')
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-white text-[#0E1B4D] shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Crear Cuenta</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setPassword('')
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'forgot'
                      ? 'bg-white text-[#0E1B4D] shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Recuperar</span>
                </button>
              </div>

              {/* Authentication Form */}
              <form
                onSubmit={
                  mode === 'signin'
                    ? handleSignIn
                    : mode === 'signup'
                      ? handleSignUp
                      : handleResetPassword
                }
                className="space-y-3.5"
              >
                {/* Honeypot anti-bot trap */}
                <input
                  type="text"
                  name="website_institution_check"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="opacity-0 absolute -left-[9999px] w-0 h-0 pointer-events-none"
                />

                {mode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Nombre Completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Ej: Lic. Carlos Mendoza"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isLoading}
                        required
                        className="pl-10 h-11 text-xs border-slate-200 focus:border-[#162874] rounded-xl font-medium"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="tu.correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-10 h-11 text-xs border-slate-200 focus:border-[#162874] rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      {mode === 'forgot' ? 'Nueva Contraseña' : 'Contraseña'}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot')
                          setPassword('')
                        }}
                        className="text-[11px] text-[#162874] hover:text-[#D71921] font-semibold transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'forgot' ? 'Nueva contraseña (mínimo 6 caracteres)' : '••••••••••••'}
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
                  className="w-full h-11 bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === 'signin' && 'Ingresar al Sistema'}
                        {mode === 'signup' && 'Crear Cuenta y Comenzar'}
                        {mode === 'forgot' && 'Restablecer y Acceder'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Security & Verification Footer */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#D71921] shrink-0" />
                  <span>Cuentas validadas de forma automática e inmediata</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Acceso habilitado para todo el cuerpo docente CBSJC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <Footer />
    </div>
  )
}

