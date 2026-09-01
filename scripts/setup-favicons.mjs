import fs from 'fs'
import path from 'path'

const shieldSrc = 'C:/Users/User/.gemini/antigravity/brain/958e786d-9973-47e1-aac3-f00b70608dc8/.user_uploaded/media_1788290722201.png'

const targets = [
  'public/logo.png',
  'public/shield.png',
  'public/icon.png',
  'public/favicon.ico',
  'app/icon.png',
  'app/favicon.ico',
  'app/apple-icon.png',
]

for (const target of targets) {
  const fullPath = path.resolve(target)
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(shieldSrc, fullPath)
  console.log(`Copied favicon/icon to: ${target}`)
}
