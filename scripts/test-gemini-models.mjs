import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

// read .env.local
const envFile = fs.readFileSync('.env.local', 'utf-8')
let apiKey = ''
for (const line of envFile.split('\n')) {
  if (line.startsWith('GOOGLE_AI_API_KEY=')) {
    apiKey = line.replace('GOOGLE_AI_API_KEY=', '').trim().replace(/^["']|["']$/g, '')
  }
}

// First, query listModels directly from REST endpoint
async function listAllModels() {
  console.log('Fetching available models from Google API...')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  const data = await res.json()
  if (data.models) {
    console.log('Available models for this API key:')
    for (const m of data.models) {
      if (m.supportedGenerationMethods?.includes('generateContent')) {
        console.log(`- ${m.name} (${m.displayName})`)
      }
    }
  } else {
    console.log('ListModels error or response:', data)
  }
}

const genAI = new GoogleGenerativeAI(apiKey)

const candidateModels = [
  'gemini-3.6-flash',
  'gemini-3.1-pro-preview',
  'gemini-2.0-flash-exp',
  'gemini-exp-1206',
]

async function run() {
  await listAllModels()

  for (const m of candidateModels) {
    try {
      console.log(`\nTesting model: ${m}...`)
      const model = genAI.getGenerativeModel({ model: m })
      const res = await model.generateContent('Hola, responde con una sola palabra: OK')
      console.log(`>>> SUCCESS for ${m}:`, res.response.text().trim())
    } catch (err) {
      console.log(`>>> FAILED for ${m}:`, err.message)
    }
  }
}

run()
