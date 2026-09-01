import 'server-only'
import JSZip from 'jszip'

export interface ZipPackageParams {
  title: string
  planningDocx?: Buffer
  planningPdf?: Buffer
  rubricsDocx?: Buffer
  excelSpreadsheet?: Buffer
}

/**
 * Packages all generated deliverables into a single zip file for the teacher.
 */
export async function createDeliverablesZip(params: ZipPackageParams): Promise<Buffer> {
  const zip = new JSZip()
  const cleanTitle = (params.title || 'Planeacion_CBSJC')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50)

  const folder = zip.folder(`CBSJC_${cleanTitle}`) || zip

  if (params.planningDocx) {
    folder.file(`1_Planning_Book_${cleanTitle}.docx`, params.planningDocx)
  }

  if (params.planningPdf) {
    folder.file(`1_Planning_Book_${cleanTitle}.pdf`, params.planningPdf)
  }

  if (params.rubricsDocx) {
    folder.file(`2_Rubricas_Evaluacion_${cleanTitle}.docx`, params.rubricsDocx)
  }

  if (params.excelSpreadsheet) {
    folder.file(`3_Planilla_Notas_${cleanTitle}.xlsx`, params.excelSpreadsheet)
  }

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return content
}
