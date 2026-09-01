import mammoth from 'mammoth'
import fs from 'fs'

async function inspect() {
  const filePath = './SJB-RGA006_Planning_Book_Primary_Secondary (1).docx'
  const htmlResult = await mammoth.convertToHtml({ path: filePath })
  const textResult = await mammoth.extractRawText({ path: filePath })

  fs.writeFileSync('./template-inspection.html', htmlResult.value)
  fs.writeFileSync('./template-inspection.txt', textResult.value)

  console.log('--- TEMPLATE TEXT PREVIEW (First 2000 chars) ---')
  console.log(textResult.value.slice(0, 2000))
  console.log('--- END PREVIEW ---')
}

inspect().catch(console.error)
