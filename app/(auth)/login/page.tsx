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
  User,
  GraduationCap,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [isLoading, setIsLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('simon.barrera@sanjosebilingue.edu.co')
  const [password, setPassword] = useState('cbsjcPassword2026!')
  const [showPassword, setShowPassword] = useState(false)
  const [honeypot, setHoneypot] = useState('') // Anti-bot honeypot trap

  // Handle Login
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      console.warn('Bot submission blocked.')
      return
    }

    if (!email || !email.includes('@')) {
      toast({ title: 'Correo requerido', description: 'Por favor ingresa un correo electrónico válido.', variant: 'warning' })
      return
    }

    if (!password) {
      toast({ title: 'Contraseña requerida', description: 'Por favor ingresa tu contraseña.', variant: 'warning' })
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

  // Handle Sign Up (Any email)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (honeypot) {
      console.warn('Bot submission blocked.')
      return
    }

    if (!fullName.trim()) {
      toast({ title: 'Nombre requerido', description: 'Por favor ingresa tu nombre completo.', variant: 'warning' })
      return
    }

    if (!email || !email.includes('@')) {
      toast({ title: 'Correo requerido', description: 'Por favor ingresa un correo válido.', variant: 'warning' })
      return
    }

    if (!password || password.length < 6) {
      toast({ title: 'Contraseña débil', description: 'La contraseña debe tener al menos 6 caracteres.', variant: 'warning' })
      return
    }

    try {
      setIsLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })

      if (error) throw error

      if (data?.session) {
        toast({
          title: '¡Cuenta creada exitosamente!',
          description: 'Accediendo al panel de control...',
          variant: 'success',
        })
        router.push('/dashboard')
        router.refresh()
      } else {
        toast({
          title: 'Cuenta registrada',
          description: 'Tu cuenta ha sido creada. Ya puedes iniciar sesión.',
          variant: 'success',
        })
        setMode('signin')
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

  return (
    <div className="min-h-screen bg-[#0E1B4D] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-[#D71921] selection:text-white">
      {/* Background Glows with CBSJC Navy & Crimson Red */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#D71921]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] bg-[#162874]/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#D71921]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/10">
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

      {/* Main Center Grid */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
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
              Genera planeadores de clase, planes de área e informes pedagógicos con la precisión de <strong className="text-white font-semibold">Gemini 2.0 Flash</strong> y el motor <strong className="text-white font-semibold">RAG de Supabase</strong>, cumpliendo los DBA y lineamientos del CBSJC.
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

        {/* Right Column: Standalone Auth Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-7 sm:p-8 shadow-2xl border border-slate-100 text-slate-900 relative">
            {/* Top Red & Navy Brand Stripe */}
            <div className="absolute top-0 left-8 right-8 h-1.5 bg-gradient-to-r from-[#D71921] via-[#162874] to-[#D71921] rounded-b" />

            <div className="space-y-5 pt-1">
              {/* Card Brand Header */}
              <div className="text-center space-y-2">
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
                    {mode === 'signin' ? 'Acceso al Sistema' : 'Crear Cuenta Docente'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {mode === 'signin'
                      ? 'Ingresa con cualquier correo electrónico y tu contraseña.'
                      : 'Regístrate con tu correo para comenzar a planear.'}
                  </p>
                </div>
              </div>

              {/* Mode Toggle Switch */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
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
                    setEmail('')
                    setPassword('')
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-white text-[#0E1B4D] shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Crear Cuenta</span>
                </button>
              </div>

              {/* Authentication Form */}
              <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3.5">
                {/* Honeypot anti-bot trap */}
                <input
                  type="text"
                  name="website_institution_check"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
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
                      <span>{mode === 'signin' ? 'Ingresar al Sistema' : 'Registrarse y Comenzar'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Security & Verification Footer */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#D71921] shrink-0" />
                  <span>Base de datos segura protegida por Row Level Security (RLS)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Cualquier correo admitido para acceso curricular</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Colegio Bilingüe San José Campestre. Todos los derechos reservados.</p>
        <p className="text-slate-400">
          Sistema de Inteligencia Artificial Curricular RAG
        </p>
      </footer>
    </div>
  )
}
