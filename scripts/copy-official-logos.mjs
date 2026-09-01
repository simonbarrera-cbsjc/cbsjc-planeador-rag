import fs from 'fs'
import path from 'path'

const shieldSrc = 'C:/Users/User/.gemini/antigravity/brain/958e786d-9973-47e1-aac3-f00b70608dc8/.user_uploaded/media_1788290722201.png'
const lockupSrc = 'C:/Users/User/.gemini/antigravity/brain/958e786d-9973-47e1-aac3-f00b70608dc8/.user_uploaded/media_1788290722172.png'

const publicDir = path.resolve('public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

fs.copyFileSync(shieldSrc, path.join(publicDir, 'logo.png'))
fs.copyFileSync(shieldSrc, path.join(publicDir, 'shield.png'))
fs.copyFileSync(lockupSrc, path.join(publicDir, 'banner.png'))
fs.copyFileSync(lockupSrc, path.join(publicDir, 'horizontal-logo.png'))

console.log('Real official logos successfully copied to public/ directory!')
