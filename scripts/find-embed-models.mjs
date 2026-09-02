import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
let apiKey = ''
for (const line of envFile.split('\n')) {
  if (line.startsWith('GOOGLE_AI_API_KEY=')) {
    apiKey = line.replace('GOOGLE_AI_API_KEY=', '').trim().replace(/^["']|["']$/g, '')
  }
}

async function findEmbedModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  const data = await res.json()
  console.log('Embedding models:')
  for (const m of data.models || []) {
    if (m.supportedGenerationMethods?.includes('embedContent')) {
      console.log(`- ${m.name} (${m.displayName})`)
    }
  }
}

findEmbedModels()
