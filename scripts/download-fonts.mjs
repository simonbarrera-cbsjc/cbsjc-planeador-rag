import fs from 'fs'
import path from 'path'

async function downloadFonts() {
  const fonts = [
    {
      name: 'Roboto-Regular.ttf',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
    },
    {
      name: 'Roboto-Bold.ttf',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
    },
    {
      name: 'Roboto-Italic.ttf',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-italic-webfont.ttf',
    },
    {
      name: 'Roboto-BoldItalic.ttf',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bolditalic-webfont.ttf',
    },
  ]

  const outDir = path.join(process.cwd(), 'public', 'fonts')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  for (const f of fonts) {
    const filePath = path.join(outDir, f.name)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) {
      console.log(`Downloading ${f.name}...`)
      try {
        const res = await fetch(f.url)
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          fs.writeFileSync(filePath, buf)
          console.log(`Saved ${f.name} (${buf.length} bytes)`)
        } else {
          console.warn(`Failed to download ${f.name}: HTTP ${res.status}`)
        }
      } catch (err) {
        console.warn(`Error downloading ${f.name}:`, err.message)
      }
    } else {
      console.log(`Font already exists: ${f.name} (${fs.statSync(filePath).size} bytes)`)
    }
  }
}

downloadFonts().catch(console.error)
