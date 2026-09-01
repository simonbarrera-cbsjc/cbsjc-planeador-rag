'use client'

import { useToast } from '@/hooks/use-toast'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] gap-2">
      {toasts.map(function ({ id, title, description, variant }) {
        return (
          <div
            key={id}
            className={cn(
              'group pointer-events-auto relative flex w-full items-start justify-between space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
              variant === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
              variant === 'error' && 'border-red-200 bg-red-50 text-red-900',
              variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900',
              (!variant || variant === 'default') && 'border-slate-200 bg-white text-slate-900'
            )}
          >
            <div className="flex items-start gap-3">
              {variant === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />}
              {variant === 'error' && <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />}
              {variant === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />}
              {(!variant || variant === 'default') && <Info className="h-5 w-5 text-[#003087] mt-0.5 shrink-0" />}
              <div className="grid gap-1">
                {title && <div className="text-sm font-semibold">{title}</div>}
                {description && (
                  <div className="text-xs opacity-90 leading-relaxed">{description}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => dismiss(id)}
              className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
