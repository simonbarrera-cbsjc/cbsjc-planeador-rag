/**
 * @file lib/ai/verifier.ts
 * @description Deterministic post-generation verification of the Planning Book.
 * No LLM involved: every check is reproducible, so the report can be trusted and shown to the teacher.
 *
 * Pure functions (no 'server-only') so they can be unit-tested with plain tsx.
 */

import { DEFAULT_PESOS, PILARES, type Pilar } from './arc'
import { normalizeForMatch } from './grounding'

export type Severity = 'critico' | 'advertencia' | 'info'

export interface VerificationIssue {
  severity: Severity
  section: string
  message: string
}

export interface VerificationReport {
  generatedAt: string
  score: number
  issues: VerificationIssue[]
  stats: Record<string, string | number>
}

export interface VerifyInput {
  markdown: string
  effectiveWeeks: number
  contextText: string
  tema: string
  area: string
  pesos?: Record<Pilar, number>
  truncatedStages?: string[]
  extraIssues?: VerificationIssue[]
}

const ALLOWED_INSTITUTIONAL_CODES = new Set(['SJB-RGA006', 'SJB-PGA012', 'SJB-RGA027'])
const LEAK_TERMS = ['microscop', 'celula', 'tejido', 'guayac', 'torso', 'organelo']
export const MIN_WEEK_CHARS = 3000
const HARD_MIN_WEEK_CHARS = 1200

/** Body of "## n. ..." up to the next "## k." heading (or end). */
export function sectionBody(md: string, n: number): string {
  const re = new RegExp(`^##\\s*${n}\\.[^\\n]*$`, 'm')
  const m = re.exec(md)
  if (!m) return ''
  const start = m.index + m[0].length
  const rest = md.slice(start)
  const next = /^##\s*\d+\./m.exec(rest)
  return next ? rest.slice(0, next.index) : rest
}

/** Text of the cell content for effective week n inside the Section 2 table. */
export function extractWeekSegment(section2: string, n: number, total: number): string {
  const rowOf = (label: string) => {
    const line = section2.split('\n').find((l) => l.trim().startsWith(`| **${label}**`))
    return line || ''
  }
  if (n === 1) return rowOf('ANTES')
  if (n === total && total > 1) return rowOf('DESPUÉS')
  const durante = rowOf('DURANTE')
  const startRe = new RegExp(`■\\s*SEMANA\\s*${n}\\b`)
  const sm = startRe.exec(durante)
  if (!sm) return ''
  const rest = durante.slice(sm.index + sm[0].length)
  const nx = /■\s*SEMANA\s*\d+/.exec(rest)
  return nx ? rest.slice(0, nx.index) : rest
}

/** Depth/completeness problems of one week cell (empty array = OK). */
export function weekDepthProblems(seg: string): string[] {
  const problems: string[] = []
  const n = normalizeForMatch(seg)
  if (seg.length < MIN_WEEK_CHARS) {
    problems.push(`el desarrollo es demasiado breve (${seg.length} caracteres; se exigen al menos ${MIN_WEEK_CHARS})`)
  }
  if (!/\d{1,3}\s*min/.test(n)) problems.push('faltan los minutos exactos de cada momento')
  if (!n.includes('rutina de pensamiento')) problems.push('falta la rutina de pensamiento visible')
  if (!n.includes('sentence frames')) problems.push('faltan los sentence frames en inglés')
  if (!n.includes('ticket de salida')) problems.push('falta el ticket de salida con preguntas')
  if (!n.includes('consignas docentes')) problems.push('faltan las consignas docentes')
  if (!n.includes('ajustes dua')) problems.push('faltan los ajustes DUA & PIAR')
  return problems
}

function parsePercentages(section3: string): Record<Pilar, number> {
  const sums: Record<Pilar, number> = { SABER: 0, 'SABER HACER': 0, 'SABER SER': 0, 'SABER CONVIVIR': 0 }
  const lines = section3.split('\n').filter((l) => l.trim().startsWith('|') && /%/.test(l))
  for (const line of lines) {
    const cells = line.split('|').map((c) => c.trim())
    // | act | semana | pilares | % | rubrica |  → split gives ['', act, semana, pilares, %, rubrica, '']
    const pctCell = cells[4] || ''
    const re = /(SABER HACER|SABER SER|SABER CONVIVIR|SABER)\s*:\s*([\d.,]+)\s*%/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(pctCell)) !== null) {
      const key = m[1].toUpperCase() as Pilar
      sums[key] += parseFloat(m[2].replace(',', '.'))
    }
  }
  return sums
}

export function verifyPlanningBook(input: VerifyInput): VerificationReport {
  const { markdown, effectiveWeeks, contextText, tema, area } = input
  const issues: VerificationIssue[] = []
  const add = (severity: Severity, section: string, message: string) => issues.push({ severity, section, message })

  const ctxNorm = normalizeForMatch(contextText)
  const refNorm = normalizeForMatch(`${contextText} ${tema} ${area}`)
  const outNorm = normalizeForMatch(markdown)

  // 1. Structure
  if (!/^#\s+Secuencia Did[aá]ctica/m.test(markdown)) add('critico', 'Estructura', 'Falta el encabezado principal de la secuencia didáctica.')
  for (let n = 1; n <= 8; n++) {
    if (!sectionBody(markdown, n).trim()) add('critico', `Sección ${n}`, `La sección ${n} no se generó o está vacía.`)
  }

  // 2. Truncation
  for (const st of input.truncatedStages || []) {
    add('critico', 'Generación', `La etapa "${st}" se cortó por límite de longitud del modelo; el contenido puede estar incompleto.`)
  }
  const brokenRows = markdown.split('\n').filter((l) => l.trim().startsWith('|') && !l.trim().endsWith('|'))
  if (brokenRows.length > 0) add('advertencia', 'Tablas', `${brokenRows.length} fila(s) de tabla parecen incompletas (posible corte de generación).`)

  // 3. Arco pedagógico depth, week by week
  const s2 = sectionBody(markdown, 2)
  let weekChars = 0
  let weeksOk = 0
  for (let n = 1; n <= effectiveWeeks; n++) {
    if (effectiveWeeks < 3 && n > 1 && n < effectiveWeeks) continue
    const seg = extractWeekSegment(s2, n, effectiveWeeks)
    const label = `Arco pedagógico · Semana ${n}`
    if (!seg) {
      add('critico', label, `No se encontró el desarrollo de la Semana ${n} en el arco pedagógico.`)
      continue
    }
    weekChars += seg.length
    if (seg.length < HARD_MIN_WEEK_CHARS) {
      add('critico', label, `Desarrollo demasiado breve (${seg.length} caracteres).`)
    }
    const problems = weekDepthProblems(seg)
    if (problems.length > 0 && seg.length >= HARD_MIN_WEEK_CHARS) {
      add('advertencia', label, `Profundidad insuficiente: ${problems.join('; ')}.`)
    }
    if (problems.length === 0) weeksOk++
  }

  // 4. Evaluation percentages (exact math)
  const s3 = sectionBody(markdown, 3)
  const pesos = input.pesos || DEFAULT_PESOS
  const sums = parsePercentages(s3)
  if (s3.trim()) {
    for (const p of PILARES) {
      if (Math.abs(sums[p] - pesos[p]) > 0.01) {
        add('critico', 'Plan de evaluación', `La suma de micro-porcentajes de ${p} es ${sums[p]}% y debería ser ${pesos[p]}%.`)
      }
    }
  }

  // 5. Official data cross-check against rector documents
  const s1 = sectionBody(markdown, 1)
  const dbaNums = Array.from(new Set(Array.from(s1.matchAll(/DBA\s*(?:N[°ºo.]{0,2}\s*)?(\d{1,2})\b/gi)).map((m) => m[1])))
  const ctxHasDba = /\bdba\b/.test(ctxNorm)
  for (const num of dbaNums) {
    if (!ctxHasDba) {
      add('info', 'Referentes', `No se pudo verificar el DBA ${num}: los documentos cargados no contienen DBA.`)
    } else if (!new RegExp(`\\bdba\\s*(?:n\\s*)?0?${num}\\b`).test(ctxNorm)) {
      add('advertencia', 'Referentes', `El DBA ${num} citado no aparece en los documentos rectores cargados; verifícalo.`)
    }
  }
  const codes = Array.from(new Set(markdown.match(/SJB-[A-Z]{3}\d{3}/g) || []))
  for (const code of codes) {
    if (!ALLOWED_INSTITUTIONAL_CODES.has(code) && !contextText.includes(code)) {
      add('advertencia', 'Códigos institucionales', `El código ${code} no figura en los documentos cargados ni en el catálogo institucional.`)
    }
  }
  const noConsta = (markdown.match(/NO CONSTA EN LOS DOCUMENTOS RECTORES/gi) || []).length
  if (noConsta > 0) {
    add('advertencia', 'Referentes', `${noConsta} dato(s) oficial(es) no constan en los documentos cargados y quedaron marcados para completar manualmente.`)
  }

  // 6. Leftover template placeholders
  const placeholders =
    markdown.match(
      /\(\s*(?:Redactar|Detalle exhaustivo|Descriptor(?: detallado)?:?|Escribir el|Nombre del eje|Declaraci[oó]n|Una o m[aá]s competencias|C[oó]mo se manifiesta)[^)]{0,80}|\(\s*…\s*\)/gi
    ) || []
  if (placeholders.length > 0) add('critico', 'Plantilla', `Quedaron ${placeholders.length} marcador(es) de plantilla sin redactar (p. ej. "${(placeholders[0] || '').slice(0, 60)}…").`)

  // 7. Template-example leakage (content of the institutional example that does not belong to this area/topic)
  const leaks = LEAK_TERMS.filter((t) => outNorm.includes(t) && !refNorm.includes(t))
  if (leaks.length > 0) {
    add('advertencia', 'Coherencia disciplinar', `Aparecen términos que no corresponden al área/tema ni a los documentos (${leaks.join(', ')}); posible contenido heredado del ejemplo.`)
  }

  for (const e of input.extraIssues || []) issues.push(e)

  const crit = issues.filter((i) => i.severity === 'critico').length
  const warn = issues.filter((i) => i.severity === 'advertencia').length
  const score = Math.max(0, Math.min(100, 100 - crit * 20 - warn * 6))

  return {
    generatedAt: new Date().toISOString(),
    score,
    issues,
    stats: {
      caracteresTotales: markdown.length,
      semanasEfectivas: effectiveWeeks,
      semanasConProfundidadCompleta: weeksOk,
      caracteresPromedioPorSemana: effectiveWeeks > 0 ? Math.round(weekChars / effectiveWeeks) : 0,
      sumaSABER: sums.SABER,
      sumaSABERHACER: sums['SABER HACER'],
      sumaSABERSER: sums['SABER SER'],
      sumaSABERCONVIVIR: sums['SABER CONVIVIR'],
    },
  }
}

/**
 * Appends a visible "VERIFICAR" marker to the Section 1 rows whose official content the auditor
 * could not support with a literal quote from the rector documents.
 */
export function flagUnsupportedRows(markdown: string, flagged: Array<{ rowLabel: string; reason: string }>): string {
  if (flagged.length === 0) return markdown
  const lines = markdown.split('\n')
  let inSection1 = false
  const out = lines.map((line) => {
    if (/^##\s*1\./.test(line)) inSection1 = true
    else if (/^##\s*\d+\./.test(line)) inSection1 = false
    if (!inSection1 || !line.trim().startsWith('|')) return line
    const label = normalizeForMatch(line.split('|')[1] || '')
    const hit = flagged.find((f) => label.includes(normalizeForMatch(f.rowLabel)))
    if (!hit) return line
    const marker = `<br><br>**⚠ VERIFICAR CON EL DOCUMENTO RECTOR:** ${hit.reason.replace(/\|/g, '/')}`
    return line.replace(/\s*\|\s*$/, `${marker} |`)
  })
  return out.join('\n')
}
