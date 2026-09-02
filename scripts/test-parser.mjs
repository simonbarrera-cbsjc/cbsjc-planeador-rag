import fs from 'fs'
import mammoth from 'mammoth'
import { chunkText } from './test-chunker-helper.mjs'

async function run() {
  console.log('=== Testing Real DOCX Document Extraction ===')
  const docxPath = 'SJB-RGA006_Planning_Book_Primary_Secondary (1).docx'
  
  if (fs.existsSync(docxPath)) {
    const buffer = fs.readFileSync(docxPath)
    console.log(`Loaded ${docxPath} (${buffer.length} bytes)`)
    
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value
    console.log(`Extracted ${text.length} characters of raw text from real institutional template.`)
    console.log('Sample snippet:', text.slice(0, 300).replace(/\n+/g, ' '))
    
    const chunks = chunkText(text, 1000, 200)
    console.log(`Generated ${chunks.length} chunks with overlap.`)
    console.log('Chunk 1 length:', chunks[0]?.length)
    console.log('Extraction & Chunker test: SUCCESS')
  } else {
    console.log('Docx file not found, skipping.')
  }
}

run().catch(console.error)
