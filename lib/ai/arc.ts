/**
 * @file lib/ai/arc.ts
 * @description Deterministic helpers for Section 2 (Arco Pedagógico) and Section 3 (Plan de Evaluación Continua).
 *
 * Design rationale (anti-hallucination + depth):
 *  - Section 2 is generated WEEK BY WEEK (one dedicated model call per effective week) from a shared "skeleton",
 *    then assembled into the official 3-column ANTES / DURANTE / DESPUÉS table by code.
 *  - Section 3 percentages are computed by code (LLMs are unreliable at arithmetic), so each pillar sums EXACTLY
 *    to its period weight.
 *
 * Pure functions (no 'server-only') so they can be unit-tested with plain tsx.
 */

export type Pilar = 'SABER' | 'SABER HACER' | 'SABER SER' | 'SABER CONVIVIR'
export type Momento = 'ANTES' | 'DURANTE' | 'DESPUÉS'

export const PILARES: Pilar[] = ['SABER', 'SABER HACER', 'SABER SER', 'SABER CONVIVIR']

export const DEFAULT_PESOS: Record<Pilar, number> = {
  SABER: 35,
  'SABER HACER': 35,
  'SABER SER': 20,
  'SABER CONVIVIR': 10,
}

export interface WeekPlan {
  n: number
  momento: Momento
  eje_tematico: string
  can_do: string
  producto_semana: string
  actividad_evaluativa: string
  pilares: Pilar[]
  rubrica_sintesis: string
  foco_conceptual: string[]
  rutina_pensamiento: string
}

export interface ArcSkeleton {
  pesos: Record<Pilar, number>
  pesosFuente: 'documentos' | 'defecto'
  semanas: WeekPlan[]
}

/** First integer found in the text ("4 semanas efectivas" → 4). Clamped to 1..12, default 4. */
export function parseEffectiveWeeks(text?: string | null): number {
  const m = String(text || '').match(/\d+/)
  const n = m ? parseInt(m[0], 10) : 4
  if (!Number.isFinite(n) || n < 1) return 4
  return Math.min(n, 12)
}

export function momentoForWeek(n: number, total: number): Momento {
  if (n === 1) return 'ANTES'
  if (n === total) return 'DESPUÉS'
  return 'DURANTE'
}

export function canonPilar(raw: unknown): Pilar | null {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
  if (!s) return null
  if (s.includes('CONVIV')) return 'SABER CONVIVIR'
  if (s.includes('HACER')) return 'SABER HACER'
  if (s.includes('SER')) return 'SABER SER'
  if (s.includes('SABER')) return 'SABER'
  return null
}

const clean = (v: unknown, fallback = ''): string =>
  String(v ?? fallback)
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .trim()

function parsePesos(raw: unknown): { pesos: Record<Pilar, number>; fuente: 'documentos' | 'defecto' } {
  if (raw && typeof raw === 'object') {
    const out: Partial<Record<Pilar, number>> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const p = canonPilar(k)
      const num = typeof v === 'number' ? v : parseFloat(String(v).replace('%', '').replace(',', '.'))
      if (p && Number.isFinite(num) && num > 0 && num <= 100) out[p] = num
    }
    const sum = PILARES.reduce((a, p) => a + (out[p] || 0), 0)
    if (PILARES.every((p) => out[p] !== undefined) && Math.abs(sum - 100) < 0.01) {
      return { pesos: out as Record<Pilar, number>, fuente: 'documentos' }
    }
  }
  return { pesos: { ...DEFAULT_PESOS }, fuente: 'defecto' }
}

/** Validates the (possibly malformed) LLM skeleton and repairs it so downstream code can trust it. */
export function normalizeSkeleton(raw: unknown, total: number, tema: string): ArcSkeleton {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const { pesos, fuente } = parsePesos(obj.pesos_pilares)
  const rawWeeks = Array.isArray(obj.semanas) ? (obj.semanas as Array<Record<string, unknown>>) : []

  const semanas: WeekPlan[] = []
  for (let n = 1; n <= total; n++) {
    const src = rawWeeks.find((w) => Number(w?.n) === n) || rawWeeks[n - 1] || {}
    const momento = momentoForWeek(n, total)
    let pilares = (Array.isArray(src.pilares) ? src.pilares : [])
      .map(canonPilar)
      .filter((p): p is Pilar => !!p)
    pilares = Array.from(new Set(pilares))
    if (pilares.length === 0) {
      pilares = momento === 'ANTES' ? ['SABER', 'SABER SER'] : ['SABER', 'SABER HACER', 'SABER SER']
    }
    const foco = Array.isArray(src.foco_conceptual)
      ? (src.foco_conceptual as unknown[]).map((x) => clean(x)).filter(Boolean).slice(0, 6)
      : []
    semanas.push({
      n,
      momento,
      eje_tematico: clean(src.eje_tematico, `${tema} — Semana ${n}`) || `${tema} — Semana ${n}`,
      can_do: clean(src.can_do),
      producto_semana: clean(src.producto_semana),
      actividad_evaluativa:
        clean(src.actividad_evaluativa) || `Actividad evaluativa de la Semana ${n}`,
      pilares,
      rubrica_sintesis:
        clean(src.rubrica_sintesis) ||
        'Rúbrica formativa coherente con la rúbrica global (Menú de Desafíos): criterios de precisión conceptual, procedimiento, actitud y trabajo en equipo.',
      foco_conceptual: foco,
      rutina_pensamiento: clean(src.rutina_pensamiento, 'See-Think-Wonder') || 'See-Think-Wonder',
    })
  }

  // Every pillar must be valued at least once so its period weight can be fully distributed.
  for (const p of PILARES) {
    if (!semanas.some((w) => w.pilares.includes(p))) {
      const target = p === 'SABER' ? semanas[0] : semanas[semanas.length - 1]
      target.pilares.push(p)
    }
  }
  for (const w of semanas) w.pilares.sort((a, b) => PILARES.indexOf(a) - PILARES.indexOf(b))

  return { pesos, pesosFuente: fuente, semanas }
}

/**
 * Splits each pillar's period weight across the weeks that value it, in 0.5% steps, so the sum is EXACT.
 * Remainder units go to the latest weeks (when students have accumulated more evidence).
 */
export function distributePercentages(sk: ArcSkeleton): Record<number, Partial<Record<Pilar, number>>> {
  const result: Record<number, Partial<Record<Pilar, number>>> = {}
  for (const w of sk.semanas) result[w.n] = {}

  for (const p of PILARES) {
    const weeks = sk.semanas.filter((w) => w.pilares.includes(p)).map((w) => w.n)
    const k = weeks.length
    if (k === 0) continue
    const units = Math.round(sk.pesos[p] * 2)
    const base = Math.floor(units / k)
    const rem = units - base * k
    weeks.forEach((n, idx) => {
      const extra = idx >= k - rem ? 1 : 0
      result[n][p] = (base + extra) / 2
    })
  }
  return result
}

const fmtPct = (v: number): string => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`)

/** Section 3 — table rows + math verification note, fully computed by code. */
export function buildEvaluationPlanMarkdown(sk: ArcSkeleton, semanasEfectivasText: string): string {
  const dist = distributePercentages(sk)
  const rows = sk.semanas.map((w, i) => {
    const pcts = PILARES.filter((p) => dist[w.n][p] !== undefined)
      .map((p) => `${p}: ${fmtPct(dist[w.n][p] as number)}`)
      .join('<br>')
    return `| **Actividad ${i + 1}: ${w.actividad_evaluativa}** | Semana ${w.n} - ${w.momento} | ${w.pilares.join(' · ')} | ${pcts} | ${w.rubrica_sintesis} |`
  })

  const sums = PILARES.map((p) => {
    const parts = sk.semanas.filter((w) => dist[w.n][p] !== undefined).map((w) => fmtPct(dist[w.n][p] as number))
    const total = sk.semanas.reduce((a, w) => a + (dist[w.n][p] || 0), 0)
    return `${p} = ${parts.join(' + ')} = ${fmtPct(total)}`
  }).join('; ')

  const sourceNote =
    sk.pesosFuente === 'documentos'
      ? 'Los pesos por pilar del período fueron tomados de los documentos rectores (SIAP / Plan de Área).'
      : 'NO se encontraron pesos por pilar en los documentos cargados; se asumieron los pesos institucionales por defecto (35 / 35 / 20 / 10). VERIFICAR contra el SIAP del área.'

  return [
    '## 3. PLAN DE EVALUACIÓN CONTINUA DE LA SECUENCIA',
    '',
    '| Actividad evaluativa | Semana · momento | Pilar(es) que valora | % dentro del pilar | Rúbrica específica (síntesis coherente con la global) |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `*(Verificación matemática institucional sobre ${semanasEfectivasText}: ${sums}. ${sourceNote})*`,
    '',
  ].join('\n')
}

const WEEK_LABELS = [
  'EJE TEMATICO',
  'CAN-DO STATEMENT',
  'RUTINA DE PENSAMIENTO VISIBLE',
  'MOMENTO 1',
  'MOMENTO 2',
  'MOMENTO 3',
  'SENTENCE FRAMES',
  'TICKET DE SALIDA',
  'EVIDENCIA / PRODUCTO DE LA SEMANA',
  'EVIDENCIA',
  'CONSIGNAS DOCENTES',
  'AJUSTES DUA',
]

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Converts the model's labelled plain text for one week into a table-safe cell:
 * labels in bold, newlines → <br>, pipes and stray markdown removed.
 */
export function formatWeekCell(raw: string): string {
  const lines = String(raw || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\r/g, '')
    .replace(/\|/g, '/')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const blocks: string[][] = []
  for (const line of lines) {
    const idx = line.indexOf(':')
    let isLabel = false
    if (idx > 0 && idx < 120) {
      const head = stripAccents(line.slice(0, idx)).toUpperCase().replace(/^[-•\s]+/, '')
      isLabel = WEEK_LABELS.some((l) => head.startsWith(l))
    }
    if (isLabel) {
      const head = line.slice(0, idx).replace(/^[-•\s]+/, '').trim()
      const rest = line.slice(idx + 1).trim()
      blocks.push([`**${head}:** ${rest}`.trim()])
    } else if (blocks.length === 0) {
      blocks.push([line])
    } else {
      blocks[blocks.length - 1].push(line)
    }
  }
  return blocks.map((b) => b.join('<br>')).join('<br><br>')
}

const joinWeeks = (ns: number[]): string => {
  if (ns.length === 1) return `SEMANA ${ns[0]}`
  return `SEMANAS ${ns.slice(0, -1).join(', ')} y ${ns[ns.length - 1]}`
}

/** Section 2 — official 3-column ANTES / DURANTE / DESPUÉS table assembled from the per-week cells. */
export function buildArcTableMarkdown(sk: ArcSkeleton, weekCells: Record<number, string>): string {
  const total = sk.semanas.length
  const cellOf = (n: number) => weekCells[n] || ''
  const header = (ns: number[]) => `**Semanas de este momento: ${joinWeeks(ns)}.**`

  const antes = `${header([1])}<br><br>${cellOf(1)}`

  let durante: string
  let despues: string
  if (total >= 3) {
    const mid = sk.semanas.filter((w) => w.momento === 'DURANTE').map((w) => w.n)
    durante =
      `${header(mid)}<br><br>` +
      mid.map((n) => `**■ SEMANA ${n}**<br>${cellOf(n)}`).join('<br><br>')
    despues = `${header([total])}<br><br>${cellOf(total)}`
  } else if (total === 2) {
    durante =
      '**Momento integrado entre las Semanas 1 y 2.**<br><br>Con solo dos semanas efectivas, el momento DURANTE se desarrolla en el Core Task de la Semana 1 y en el Warm-up y Core Task de la Semana 2 (ver el detalle sesión por sesión en las filas ANTES y DESPUÉS).'
    despues = `${header([2])}<br><br>${cellOf(2)}`
  } else {
    durante =
      '**Momento integrado en la SEMANA 1.**<br><br>Con una sola semana efectiva, el momento DURANTE corresponde al Momento 2 · Core Task de la Semana 1 (ver el detalle en la fila ANTES).'
    despues =
      '**Momento integrado en la SEMANA 1.**<br><br>Con una sola semana efectiva, el momento DESPUÉS corresponde al Momento 3 · Wrap-up y al Ticket de Salida de la Semana 1 (ver el detalle en la fila ANTES).'
  }

  return [
    '## 2. ARCO PEDAGÓGICO DE LA SECUENCIA',
    '',
    '*Toda secuencia recorre el arco institucional: ANTES (conecta y reta), DURANTE (explora, construye y aplica) y DESPUÉS (evidencia, mejora, reflexiona y transfiere). Se planea por semanas (Semana 1, Semana 2…), indicando a qué momento del arco corresponde cada una, y se describe lo que hace el estudiante. Se evalúa en los tres momentos mediante las actividades del plan de evaluación continua (bloque 3); la exploración inicial sigue siendo sin costo en la nota.*',
    '',
    '| Momento / Fase | Enfoque Pedagógico | Semanas, Eje Temático, Can-Do Statement, Qué debe ocurrir (Momentos 1, 2 y 3), Consignas Docentes y Ajustes DUA/PIAR |',
    '|---|---|---|',
    `| **ANTES** | *Conecta y reta* | ${antes} |`,
    `| **DURANTE** | *Explora, construye y aplica* | ${durante} |`,
    `| **DESPUÉS** | *Evidencia, mejora, reflexiona y transfiere* | ${despues} |`,
    '',
    '*Subciclos 1 y 2: la secuencia de Preescolar se planea en el Planning Book Preschool (SJB-RGA027), con los cuatro momentos del nivel. Este formato no aplica en esa sede.*',
    '',
  ].join('\n')
}
