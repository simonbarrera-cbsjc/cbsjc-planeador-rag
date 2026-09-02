import fs from 'fs'

let apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
if (!apiKey && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  const match = envContent.match(/(?:GOOGLE_AI_API_KEY|GEMINI_API_KEY)\s*=\s*["']?([^"'\r\n]+)/)
  if (match) {
    apiKey = match[1].trim()
  }
}

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  const data = await res.json()
  if (data.models) {
    console.log('Available models for generateContent:')
    data.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .forEach((m) => {
        console.log(`- ${m.name} (inputLimit: ${m.inputTokenLimit}, outputLimit: ${m.outputTokenLimit})`)
      })
  } else {
    console.log('Error listing models:', data)
  }
}

listModels().catch(console.error)
