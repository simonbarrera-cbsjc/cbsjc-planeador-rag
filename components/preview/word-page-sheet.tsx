'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  DocumentBlock,
  DocumentPage,
  TableBlockData,
} from './document-parser'
import {
  Plus,
  Trash2,
  Table as TableIcon,
  AlignLeft,
  List,
  Heading2,
  ChevronDown,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WordPageSheetProps {
  page: DocumentPage
  pageIndex: number
  totalPages: number
  isEditable: boolean
  zoomScale: number
  onUpdateBlock: (blockId: string, updatedBlock: Partial<DocumentBlock>) => void
  onAddBlock: (targetBlockId: string, newType: DocumentBlock['type']) => void
  onDeleteBlock: (blockId: string) => void
}

export function WordPageSheet({
  page,
  pageIndex,
  totalPages,
  isEditable,
  zoomScale,
  onUpdateBlock,
  onAddBlock,
  onDeleteBlock,
}: WordPageSheetProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)

  // Cell change handler for table blocks
  const handleCellChange = (
    blockId: string,
    tableData: TableBlockData,
    rowIndex: number,
    colIndex: number,
    newValue: string
  ) => {
    const updatedRows = tableData.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row
      const newRow = [...row]
      newRow[colIndex] = newValue
      return newRow
    })

    onUpdateBlock(blockId, {
      tableData: {
        ...tableData,
        rows: updatedRows,
      },
    })
  }

  // Header cell change handler
  const handleHeaderCellChange = (
    blockId: string,
    tableData: TableBlockData,
    colIndex: number,
    newValue: string
  ) => {
    const updatedHeaders = [...tableData.headers]
    updatedHeaders[colIndex] = newValue

    onUpdateBlock(blockId, {
      tableData: {
        ...tableData,
        headers: updatedHeaders,
      },
    })
  }

  // Add row to table
  const handleAddTableRow = (blockId: string, tableData: TableBlockData) => {
    const colCount = Math.max(tableData.headers.length, 2)
    const newRow = new Array(colCount).fill('')
    onUpdateBlock(blockId, {
      tableData: {
        ...tableData,
        rows: [...tableData.rows, newRow],
      },
    })
  }

  // Delete row from table
  const handleDeleteTableRow = (
    blockId: string,
    tableData: TableBlockData,
    rowIndex: number
  ) => {
    if (tableData.rows.length <= 1) return
    const updatedRows = tableData.rows.filter((_, idx) => idx !== rowIndex)
    onUpdateBlock(blockId, {
      tableData: {
        ...tableData,
        rows: updatedRows,
      },
    })
  }

  const isFirstPage = page.pageNumber === 1

  return (
    <div className="relative group/page flex flex-col items-center mb-10 select-text">
      {/* Page Header Indicator Label */}
      <div className="w-full max-w-4xl flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2 px-2 print:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#0E1B4D]" />
          <span className="uppercase tracking-wider font-bold text-[#0E1B4D]">
            Página {page.pageNumber} de {totalPages}
          </span>
          <span className="text-slate-400 font-normal">· {page.title}</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          Formato A4 Oficial SJB-RGA006
        </div>
      </div>

      {/* A4 PHYSICAL SHEET SIMULATION */}
      <div
        style={{
          transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
          transformOrigin: 'top center',
        }}
        className={`w-full max-w-4xl bg-white text-slate-900 border border-slate-300/80 shadow-[0_8px_30px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] rounded-[2px] transition-shadow duration-200 p-8 sm:p-12 md:p-14 min-h-[1123px] flex flex-col justify-between relative print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none`}
      >
        {/* TOP OF PAGE: OFFICIAL HEADER */}
        <div className="space-y-4">
          {isFirstPage ? (
            /* Official 3-Column Header Table on Page 1 */
            <div className="border-2 border-slate-700 rounded-sm overflow-hidden grid grid-cols-12 text-xs mb-6 bg-white shadow-xs">
              {/* Column 1: CBSJC Crest */}
              <div className="col-span-2 p-3 bg-white border-r-2 border-slate-700 flex flex-col items-center justify-center">
                <div className="relative w-16 h-16">
                  <Image
                    src="/cbsjc-crest.png"
                    alt="Escudo Oficial CBSJC"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              {/* Column 2: Institution & Document Title */}
              <div className="col-span-7 p-3 border-r-2 border-slate-700 text-center flex flex-col justify-center bg-white space-y-0.5">
                <h2 className="font-extrabold text-[#0E1B4D] text-xs uppercase tracking-wide">
                  Colegio Bilingüe San José Campestre
                </h2>
                <h3 className="font-black text-[#D71921] text-xs uppercase tracking-wide">
                  Planning Book Primary & Secondary
                </h3>
                <p className="text-[10px] text-slate-600 font-medium">
                  Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6
                </p>
              </div>

              {/* Column 3: Quality Management Code & Metadata */}
              <div className="col-span-3 p-3 bg-slate-50 flex flex-col justify-center text-[10px] text-right space-y-0.5">
                <p className="font-bold text-[#0E1B4D]">CÓDIGO: SJB-RGA006</p>
                <p className="text-slate-600">VERSIÓN: 4</p>
                <p className="text-slate-600">VIGENCIA: 2026</p>
                <p className="font-bold text-slate-800">
                  PÁGINA: {page.pageNumber} de {totalPages}
                </p>
              </div>
            </div>
          ) : (
            /* Running Header on Page 2+ */
            <div className="border-b border-slate-300 pb-2 mb-6 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span className="font-bold text-[#0E1B4D] uppercase tracking-wider">
                Colegio Bilingüe San José Campestre · Formato RGA006
              </span>
              <span className="font-mono text-slate-400">
                Pág. {page.pageNumber} de {totalPages}
              </span>
            </div>
          )}

          {/* PAGE BODY BLOCKS */}
          <div className="space-y-3.5">
            {page.blocks.map((block) => {
              const isActive = activeBlockId === block.id

              return (
                <div
                  key={block.id}
                  onFocus={() => setActiveBlockId(block.id)}
                  className={`relative group/block rounded transition-all duration-150 ${
                    isEditable && isActive
                      ? 'ring-1 ring-[#0E1B4D]/30 bg-slate-50/40 p-1'
                      : isEditable
                      ? 'hover:bg-slate-50/30 p-1'
                      : ''
                  }`}
                >
                  {/* Block Renderers */}
                  {block.type === 'h1' && (
                    <div
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        onUpdateBlock(block.id, { content: e.currentTarget.textContent || '' })
                      }
                      className="text-lg font-black text-[#0E1B4D] uppercase tracking-wide border-b-2 border-[#0E1B4D] pb-1.5 mt-4 mb-2 outline-none focus:bg-blue-50/30 px-1 rounded"
                    >
                      {block.content}
                    </div>
                  )}

                  {block.type === 'h2' && (
                    <div
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        onUpdateBlock(block.id, { content: e.currentTarget.textContent || '' })
                      }
                      className="text-xs font-bold text-[#0E1B4D] uppercase tracking-wider flex items-center gap-2 mt-4 mb-2 outline-none focus:bg-blue-50/30 px-1 rounded"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#D71921] shrink-0" />
                      <span>{block.content}</span>
                    </div>
                  )}

                  {block.type === 'h3' && (
                    <div
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        onUpdateBlock(block.id, { content: e.currentTarget.textContent || '' })
                      }
                      className="text-xs font-bold text-[#D71921] uppercase tracking-wide mt-3 mb-1 outline-none focus:bg-red-50/30 px-1 rounded"
                    >
                      {block.content}
                    </div>
                  )}

                  {block.type === 'h4' && (
                    <div
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        onUpdateBlock(block.id, { content: e.currentTarget.textContent || '' })
                      }
                      className="text-[11px] font-bold text-slate-800 uppercase mt-2.5 mb-1 outline-none focus:bg-slate-100 px-1 rounded"
                    >
                      {block.content}
                    </div>
                  )}

                  {block.type === 'paragraph' && (
                    <p
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        onUpdateBlock(block.id, { content: (e.currentTarget.innerHTML || '').replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**').replace(/<[^>]+>/g, '') })
                      }
                      className="text-xs text-slate-800 leading-relaxed outline-none focus:bg-blue-50/30 px-1 py-0.5 rounded"
                      dangerouslySetInnerHTML={{
                        __html: block.content.replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong class="text-[#0E1B4D] font-bold">$1</strong>'
                        ),
                      }}
                    />
                  )}

                  {block.type === 'bullet' && (
                    <div className="flex items-start gap-2 text-xs text-slate-800 my-1 pl-2">
                      <span className="text-[#D71921] font-bold leading-relaxed shrink-0">•</span>
                      <div
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onUpdateBlock(block.id, { content: (e.currentTarget.innerHTML || '').replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**').replace(/<[^>]+>/g, '') })
                        }
                        className="flex-1 leading-relaxed outline-none focus:bg-blue-50/30 px-1 rounded"
                        dangerouslySetInnerHTML={{
                          __html: block.content.replace(
                            /\*\*(.*?)\*\*/g,
                            '<strong class="text-[#0E1B4D] font-bold">$1</strong>'
                          ),
                        }}
                      />
                    </div>
                  )}

                  {block.type === 'number-list' && (
                    <div className="flex items-start gap-2 text-xs text-slate-800 my-1 pl-2">
                      <span className="text-[#0E1B4D] font-bold leading-relaxed shrink-0">1.</span>
                      <div
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onUpdateBlock(block.id, { content: e.currentTarget.textContent || '' })
                        }
                        className="flex-1 leading-relaxed outline-none focus:bg-blue-50/30 px-1 rounded"
                      >
                        {block.content}
                      </div>
                    </div>
                  )}

                  {block.type === 'divider' && (
                    <div className="my-4 border-b border-slate-300" />
                  )}

                  {block.type === 'code' && (
                    <pre className="p-3 bg-slate-900 text-slate-100 text-[11px] rounded-lg font-mono overflow-x-auto whitespace-pre-wrap my-2 border border-slate-700">
                      <code>{block.content}</code>
                    </pre>
                  )}

                  {/* TABLE BLOCK RENDERER */}
                  {block.type === 'table' && block.tableData && (
                    <div className="my-3 overflow-x-auto rounded-lg border border-slate-300 shadow-xs bg-white">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#0E1B4D] text-white">
                            {block.tableData.headers.map((headerText, cIdx) => (
                              <th
                                key={cIdx}
                                className="p-2.5 font-bold border border-slate-300 text-left text-[11px] tracking-wide"
                              >
                                {isEditable ? (
                                  <input
                                    type="text"
                                    value={headerText}
                                    onChange={(e) =>
                                      handleHeaderCellChange(
                                        block.id,
                                        block.tableData!,
                                        cIdx,
                                        e.target.value
                                      )
                                    }
                                    className="w-full bg-transparent text-white font-bold outline-none border-b border-white/40 focus:border-white text-[11px]"
                                  />
                                ) : (
                                  headerText
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.tableData.rows.map((row, rIdx) => {
                            const isEven = rIdx % 2 === 0
                            return (
                              <tr
                                key={rIdx}
                                className={`group/row transition-colors ${
                                  isEven ? 'bg-white' : 'bg-slate-50/80'
                                } hover:bg-blue-50/30`}
                              >
                                {row.map((cellText, cIdx) => {
                                  // First column in 2-column key-value tables is formatted as header-like
                                  const isKeyCol = block.tableData!.headers.length === 2 && cIdx === 0

                                  return (
                                    <td
                                      key={cIdx}
                                      className={`p-2.5 border border-slate-200 text-slate-800 text-xs leading-relaxed align-top ${
                                        isKeyCol ? 'font-bold text-[#0E1B4D] bg-slate-100/40 w-1/3' : ''
                                      }`}
                                    >
                                      {isEditable ? (
                                        <textarea
                                          value={cellText}
                                          rows={Math.max(1, Math.ceil(cellText.length / 45))}
                                          onChange={(e) =>
                                            handleCellChange(
                                              block.id,
                                              block.tableData!,
                                              rIdx,
                                              cIdx,
                                              e.target.value
                                            )
                                          }
                                          className="w-full bg-transparent resize-y outline-none focus:bg-white focus:ring-1 focus:ring-[#0E1B4D]/40 p-1 rounded text-xs leading-relaxed border-0 font-sans"
                                        />
                                      ) : (
                                        <span
                                          dangerouslySetInnerHTML={{
                                            __html: cellText
                                              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#0E1B4D] font-bold">$1</strong>')
                                              .replace(/<br\s*\/?>/g, '<br />'),
                                          }}
                                        />
                                      )}
                                    </td>
                                  )
                                })}

                                {isEditable && (
                                  <td className="w-8 p-1 border border-slate-200 text-center opacity-0 group-hover/row:opacity-100 transition-opacity print:hidden">
                                    <button
                                      onClick={() =>
                                        handleDeleteTableRow(block.id, block.tableData!, rIdx)
                                      }
                                      title="Eliminar fila"
                                      className="p-1 text-slate-400 hover:text-[#D71921] rounded"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      {/* Add Table Row Button */}
                      {isEditable && (
                        <div className="p-1.5 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAddTableRow(block.id, block.tableData!)}
                            className="h-6 px-2 text-[10px] font-bold text-[#0E1B4D] hover:bg-slate-200 rounded"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Añadir Fila a Tabla
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Block Hover Actions (Add Block below / Delete block) */}
                  {isEditable && (
                    <div className="absolute right-0 -bottom-3 opacity-0 group-hover/block:opacity-100 transition-opacity z-10 flex items-center gap-1 bg-white border border-slate-300 shadow-md rounded-md px-1.5 py-0.5 print:hidden">
                      <button
                        onClick={() => onAddBlock(block.id, 'paragraph')}
                        title="Añadir Párrafo Abajo"
                        className="p-1 text-slate-600 hover:text-[#0E1B4D] rounded"
                      >
                        <AlignLeft className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onAddBlock(block.id, 'bullet')}
                        title="Añadir Viñeta Abajo"
                        className="p-1 text-slate-600 hover:text-[#0E1B4D] rounded"
                      >
                        <List className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onAddBlock(block.id, 'h3')}
                        title="Añadir Subtítulo Abajo"
                        className="p-1 text-slate-600 hover:text-[#0E1B4D] rounded"
                      >
                        <Heading2 className="h-3 w-3" />
                      </button>
                      <div className="w-px h-3 bg-slate-200 mx-0.5" />
                      <button
                        onClick={() => onDeleteBlock(block.id)}
                        title="Eliminar Bloque"
                        className="p-1 text-slate-400 hover:text-[#D71921] rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* BOTTOM OF PAGE: OFFICIAL RUNNING FOOTER */}
        <div className="border-t border-slate-300 pt-3 mt-8 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0E1B4D]">Colegio Bilingüe San José Campestre</span>
            <span className="text-slate-400">·</span>
            <span>Sistema de Gestión de Calidad Académica</span>
          </div>
          <div className="flex items-center gap-2 mt-1 sm:mt-0 font-mono">
            <span>SJB-RGA006 (V4)</span>
            <span className="text-slate-400">·</span>
            <span className="font-bold text-slate-700">
              Página {page.pageNumber} de {totalPages}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
