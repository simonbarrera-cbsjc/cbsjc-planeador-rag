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
const models = ['gemini-embedding-001', 'gemini-embedding-2', 'gemini-embedding-2-preview']

async function testEmbed() {
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m })
      const res = await model.embedContent('Colegio Bilingue San Jose Campestre')
      console.log(`Model ${m} SUCCESS, dim:`, res.embedding.values.length)
    } catch (e) {
      console.log(`Model ${m} FAILED:`, e.message)
    }
  }
}

testEmbed()
