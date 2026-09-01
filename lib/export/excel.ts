import 'server-only'
import ExcelJS from 'exceljs'

export interface ExcelGenerationParams {
  docente: string
  area: string
  grado: string
  periodo: string
  semanas?: string
  tema: string
  evidenciaPrincipal?: string
  actividades?: Array<{
    nombre: string
    pilar: 'SABER' | 'SABER HACER' | 'SABER SER' | 'SABER CONVIVIR'
    porcentaje: number
  }>
}

/**
 * Generates an institutional Excel spreadsheet (.xlsx) for the CBSJC
 * with automated formulas for calculating weighted grades according to the 4 pillars (35/35/20/10)
 * and automatic classification into Gold, Silver, Bronze, and Sin Categoría bands.
 */
export async function generateGradeSpreadsheet(params: ExcelGenerationParams): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Colegio Bilingüe San José Campestre'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Planilla de Notas', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: true }],
  })

  // Set column widths
  sheet.columns = [
    { width: 6 },  // A: #
    { width: 32 }, // B: Apellidos y Nombres
    { width: 22 }, // C: Actividad 1 - Saber (35%)
    { width: 22 }, // D: Actividad 2 - Saber Hacer (35%)
    { width: 20 }, // E: Actividad 3 - Saber Ser (20%)
    { width: 20 }, // F: Actividad 4 - Saber Convivir (10%)
    { width: 16 }, // G: NOTA FINAL
    { width: 24 }, // H: NIVEL ALCANZADO
    { width: 30 }, // I: OBSERVACIONES
  ]

  // 1. Institutional Header
  sheet.mergeCells('A1:I1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE'
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1B4D' } } // CBSJC Navy
  sheet.getRow(1).height = 28

  sheet.mergeCells('A2:I2')
  const subtitleCell = sheet.getCell('A2')
  subtitleCell.value = 'SISTEMA INSTITUCIONAL DE EVALUACIÓN Y SEGUIMIENTO PEDAGÓGICO'
  subtitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD71921' } } // CBSJC Red
  sheet.getRow(2).height = 20

  // 2. Metadata Block
  const metaStyle = {
    font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0E1B4D' } },
    alignment: { vertical: 'middle' as const },
  }
  const valStyle = {
    font: { name: 'Arial', size: 9 },
    alignment: { vertical: 'middle' as const },
  }

  sheet.getCell('B4').value = 'Docente(s):'
  sheet.getCell('B4').style = metaStyle
  sheet.getCell('C4').value = params.docente || 'Docente Titular'
  sheet.getCell('C4').style = valStyle

  sheet.getCell('E4').value = 'Área / Asignatura:'
  sheet.getCell('E4').style = metaStyle
  sheet.getCell('F4').value = params.area || 'General'
  sheet.getCell('F4').style = valStyle

  sheet.getCell('B5').value = 'Grado / Grupo:'
  sheet.getCell('B5').style = metaStyle
  sheet.getCell('C5').value = params.grado || 'Primaria / Secundaria'
  sheet.getCell('C5').style = valStyle

  sheet.getCell('E5').value = 'Período / Subciclo:'
  sheet.getCell('E5').style = metaStyle
  sheet.getCell('F5').value = params.periodo || 'Período I'
  sheet.getCell('F5').style = valStyle

  sheet.getCell('B6').value = 'Secuencia / Tema:'
  sheet.getCell('B6').style = metaStyle
  sheet.getCell('C6').value = params.tema || 'Secuencia Didáctica'
  sheet.getCell('C6').style = valStyle

  sheet.getCell('E6').value = 'Semanas / Sesiones:'
  sheet.getCell('E6').style = metaStyle
  sheet.getCell('F6').value = params.semanas || '4 Semanas (90 min c/u)'
  sheet.getCell('F6').style = valStyle

  // 3. Table Headers
  const headerRowIndex = 8
  const headers = [
    '#',
    'Apellidos y Nombres del Estudiante',
    'SABER (35%)\nComprensión & Conceptos',
    'SABER HACER (35%)\nAplicación & Producto ACE',
    'SABER SER (20%)\nAutonomía & Metacognición',
    'SABER CONVIVIR (10%)\nTrabajo en Equipo & Rol',
    'NOTA FINAL\n(1.0 a 5.0)',
    'NIVEL ALCANZADO\n(Menú de Desafíos)',
    'Observaciones / Retroalimentación',
  ]

  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = headers
  headerRow.height = 36

  headers.forEach((_, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: idx === 6 ? 'FFD71921' : idx === 7 ? 'FF162874' : 'FF0E1B4D' },
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0E1B4D' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // 4. Student Data Rows (30 student slots)
  const startRow = 9
  const totalStudents = 30

  for (let i = 0; i < totalStudents; i++) {
    const currentRow = startRow + i
    const row = sheet.getRow(currentRow)
    const isEven = i % 2 === 0
    const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC'

    // Number
    row.getCell(1).value = i + 1
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

    // Student placeholder name
    row.getCell(2).value = i === 0 ? 'Ej: Álvarez Morales, Santiago' : ''
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }

    // Placeholder grades for row 1 demo
    if (i === 0) {
      row.getCell(3).value = 4.8 // Saber
      row.getCell(4).value = 4.7 // Saber Hacer
      row.getCell(5).value = 5.0 // Saber Ser
      row.getCell(6).value = 4.5 // Saber Convivir
      row.getCell(9).value = 'Excelente dominio conceptual y trabajo metacognitivo.'
    }

    // Number format for grade input cells (C, D, E, F)
    for (let col = 3; col <= 6; col++) {
      const cell = row.getCell(col)
      cell.numFmt = '0.0'
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }

    // Final Grade Formula (G): =IF(OR(C9="",D9="",E9="",F9=""), "", ROUND(C9*0.35 + D9*0.35 + E9*0.20 + F9*0.10, 2))
    const finalGradeCell = row.getCell(7)
    finalGradeCell.value = {
      formula: `IF(OR(C${currentRow}="",D${currentRow}="",E${currentRow}="",F${currentRow}=""), "", ROUND(C${currentRow}*0.35 + D${currentRow}*0.35 + E${currentRow}*0.20 + F${currentRow}*0.10, 2))`,
    }
    finalGradeCell.numFmt = '0.0'
    finalGradeCell.alignment = { horizontal: 'center', vertical: 'middle' }
    finalGradeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0E1B4D' } }

    // Level / Band Formula (H): Gold (>=4.8), Silver (>=4.6), Bronze (>=4.0), Sin Categoría (<4.0)
    const levelCell = row.getCell(8)
    levelCell.value = {
      formula: `IF(G${currentRow}="","", IF(G${currentRow}>=4.8,"Gold (4.8 - 5.0)", IF(G${currentRow}>=4.6,"Silver (4.6 - 4.7)", IF(G${currentRow}>=4.0,"Bronze (4.0 - 4.5)","Sin Categoría (1.0 - 3.9)"))))`,
    }
    levelCell.alignment = { horizontal: 'center', vertical: 'middle' }
    levelCell.font = { name: 'Arial', size: 9, bold: true }

    // Observations
    row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' }

    // Borders and row fill
    for (let col = 1; col <= 9; col++) {
      const cell = row.getCell(col)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    }
    row.height = 22
  }

  // 5. Statistics and Summary Card
  const statsStartRow = startRow + totalStudents + 2

  sheet.mergeCells(`B${statsStartRow}:D${statsStartRow}`)
  const statsHeader = sheet.getCell(`B${statsStartRow}`)
  statsHeader.value = 'RESUMEN ESTADÍSTICO DEL GRUPO'
  statsHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  statsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1B4D' } }
  statsHeader.alignment = { horizontal: 'center', vertical: 'middle' }

  const statsItems = [
    { label: 'Promedio General del Grupo', formula: `AVERAGE(G${startRow}:G${startRow + totalStudents - 1})`, fmt: '0.0' },
    { label: 'Calificación Más Alta (Máxima)', formula: `MAX(G${startRow}:G${startRow + totalStudents - 1})`, fmt: '0.0' },
    { label: 'Calificación Más Baja (Mínima)', formula: `MIN(G${startRow}:G${startRow + totalStudents - 1})`, fmt: '0.0' },
    { label: 'Estudiantes en Nivel Gold (4.8 - 5.0)', formula: `COUNTIF(G${startRow}:G${startRow + totalStudents - 1}, ">=4.8")`, fmt: '0' },
    { label: 'Estudiantes en Nivel Silver (4.6 - 4.7)', formula: `COUNTIFS(G${startRow}:G${startRow + totalStudents - 1}, ">=4.6", G${startRow}:G${startRow + totalStudents - 1}, "<4.8")`, fmt: '0' },
    { label: 'Estudiantes en Nivel Bronze (4.0 - 4.5)', formula: `COUNTIFS(G${startRow}:G${startRow + totalStudents - 1}, ">=4.0", G${startRow}:G${startRow + totalStudents - 1}, "<4.6")`, fmt: '0' },
    { label: 'Estudiantes Sin Categoría (1.0 - 3.9)', formula: `COUNTIFS(G${startRow}:G${startRow + totalStudents - 1}, ">=1.0", G${startRow}:G${startRow + totalStudents - 1}, "<4.0")`, fmt: '0' },
  ]

  statsItems.forEach((item, idx) => {
    const rowIdx = statsStartRow + 1 + idx
    sheet.mergeCells(`B${rowIdx}:C${rowIdx}`)
    const labelCell = sheet.getCell(`B${rowIdx}`)
    labelCell.value = item.label
    labelCell.font = { name: 'Arial', size: 9, bold: idx === 0 }
    labelCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } }

    const valCell = sheet.getCell(`D${rowIdx}`)
    valCell.value = { formula: item.formula }
    valCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0E1B4D' } }
    valCell.alignment = { horizontal: 'center', vertical: 'middle' }
    valCell.numFmt = item.fmt
    valCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    sheet.getRow(rowIdx).height = 20
  })

  // Write to Buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
