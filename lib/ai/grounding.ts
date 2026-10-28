/**
 * @file lib/ai/grounding.ts
 * @description Anti-hallucination primitives for the CBSJC planning engine:
 *  - GROUNDING_RULES: shared prompt block that forces the model to stay within the rector documents.
 *  - buildGroundedContext: relevance-based selection of the source documents (instead of blind truncation).
 *  - normalizeForMatch / isQuoteSupported: deterministic quote-grounding used to verify LLM claims.
 *
 * Pure functions (no 'server-only') so they can be unit-tested with plain tsx.
 */

export const GROUNDING_RULES = `REGLAS ANTI-ALUCINACIÓN (OBLIGATORIAS — PRIORIDAD MÁXIMA):
1. FUENTE ÚNICA PARA DATOS OFICIALES: competencias, EBC, DBA (código y enunciado), evidencias de aprendizaje, componente ICFES, pregunta de sentido, pesos de los pilares y nombres de proyectos institucionales SOLO pueden tomarse de <contexto_curricular>. Cítalos textualmente o parafraséalos fielmente.
2. PROHIBIDO INVENTAR: nunca fabriques códigos (DBA, SJB-XXX), numeraciones, porcentajes, citas, normas, URLs, nombres de personas ni fechas. Si un dato oficial NO aparece en <contexto_curricular>, escribe exactamente: "NO CONSTA EN LOS DOCUMENTOS RECTORES CARGADOS — VERIFICAR" y no completes con conocimiento propio.
3. CONTENIDO PEDAGÓGICO vs. DATO OFICIAL: las actividades, preguntas y recursos que DISEÑAS pueden ser creativos, pero deben corresponder al área, grado y tema indicados y ser coherentes con los referentes del contexto. No uses contenidos de otras áreas.
4. NEUTRALIDAD DISCIPLINAR: cualquier ejemplo del formato que mencione células, tejidos, microscopios, ecosistemas, circuitos u otro contenido específico es SOLO ILUSTRATIVO del ejemplo institucional. Debes reemplazarlo por situaciones propias del área y tema de esta secuencia.
5. HECHOS CIENTÍFICOS/CONCEPTUALES: usa únicamente afirmaciones que sean conocimiento establecido y apropiado para el grado. Si dudas de un dato, formula la actividad de modo que no dependa de él.
6. NO DEJES MARCADORES: no entregues textos entre paréntesis del tipo "(Redactar...)", "(Detalle...)", "(Descriptor detallado...)". Todo debe quedar redactado.`

/** Lowercase, strip accents and punctuation so that quotes can be compared robustly. */
export function normalizeForMatch(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when the quote is (almost) literally present in the normalized context.
 * Exact containment first; otherwise >= 80% of its 5-word shingles must exist in the context.
 */
export function isQuoteSupported(quote: string, normalizedContext: string): boolean {
  const q = normalizeForMatch(quote)
  if (q.length < 25) return false
  if (normalizedContext.includes(q)) return true

  const words = q.split(' ')
  if (words.length < 6) return false
  let total = 0
  let hit = 0
  for (let i = 0; i + 5 <= words.length; i++) {
    total++
    if (normalizedContext.includes(words.slice(i, i + 5).join(' '))) hit++
  }
  return total > 0 && hit / total >= 0.8
}

export interface GroundingDoc {
  tipo: string
  filename: string
  content: string
}

const BOOST_TERMS = [
  'dba',
  'derecho basico',
  'estandar',
  'competencia',
  'evidencia',
  'periodo',
  'pregunta',
  'saber',
  'ser',
  'hacer',
  'convivir',
  'icfes',
  'ponderacion',
  'porcentaje',
  'subciclo',
  'desempeno',
]

function chunkText(text: string, target = 1400): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  const push = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }
  for (const p of paragraphs) {
    if (p.length > target * 1.6) {
      push()
      // Break very long paragraphs on sentence boundaries
      const sentences = p.split(/(?<=[.!?;:])\s+/)
      let buf = ''
      for (const s of sentences) {
        if ((buf + ' ' + s).length > target && buf) {
          chunks.push(buf.trim())
          buf = s
        } else {
          buf = buf ? buf + ' ' + s : s
        }
      }
      if (buf.trim()) chunks.push(buf.trim())
      continue
    }
    if ((current + '\n\n' + p).length > target && current) push()
    current = current ? current + '\n\n' + p : p
  }
  push()
  return chunks
}

function scoreChunk(chunk: string, queryTerms: string[]): number {
  const norm = normalizeForMatch(chunk)
  let score = 0
  for (const t of queryTerms) {
    if (t && norm.includes(t)) score += t.length >= 6 ? 3 : 2
  }
  for (const b of BOOST_TERMS) {
    if (norm.includes(b)) score += 1
  }
  return score
}

/** Extract normalized search terms (topic, area, grade, period) used to rank document chunks. */
export function buildQueryTerms(parts: Array<string | undefined | null>): string[] {
  const stop = new Set(['como', 'para', 'este', 'esta', 'entre', 'sobre', 'desde', 'hasta', 'cual', 'cuales', 'donde', 'puede', 'grado', 'grupo'])
  const terms = new Set<string>()
  for (const part of parts) {
    for (const w of normalizeForMatch(String(part || '')).split(' ')) {
      if ((w.length >= 4 && !stop.has(w)) || /^\d$/.test(w)) terms.add(w)
    }
  }
  return Array.from(terms)
}

/**
 * Builds the <contexto_curricular> body. If a document fits in its share of the budget it is included
 * whole; otherwise the most relevant chunks (by topic/grade/period + curricular keywords) are kept,
 * preserving the original order. This replaces blind head-truncation, which dropped most of each document.
 */
export function buildGroundedContext(docs: GroundingDoc[], budgetChars: number, queryTerms: string[]): string {
  if (docs.length === 0) return ''

  const weights = docs.map((d) => (d.tipo === 'adicional' ? 0.5 : 1))
  const allocation = new Array<number>(docs.length).fill(0)
  const remainingIdx = new Set(docs.map((_, i) => i))
  let remainingBudget = budgetChars

  // Water-filling: short documents keep all their text, surplus flows to the long ones.
  let changed = true
  while (changed && remainingIdx.size > 0) {
    changed = false
    const wSum = Array.from(remainingIdx).reduce((a, i) => a + weights[i], 0)
    for (const i of Array.from(remainingIdx)) {
      const share = (remainingBudget * weights[i]) / wSum
      if (docs[i].content.length <= share) {
        allocation[i] = docs[i].content.length
        remainingBudget -= docs[i].content.length
        remainingIdx.delete(i)
        changed = true
        break
      }
    }
  }
  if (remainingIdx.size > 0) {
    const wSum = Array.from(remainingIdx).reduce((a, i) => a + weights[i], 0)
    for (const i of remainingIdx) allocation[i] = Math.floor((remainingBudget * weights[i]) / wSum)
  }

  return docs
    .map((doc, i) => {
      const header = `=== [DOCUMENTO RECTOR / FUENTE ${i + 1}: ${doc.tipo.toUpperCase()} (${doc.filename})] ===`
      if (doc.content.length <= allocation[i]) return `${header}\n${doc.content}\n`

      const chunks = chunkText(doc.content)
      const ranked = chunks
        .map((c, idx) => ({ c, idx, s: scoreChunk(c, queryTerms) }))
        .sort((a, b) => b.s - a.s || a.idx - b.idx)

      const chosen: Array<{ c: string; idx: number }> = []
      let used = 0
      for (const r of ranked) {
        if (used + r.c.length > allocation[i]) continue
        chosen.push({ c: r.c, idx: r.idx })
        used += r.c.length
      }
      chosen.sort((a, b) => a.idx - b.idx)

      let body = ''
      let prev = -2
      for (const ch of chosen) {
        body += (ch.idx !== prev + 1 && body ? '\n[…fragmento omitido…]\n' : body ? '\n\n' : '') + ch.c
        prev = ch.idx
      }
      return `${header}\n${body}\n`
    })
    .join('\n')
}
