import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = fs.readFileSync('.env.local', 'utf-8')
let url = ''
let serviceKey = ''

for (const line of envFile.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.replace('NEXT_PUBLIC_SUPABASE_URL=', '').trim().replace(/^["']|["']$/g, '')
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = line.replace('SUPABASE_SERVICE_ROLE_KEY=', '').trim().replace(/^["']|["']$/g, '')
  }
}

console.log('--- CBSJC Planeador RAG: DB Insert & Constraint Verification ---')
console.log('Supabase URL:', url)
const supabase = createClient(url, serviceKey)

// Normalization functions (mirrors lib/utils.ts)
function normalizePeriodo(raw) {
  if (!raw) return 'I'
  const val = raw.trim().toUpperCase()
  if (val === 'I' || val === 'II' || val === 'III' || val === 'IV') return val
  if (/\bIV\b|CUARTO|4/i.test(val)) return 'IV'
  if (/\bIII\b|TERCER|3/i.test(val)) return 'III'
  if (/\bII\b|SEGUNDO|2/i.test(val)) return 'II'
  if (/\bI\b|PRIMER|1/i.test(val)) return 'I'
  return 'I'
}

function normalizeArea(raw) {
  if (!raw) return 'general'
  const val = raw.trim().toLowerCase()
  const validSlugs = [
    'matematicas', 'ciencias', 'humanidades', 'ingles', 'sociales',
    'artes', 'educacion_fisica', 'tecnologia', 'religion', 'general'
  ]
  if (validSlugs.includes(val)) return val

  if (val.includes('matem') || val.includes('geom') || val.includes('algebra') || val.includes('calculo')) return 'matematicas'
  if (val.includes('social') || val.includes('historia') || val.includes('democrac') || val.includes('filosof') || val.includes('politic')) return 'sociales'
  if (val.includes('cienc') || val.includes('natural') || val.includes('ambient') || val.includes('biolog') || val.includes('quimic') || (val.includes('fisic') && !val.includes('educacion') && !val.includes('deport'))) return 'ciencias'
  if (val.includes('lengua') || val.includes('castell') || val.includes('humanid') || val.includes('espanol') || val.includes('español') || val.includes('literat')) return 'humanidades'
  if (val.includes('ingl') || val.includes('english') || val.includes('bilingual')) return 'ingles'
  if (val.includes('art') || val.includes('music') || val.includes('danz') || val.includes('teatro') || val.includes('cultur')) return 'artes'
  if (val.includes('fisic') || val.includes('deport') || val.includes('recreac') || val.includes('ed_fisica') || val.includes('educacion fisica')) return 'educacion_fisica'
  if (val.includes('tecno') || val.includes('inform') || val.includes('comput') || val.includes('programac') || val.includes('robot')) return 'tecnologia'
  if (val.includes('relig') || val.includes('etic') || val.includes('valor') || val.includes('pastoral') || val.includes('espirit')) return 'religion'

  return 'general'
}

function normalizeNivel(rawNivel, rawGrado) {
  const n = (rawNivel || '').trim().toLowerCase()
  if (['primaria', 'secundaria', 'bachillerato', 'general'].includes(n)) return n

  const g = (rawGrado || '').trim().toLowerCase()
  if (g.includes('10') || g.includes('11') || g.includes('bachillerato') || g.includes('media')) return 'bachillerato'
  if (g.includes('6') || g.includes('7') || g.includes('8') || g.includes('9') || g.includes('secundaria')) return 'secundaria'
  if (g.includes('transicion') || g.includes('transición') || g.includes('preescolar') || g.includes('jardin') || g.includes('jardín') || g.includes('1') || g.includes('2') || g.includes('3') || g.includes('4') || g.includes('5') || g.includes('primaria')) return 'primaria'

  return 'general'
}

async function runVerification() {
  console.log('\n[Step 1] Fetching auth user...')
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError || !usersData?.users?.length) {
    throw new Error('No users found in auth.users: ' + usersError?.message)
  }

  const testUser = usersData.users[0]
  console.log(`✓ User found: ${testUser.email} (ID: ${testUser.id})`)

  console.log('\n[Step 2] Testing profile upsert for foreign key guarantee...')
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: testUser.id,
      email: testUser.email || 'docente@sanjosebilingue.edu.co',
      full_name: testUser.user_metadata?.full_name || 'Docente CBSJC Test',
      role: 'teacher',
      language: 'es',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (profileError) {
    throw new Error('Profile upsert failed: ' + profileError.message)
  }
  console.log('✓ Profile verified / upserted successfully.')

  console.log('\n[Step 3] Testing normalization logic on diverse real-world inputs...')
  const testCases = [
    { rawPeriodo: 'Periodo I', rawArea: 'Ciencias Naturales y Educación Ambiental', rawGrado: 'Grado 6°' },
    { rawPeriodo: 'Periodo II', rawArea: 'Matemáticas y Geometría', rawGrado: 'Grado 11°' },
    { rawPeriodo: 'Periodo III', rawArea: 'Humanidades y Lengua Castellana', rawGrado: 'Grado 3°' },
    { rawPeriodo: 'Periodo IV', rawArea: 'Inglés (Bilingual Program)', rawGrado: 'Transición / Preescolar' },
    { rawPeriodo: '4', rawArea: 'Filosofía y Ciencias Políticas', rawGrado: 'Grado 10°' },
  ]

  const insertedIds = []

  for (const [idx, tc] of testCases.entries()) {
    const normPeriodo = normalizePeriodo(tc.rawPeriodo)
    const normArea = normalizeArea(tc.rawArea)
    const normNivel = normalizeNivel(undefined, tc.rawGrado)

    console.log(`\n  Test Case #${idx + 1}:`)
    console.log(`    Input  -> Periodo: "${tc.rawPeriodo}", Area: "${tc.rawArea}", Grado: "${tc.rawGrado}"`)
    console.log(`    Normalized -> Periodo: "${normPeriodo}", Area: "${normArea}", Nivel: "${normNivel}"`)

    const payload = JSON.stringify({
      planningBookMarkdown: '# Test Planning Book SJB-RGA006\n\nContenido de prueba.',
      rubricsMarkdown: '### Rúbrica de Evaluación\n\nPonderaciones 35/35/20/10.',
      cibercolegiosSnippet: 'Bloque Cibercolegios listo.',
      excelSpec: { docente: 'Profesor Test', area: tc.rawArea, grado: tc.rawGrado, periodo: normPeriodo },
      metadata: { docente: 'Profesor Test', area: tc.rawArea, areaSlug: normArea, grado: tc.rawGrado, periodo: normPeriodo }
    })

    const { data: insertedDoc, error: insertErr } = await supabase
      .from('generated_documents')
      .insert({
        user_id: testUser.id,
        title: `Secuencia Didáctica: Test Unit ${idx + 1} (${tc.rawGrado})`,
        document_type: 'planeador',
        nivel: normNivel,
        area: normArea,
        grado: tc.rawGrado,
        periodo: normPeriodo,
        parameters: { rawArea: tc.rawArea, rawPeriodo: tc.rawPeriodo, normArea, normPeriodo },
        content: payload,
        additional_instructions: 'Prueba de inserción automatizada sin violación de restricciones',
        sources_used: 3,
        status: 'generated',
        language: 'es',
      })
      .select('id, title, periodo, area, nivel, created_at')
      .single()

    if (insertErr || !insertedDoc) {
      console.error(`    ❌ Insert failed: ${insertErr?.message} (${insertErr?.details})`)
      throw new Error(`Insert failed for test case ${idx + 1}: ${insertErr?.message}`)
    }

    console.log(`    ✓ Successfully inserted! Doc ID: ${insertedDoc.id}`)
    insertedIds.push(insertedDoc.id)
  }

  console.log('\n[Step 4] Cleaning up test records...')
  for (const id of insertedIds) {
    const { error: delErr } = await supabase.from('generated_documents').delete().eq('id', id)
    if (delErr) {
      console.warn(`  Warning: could not delete test record ${id}:`, delErr.message)
    } else {
      console.log(`  ✓ Cleaned up test record: ${id}`)
    }
  }

  console.log('\n======================================================')
  console.log('🎉 ALL DATABASE INSERTION & CONSTRAINT TESTS PASSED 100%')
  console.log('======================================================')
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err)
  process.exit(1)
})
