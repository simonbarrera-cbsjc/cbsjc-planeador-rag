import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DocumentType, DocumentArea, DocumentCategory, Periodo } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, locale: 'es' | 'en' = 'es'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date, locale: 'es' | 'en' = 'es'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDocumentType(type: string, locale: 'es' | 'en' = 'es'): string {
  const map: Record<string, { es: string; en: string }> = {
    planeador: { es: 'Planeador de Clase', en: 'Lesson Plan' },
    plan_area: { es: 'Plan de Área', en: 'Curriculum Area Plan' },
    informe: { es: 'Informe Académico', en: 'Academic Report' },
    circular: { es: 'Circular Institucional', en: 'Institutional Circular' },
    proyecto_pedagogico: { es: 'Proyecto Pedagógico', en: 'Pedagogical Project' },
  }
  return map[type]?.[locale] || type
}

export function formatArea(area: string, locale: 'es' | 'en' = 'es'): string {
  const map: Record<string, { es: string; en: string }> = {
    matematicas: { es: 'Matemáticas', en: 'Mathematics' },
    ciencias: { es: 'Ciencias Naturales', en: 'Natural Sciences' },
    humanidades: { es: 'Humanidades y Lengua Castellana', en: 'Humanities & Spanish' },
    ingles: { es: 'Inglés (Bilingual)', en: 'English' },
    sociales: { es: 'Ciencias Sociales', en: 'Social Sciences' },
    artes: { es: 'Educación Artística', en: 'Arts' },
    educacion_fisica: { es: 'Educación Física', en: 'Physical Education' },
    tecnologia: { es: 'Tecnología e Informática', en: 'Technology & IT' },
    religion: { es: 'Educación Religiosa y Ética', en: 'Ethics & Religion' },
    general: { es: 'General Institucional', en: 'General Institutional' },
  }
  return map[area]?.[locale] || area
}

export function formatNivel(nivel: string, locale: 'es' | 'en' = 'es'): string {
  const map: Record<string, { es: string; en: string }> = {
    primaria: { es: 'Primaria', en: 'Elementary' },
    secundaria: { es: 'Secundaria', en: 'Middle School' },
    bachillerato: { es: 'Media / Bachillerato', en: 'High School' },
    general: { es: 'Toda la Institución', en: 'Whole School' },
  }
  return map[nivel]?.[locale] || nivel
}

export function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
      return 'success'
    case 'processing':
      return 'warning'
    case 'error':
      return 'destructive'
    case 'pending':
    default:
      return 'secondary'
  }
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/`{1,3}.*?`{1,3}/g, '') // Remove code blocks
    .replace(/^\s*[-*+]\s+/gm, '• ') // Convert list items to bullet
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\n{2,}/g, '\n\n') // Normalize multiple line breaks
    .trim()
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p></p>'
  
  let html = markdown
    // Headings
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold and Italic
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Horizontal Rule
    .replace(/^---$/gim, '<hr/>')

  // Process lists and paragraphs
  const lines = html.split('\n')
  const processedLines: string[] = []
  let inUl = false
  let inOl = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      if (inUl) { processedLines.push('</ul>'); inUl = false; }
      if (inOl) { processedLines.push('</ol>'); inOl = false; }
      continue
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inUl) {
        if (inOl) { processedLines.push('</ol>'); inOl = false; }
        processedLines.push('<ul>')
        inUl = true
      }
      processedLines.push(`<li>${line.substring(2)}</li>`)
    } else if (/^\d+\.\s/.test(line)) {
      if (!inOl) {
        if (inUl) { processedLines.push('</ul>'); inUl = false; }
        processedLines.push('<ol>')
        inOl = true
      }
      const itemText = line.replace(/^\d+\.\s/, '')
      processedLines.push(`<li>${itemText}</li>`)
    } else {
      if (inUl) { processedLines.push('</ul>'); inUl = false; }
      if (inOl) { processedLines.push('</ol>'); inOl = false; }
      
      if (line.startsWith('<h') || line.startsWith('<blockquote') || line.startsWith('<hr')) {
        processedLines.push(line)
      } else {
        processedLines.push(`<p>${line}</p>`)
      }
    }
  }

  if (inUl) processedLines.push('</ul>')
  if (inOl) processedLines.push('</ol>')

  return processedLines.join('')
}
