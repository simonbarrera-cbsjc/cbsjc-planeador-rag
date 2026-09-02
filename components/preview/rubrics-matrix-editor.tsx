'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  TableProperties,
  Copy,
  CheckCircle2,
  FileDown,
  Save,
  BookOpen,
  HelpCircle,
  Sparkles,
  Layers,
  GraduationCap,
  FileSpreadsheet,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react'

export interface RubricsMatrixEditorProps {
  rubricsMarkdown: string
  setRubricsMarkdown: (val: string) => void
  cibercolegiosSnippet: string
  setCibercolegiosSnippet: (val: string) => void
  onSave: () => void
  onExportRubricsDocx: () => void
  isExporting: boolean
}

export function RubricsMatrixEditor({
  rubricsMarkdown,
  setRubricsMarkdown,
  cibercolegiosSnippet,
  setCibercolegiosSnippet,
  onSave,
  onExportRubricsDocx,
  isExporting,
}: RubricsMatrixEditorProps) {
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'written' | 'lab' | 'oral' | 'raw'>(
    'matrix'
  )

  const handleCopy = () => {
    if (!cibercolegiosSnippet) return
    navigator.clipboard.writeText(cibercolegiosSnippet)
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* 1. Cibercolegios Direct Transfer Block */}
      <Card className="border-slate-200 bg-slate-50/90 shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-b border-slate-200">
          <div>
            <CardTitle className="text-sm font-black text-[#0E1B4D] flex items-center gap-2">
              <Copy className="h-4 w-4 text-[#D71921]" />
              Bloque de Traslado Directo a Cibercolegios (SJB-RGA006)
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Pega este texto íntegro en la descripción de la tarea / evaluación en Cibercolegios.
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={handleCopy}
            className="bg-[#0E1B4D] hover:bg-[#162874] text-white text-xs font-bold rounded-xl shadow-sm h-8 px-4 flex items-center gap-1.5 shrink-0"
          >
            {copiedSnippet ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copiedSnippet ? '¡Copiado al Portapapeles!' : 'Copiar Texto Cibercolegios'}</span>
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          <Textarea
            value={cibercolegiosSnippet}
            onChange={(e) => setCibercolegiosSnippet(e.target.value)}
            rows={4}
            className="bg-white border-slate-300 font-mono text-xs leading-relaxed rounded-xl focus:border-[#162874]"
            placeholder="Texto para Cibercolegios..."
          />
        </CardContent>
      </Card>

      {/* 2. Menú de Desafíos & Rubrics Matrix Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'matrix'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            Matriz Menú de Desafíos (Global)
          </button>
          <button
            onClick={() => setActiveSubTab('written')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'written'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            1. Prueba Escrita (10 Ítems)
          </button>
          <button
            onClick={() => setActiveSubTab('lab')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'lab'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            2. Laboratorio (4 Estaciones)
          </button>
          <button
            onClick={() => setActiveSubTab('oral')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'oral'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            3. Sustentación Oral A2
          </button>
          <button
            onClick={() => setActiveSubTab('raw')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'raw'
                ? 'bg-[#0E1B4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            Editor Texto Completo
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onExportRubricsDocx}
            disabled={isExporting}
            className="bg-[#0E1B4D] hover:bg-[#162874] text-white font-bold text-xs rounded-xl h-8 shadow-xs"
          >
            <FileDown className="h-3.5 w-3.5 mr-1" />
            Descargar Rúbrica (.docx)
          </Button>

          <Button
            size="sm"
            onClick={onSave}
            className="bg-[#D71921] hover:bg-[#B81219] text-white font-bold text-xs rounded-xl h-8 shadow-xs"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Guardar Rúbricas
          </Button>
        </div>
      </div>

      {/* 3. Sub-Tab Content: Master Matrix */}
      {activeSubTab === 'matrix' && (
        <Card className="border-slate-200 shadow-md rounded-2xl bg-white p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-[#0E1B4D] uppercase tracking-wide flex items-center gap-2">
              <TableProperties className="h-4 w-4 text-[#D71921]" />
              Matriz Institucional Menú de Desafíos · 4 Bandas de Evaluación
            </h3>
            <p className="text-xs text-slate-600">
              Evaluación por pilares de la evidencia de aprendizaje principal según los estándares CBSJC.
            </p>
          </div>

          {/* Menú de Desafíos 4-Band Matrix Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-xs">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-3 bg-[#0E1B4D] text-white font-bold border border-slate-300 text-left w-1/5">
                    Pilar Institucional
                  </th>
                  <th className="p-3 bg-red-50 text-red-950 font-bold border border-slate-300 text-left w-1/5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#D71921]" />
                      <span>Sin Categoría (1.0 – 3.9)</span>
                    </div>
                    <span className="text-[10px] font-normal text-red-800 block">En consolidación</span>
                  </th>
                  <th className="p-3 bg-slate-100 text-slate-900 font-bold border border-slate-300 text-left w-1/5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-600" />
                      <span>Bronze (4.0 – 4.5)</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-600 block">Esperado de grado</span>
                  </th>
                  <th className="p-3 bg-slate-200/90 text-[#0E1B4D] font-bold border border-slate-300 text-left w-1/5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#162874]" />
                      <span>Silver (4.6 – 4.7)</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-600 block">Profundización</span>
                  </th>
                  <th className="p-3 bg-[#0E1B4D] text-white font-bold border border-slate-300 text-left w-1/5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>Gold (4.8 – 5.0)</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-200 block">Excelencia y PRAE</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Pilar 1: SABER */}
                <tr className="bg-white hover:bg-slate-50">
                  <td className="p-3 border border-slate-300 font-bold text-[#0E1B4D] align-top bg-slate-50/60">
                    SABER (35%)
                    <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                      Comprensión conceptual disciplinar
                    </span>
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Identifica conceptos aislados con imprecisiones teóricas; requiere apoyo permanente para explicar fenómenos clave.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Explica los conceptos disciplinares esenciales con rigor y claridad según el estándar y DBA del grado.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Relaciona los conceptos con otras asignaturas y justifica detalladamente los modelos teóricos con evidencia.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-800 font-medium align-top leading-relaxed text-[11px] bg-blue-50/20">
                    Formula hipótesis originales, transfiere conocimientos a situaciones inéditas del campus y sustenta con criterio experto.
                  </td>
                </tr>

                {/* Pilar 2: SABER HACER */}
                <tr className="bg-slate-50/40 hover:bg-slate-50">
                  <td className="p-3 border border-slate-300 font-bold text-[#0E1B4D] align-top bg-slate-50/60">
                    SABER HACER (35%)
                    <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                      Producto ACE y procedimientos
                    </span>
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Desarrolla el producto o protocolo de forma incompleta; omite el componente bilingüe o presenta errores procedimentales.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Ejecuta el protocolo experimental completo y genera la evidencia principal aplicando el vocabulario bilingüe A2.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Diseña esquemas técnicos adicionales, analiza variables con precisión y utiliza estructuras bilingües fluidas.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-800 font-medium align-top leading-relaxed text-[11px] bg-blue-50/20">
                    Crea un producto capstone de calidad profesional con impacto real en el entorno campestre y sustentación bilingüe sobresaliente.
                  </td>
                </tr>

                {/* Pilar 3: SABER SER */}
                <tr className="bg-white hover:bg-slate-50">
                  <td className="p-3 border border-slate-300 font-bold text-[#D71921] align-top bg-red-50/30">
                    SABER SER (20%)
                    <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                      Autonomía y mentalidad de crecimiento
                    </span>
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Muestra pasividad ante las dificultades; no registra su progreso en el Tablero Anexo A6 ni gestiona el tiempo de clase.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Demuestra persistencia, autoevalúa sus avances honestamente y aplica las sugerencias de retroalimentación recibidas.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Propone mejoras continuas a su trabajo antes de la entrega y mantiene una disciplina autónoma y proactiva.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-800 font-medium align-top leading-relaxed text-[11px] bg-blue-50/20">
                    Evidencia metacognición profunda, lidera procesos éticos de autocuidado y demuestra compromiso ambiental PRAE ejemplar.
                  </td>
                </tr>

                {/* Pilar 4: SABER CONVIVIR */}
                <tr className="bg-slate-50/40 hover:bg-slate-50">
                  <td className="p-3 border border-slate-300 font-bold text-emerald-800 align-top bg-emerald-50/30">
                    SABER CONVIVIR (10%)
                    <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                      Colaboración y compromiso PRAE
                    </span>
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Genera tensiones en el equipo de trabajo; no asume roles colaborativos ni respeta el material de laboratorio.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Cumple su rol asignado, escucha activamente a sus pares y practica la coevaluación constructiva (Praise & Polish).
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-700 align-top leading-relaxed text-[11px]">
                    Media activamente para resolver desacuerdos en el grupo y fomenta un ambiente de estudio armónico y eficiente.
                  </td>
                  <td className="p-3 border border-slate-200 text-slate-800 font-medium align-top leading-relaxed text-[11px] bg-blue-50/20">
                    Inspira a sus compañeros con liderazgo positivo, cuida el campus campestre y promueve la excelencia colectiva.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. Sub-Tabs for the 3 Evaluative Instruments */}
      {activeSubTab === 'written' && (
        <Card className="border-slate-200 shadow-md rounded-2xl bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-black text-[#0E1B4D] uppercase">
                Evaluación Final 1: Prueba Escrita y Análisis Cognitivo (10 Ítems)
              </h3>
              <p className="text-xs text-slate-600">
                Estructurada con preguntas tipo ICFES, análisis de casos en campus PRAE, matching bilingüe A2 y preguntas abiertas.
              </p>
            </div>
            <Badge className="bg-[#0E1B4D] text-white text-xs">SABER 35% / HACER 15%</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <p className="font-bold text-[#0E1B4D]">Tipología de los 10 Ítems:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>Ítems 1-2: Selección múltiple con única respuesta tipo ICFES y justificación teórica.</li>
                <li>Ítem 3: Análisis de caso contextualizado en el Campus San José Campestre (PRAE).</li>
                <li>Ítems 4-5: Emparejamiento bilingüe A2 (términos clave y definiciones técnicas).</li>
                <li>Ítem 6: Rotulación y diagramación de esquemas disciplinares en inglés.</li>
                <li>Ítems 7-8: Indagación, formulación de hipótesis y explicación de fenómenos.</li>
                <li>Ítem 9: Comprensión de lectura bilingüe A2 de texto científico corto.</li>
                <li>Ítem 10: Metacognición y compromiso ético institucional.</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
              <p className="font-bold text-[#0E1B4D]">Rúbrica Analítica de 4 Criterios:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>1. Comprensión Conceptual Disciplinar (SABER)</li>
                <li>2. Aplicación y Relación de Conceptos (SABER HACER)</li>
                <li>3. Precisión Lingüística Bilingüe A2 (Componente ACE)</li>
                <li>4. Reflexión, Autonomía y PRAE (SABER SER)</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {activeSubTab === 'lab' && (
        <Card className="border-slate-200 shadow-md rounded-2xl bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-black text-[#0E1B4D] uppercase">
                Evaluación Final 2: Examen Práctico y Estaciones de Laboratorio
              </h3>
              <p className="text-xs text-slate-600">
                Circuito de 4 estaciones rotativas de 15 minutos con manipulación de instrumentos y toma de datos técnicos.
              </p>
            </div>
            <Badge className="bg-[#0E1B4D] text-white text-xs">SABER HACER 45% / SER 20%</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-[#0E1B4D] block">Estación 1 (15 min)</span>
              <p className="text-slate-600 text-[11px]">Montaje experimental, calibración de instrumentos y registro numérico.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-[#0E1B4D] block">Estación 2 (15 min)</span>
              <p className="text-slate-600 text-[11px]">Identificación de muestras biológicas/técnicas y diagnóstico comparativo.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-[#0E1B4D] block">Estación 3 (15 min)</span>
              <p className="text-slate-600 text-[11px]">Modelado práctico de soluciones con mini-sustentación oral en inglés A2.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-[#0E1B4D] block">Estación 4 (15 min)</span>
              <p className="text-slate-600 text-[11px]">Bitácora de laboratorio, bioseguridad, orden del puesto y entrega final.</p>
            </div>
          </div>
        </Card>
      )}

      {activeSubTab === 'oral' && (
        <Card className="border-slate-200 shadow-md rounded-2xl bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-black text-[#0E1B4D] uppercase">
                Evaluación Final 3: Sustentación Oral Bilingüe A2 (Scientific Pitch)
              </h3>
              <p className="text-xs text-slate-600">
                Defensa oral de 3 a 5 minutos frente a panel docente y pares evaluadores bajo formato TED-Ed.
              </p>
            </div>
            <Badge className="bg-[#0E1B4D] text-white text-xs">HACER 45% / SER 20% / CONVIVIR 10%</Badge>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <p className="font-bold text-[#0E1B4D]">Estructura de la Sustentación Oral Bilingüe:</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[11px]">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-[#D71921] block">1. Hook & Apertura</span>
                <span className="text-slate-500">30 seg con guion bilingüe de inicio.</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-[#0E1B4D] block">2. Fundamentos</span>
                <span className="text-slate-500">1.5 min explicando el problema y teoría.</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-[#0E1B4D] block">3. Demostración</span>
                <span className="text-slate-500">1.5 min exponiendo el producto y datos.</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-emerald-800 block">4. Aporte PRAE</span>
                <span className="text-slate-500">30 seg de impacto ambiental.</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block">5. Preguntas</span>
                <span className="text-slate-500">1 min de defensa ante jurado.</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Full Raw Markdown Editor for Rubrics */}
      {activeSubTab === 'raw' && (
        <Card className="border-slate-200 shadow-md rounded-2xl bg-white p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0E1B4D]">Editor de Texto Completo de Rúbricas</h3>
            <span className="text-xs text-slate-400">Total caracteres: {rubricsMarkdown.length}</span>
          </div>
          <Textarea
            value={rubricsMarkdown}
            onChange={(e) => setRubricsMarkdown(e.target.value)}
            rows={24}
            className="font-mono text-xs leading-relaxed p-4 bg-white border-slate-300 rounded-xl"
          />
        </Card>
      )}
    </div>
  )
}
