import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

let apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
if (!apiKey && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  const match = envContent.match(/(?:GOOGLE_AI_API_KEY|GEMINI_API_KEY)\s*=\s*["']?([^"'\r\n]+)/)
  if (match) {
    apiKey = match[1].trim()
  }
}

console.log('API Key present:', Boolean(apiKey), 'Prefix:', apiKey ? apiKey.slice(0, 8) + '...' : 'none')

const genAI = new GoogleGenerativeAI(apiKey || '')

const candidateModels = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
]

async function main() {
  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const res = await model.generateContent('Escribe: OK')
      const text = (await res.response).text()
      console.log(`[MODEL] ${modelName} -> SUCCESS: ${text.trim()}`)
    } catch (err) {
      console.log(`[MODEL] ${modelName} -> FAILED: ${err.message}`)
    }
  }
}

main().catch(console.error)
