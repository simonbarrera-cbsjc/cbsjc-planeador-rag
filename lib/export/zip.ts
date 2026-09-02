import 'server-only'
import JSZip from 'jszip'

export interface ZipPackageParams {
  title: string
  planningDocx?: Buffer
  planningPdf?: Buffer
  rubricsDocx?: Buffer
  excelSpreadsheet?: Buffer
  aiPromptsTxt?: string
  cibercolegiosTxt?: string
}

/**
 * Packages all generated deliverables into a single zip file for the teacher.
 * Includes:
 * 1. Planning Book (SJB-RGA006) in DOCX & PDF
 * 2. Rubrics Matrix in DOCX
 * 3. Automated Excel Grade Spreadsheet (.xlsx)
 * 4. Bank of 30 specialized AI Prompts for extra resources & activities (.txt)
 * 5. Cibercolegios copy-paste snippet (.txt)
 */
export async function createDeliverablesZip(params: ZipPackageParams): Promise<Buffer> {
  const zip = new JSZip()
  const cleanTitle = (params.title || 'Planeacion_CBSJC')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50)

  const folder = zip.folder(`CBSJC_${cleanTitle}`) || zip

  if (params.planningDocx) {
    folder.file(`1_Planning_Book_SJB-RGA006_${cleanTitle}.docx`, params.planningDocx)
  }

  if (params.planningPdf) {
    folder.file(`2_Planning_Book_SJB-RGA006_${cleanTitle}.pdf`, params.planningPdf)
  }

  if (params.rubricsDocx) {
    folder.file(`3_Rubricas_Menu_Desafios_${cleanTitle}.docx`, params.rubricsDocx)
  }

  if (params.excelSpreadsheet) {
    folder.file(`4_Planilla_Notas_${cleanTitle}.xlsx`, params.excelSpreadsheet)
  }

  if (params.aiPromptsTxt && params.aiPromptsTxt.trim().length > 0) {
    folder.file(`5_Banco_30_Prompts_IA_Recursos_${cleanTitle}.txt`, params.aiPromptsTxt.trim())
  }

  if (params.cibercolegiosTxt && params.cibercolegiosTxt.trim().length > 0) {
    folder.file(`6_Traslado_Cibercolegios_${cleanTitle}.txt`, params.cibercolegiosTxt.trim())
  }

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return content
}
