import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

const envFile = fs.readFileSync('.env.local', 'utf-8')
let apiKey = ''
for (const line of envFile.split('\n')) {
  if (line.startsWith('GOOGLE_AI_API_KEY=')) {
    apiKey = line.replace('GOOGLE_AI_API_KEY=', '').trim().replace(/^["']|["']$/g, '')
  }
}

const genAI = new GoogleGenerativeAI(apiKey)
const models = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

async function test() {
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m })
      const res = await model.generateContent('Di "FUNCIONA"')
      console.log(`Model ${m}:`, res.response.text().trim())
    } catch (e) {
      console.log(`Model ${m} FAILED:`, e.message)
    }
  }
}

test()
