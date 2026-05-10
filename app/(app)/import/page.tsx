'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  Upload, CheckCircle2, AlertCircle, FileText, TrendingDown, ChevronDown, ChevronUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { BodyMeasurement } from '@/types/database'

// ─── CSV Parser ────────────────────────────────────────────────────────────────

interface ParsedRow {
  date: string
  weight_kg: number | null
  bmi: number | null
  body_fat_percent: number | null
  muscle_mass_kg: number | null
  bone_mass_kg: number | null
  water_percent: number | null
  visceral_fat: number | null
}

function findColIdx(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.includes(c))
    if (i !== -1) return i
  }
  return -1
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  // Handle "2024-01-15 08:30:00", "2024/01/15 08:30", "2024-01-15", "15.01.2024"
  const cleaned = raw.trim().replace(/\//g, '-')
  const dateOnly = cleaned.split(' ')[0].split('T')[0]
  // dd.mm.yyyy → yyyy-mm-dd
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateOnly)) {
    const [d, m, y] = dateOnly.split('.')
    return `${y}-${m}-${d}`
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly
  return null
}

function parseNum(val: string): number | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null
  const n = parseFloat(val.trim().replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseIntVal(val: string): number | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null
  const n = parseInt(val.trim())
  return isNaN(n) ? null : n
}

export function parseMiFitnessCSV(text: string): { rows: ParsedRow[]; warnings: string[] } {
  const warnings: string[] = []

  // Detect separator
  const firstLine = text.split('\n')[0]
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','

  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('Файл пустой или содержит только заголовок')

  const rawHeaders = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase())

  const dateIdx = findColIdx(rawHeaders, ['time', 'date', 'дата', 'время', '时间'])
  const weightIdx = findColIdx(rawHeaders, ['weight', 'вес', '体重'])
  const bmiIdx = findColIdx(rawHeaders, ['bmi', 'имт', 'индекс'])
  const fatIdx = findColIdx(rawHeaders, ['fat', 'жир', '体脂', 'body fat'])
  const muscleIdx = findColIdx(rawHeaders, ['muscle', 'мышц', '肌肉', 'skeletal'])
  const boneIdx = findColIdx(rawHeaders, ['bone', 'кост', '骨'])
  const waterIdx = findColIdx(rawHeaders, ['water', 'вод', '水分'])
  const visceralIdx = findColIdx(rawHeaders, ['visceral', 'висцер', '内脏'])

  if (dateIdx === -1) throw new Error('Колонка с датой не найдена. Проверьте формат файла.')
  if (weightIdx === -1) throw new Error('Колонка с весом не найдена. Проверьте формат файла.')

  const missingCols: string[] = []
  if (fatIdx === -1) missingCols.push('жировая масса')
  if (muscleIdx === -1) missingCols.push('мышечная масса')
  if (boneIdx === -1) missingCols.push('костная масса')
  if (missingCols.length) warnings.push(`Не найдены колонки: ${missingCols.join(', ')} — эти поля будут пустыми`)

  const rows: ParsedRow[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const date = parseDate(cols[dateIdx] || '')
    const weight = parseNum(cols[weightIdx] || '')

    if (!date || weight === null) { skipped++; continue }

    rows.push({
      date,
      weight_kg: weight,
      bmi: bmiIdx !== -1 ? parseNum(cols[bmiIdx] || '') : null,
      body_fat_percent: fatIdx !== -1 ? parseNum(cols[fatIdx] || '') : null,
      muscle_mass_kg: muscleIdx !== -1 ? parseNum(cols[muscleIdx] || '') : null,
      bone_mass_kg: boneIdx !== -1 ? parseNum(cols[boneIdx] || '') : null,
      water_percent: waterIdx !== -1 ? parseNum(cols[waterIdx] || '') : null,
      visceral_fat: visceralIdx !== -1 ? parseIntVal(cols[visceralIdx] || '') : null,
    })
  }

  if (skipped > 0) warnings.push(`Пропущено ${skipped} строк с неполными данными`)
  if (rows.length === 0) throw new Error('Не удалось распознать данные. Проверьте формат файла.')

  // Deduplicate by date — keep last entry per date
  const byDate = new Map<string, ParsedRow>()
  for (const r of rows) byDate.set(r.date, r)
  const deduped = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  return { rows: deduped, warnings }
}

// ─── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type Step = 'idle' | 'preview' | 'saving' | 'done' | 'error'

const STEPS = [
  { n: 1, text: 'Откройте Mi Fitness и перейдите в Профиль' },
  { n: 2, text: 'Нажмите на шестерёнку (Настройки) в правом верхнем углу' },
  { n: 3, text: 'Выберите «Экспорт данных»' },
  { n: 4, text: 'Выберите «Вес и состав тела» → «Экспортировать»' },
  { n: 5, text: 'Перенесите CSV-файл на этот экран' },
]

export default function ImportPage() {
  const [step, setStep] = useState<Step>('idle')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [parseError, setParseError] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [showAllPreview, setShowAllPreview] = useState(false)
  const [existingData, setExistingData] = useState<BodyMeasurement[]>([])
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [activeMetric, setActiveMetric] = useState<'weight' | 'fat' | 'muscle'>('weight')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadExisting() }, [])

  async function loadExisting() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('body_measurements').select('*')
      .eq('user_id', user.id).order('date', { ascending: true })
    if (data) setExistingData(data)
    setLoadingExisting(false)
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && !file.type.includes('comma')) {
      setParseError('Выберите файл в формате CSV')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const { rows, warnings } = parseMiFitnessCSV(text)
        setParsedRows(rows)
        setWarnings(warnings)
        setParseError('')
        setStep('preview')
      } catch (err: any) {
        setParseError(err.message || 'Ошибка разбора файла')
        setStep('error')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [])

  async function handleImport() {
    setStep('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const records = parsedRows.map(r => ({ ...r, user_id: user.id }))

    // Upsert in batches of 200
    let saved = 0
    for (let i = 0; i < records.length; i += 200) {
      const batch = records.slice(i, i + 200)
      const { error } = await supabase.from('body_measurements')
        .upsert(batch, { onConflict: 'user_id,date' })
      if (error) { setParseError(error.message); setStep('error'); return }
      saved += batch.length
    }

    setSavedCount(saved)
    setStep('done')
    await loadExisting()
  }

  function resetImport() {
    setStep('idle')
    setParsedRows([])
    setWarnings([])
    setParseError('')
    setShowAllPreview(false)
  }

  // Chart data from existing measurements
  const chartData = existingData
    .filter(m => m.weight_kg)
    .map(m => ({
      date: format(parseISO(m.date), 'd MMM', { locale: ru }),
      'Вес (кг)': m.weight_kg,
      'Жир (%)': m.body_fat_percent,
      'Мышцы (кг)': m.muscle_mass_kg,
    }))

  const hasChart = chartData.length >= 2

  const previewRows = showAllPreview ? parsedRows : parsedRows.slice(0, 5)
  const hasFat = parsedRows.some(r => r.body_fat_percent !== null)
  const hasMuscle = parsedRows.some(r => r.muscle_mass_kg !== null)

  // Summary stats for preview
  const weights = parsedRows.map(r => r.weight_kg).filter(Boolean) as number[]
  const minW = weights.length ? Math.min(...weights).toFixed(1) : null
  const maxW = weights.length ? Math.max(...weights).toFixed(1) : null

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Импорт данных</h1>
        <p className="text-gray-500 text-sm mt-1">Загрузите данные о весе и составе тела из Mi Fitness</p>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500/15 rounded-lg flex items-center justify-center">
              <FileText size={14} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Как экспортировать данные из Mi Fitness</h2>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {STEPS.map(({ n, text }) => (
            <div key={n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#FF6B35]/15 border border-[#FF6B35]/25 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-[#FF6B35]">{n}</span>
              </div>
              <p className="text-sm text-gray-300">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] text-xs text-gray-500">
          💡 Поддерживаются файлы в формате CSV. Кодировка UTF-8, разделители: запятая или точка с запятой.
        </div>
      </Card>

      {/* Upload zone */}
      {(step === 'idle' || step === 'error') && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#FF6B35] bg-[#FF6B35]/5'
              : 'border-[#333] hover:border-[#FF6B35]/50 hover:bg-white/[0.02]'
          }`}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
          <div className="w-14 h-14 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload size={24} className={isDragging ? 'text-[#FF6B35]' : 'text-gray-500'} />
          </div>
          <p className="text-white font-semibold">Перетащите CSV-файл сюда</p>
          <p className="text-gray-500 text-sm mt-1">или нажмите для выбора файла</p>
          <p className="text-gray-600 text-xs mt-3">Поддерживается экспорт из Mi Fitness · Xiaomi Health</p>
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold text-sm">Ошибка разбора файла</p>
            <p className="text-red-400/80 text-sm mt-0.5">{parseError}</p>
            <button onClick={resetImport} className="text-xs text-red-400 underline mt-2">Попробовать другой файл</button>
          </div>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && (
        <>
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
              <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {warnings.map((w, i) => <p key={i} className="text-yellow-400 text-sm">{w}</p>)}
              </div>
            </div>
          )}

          {/* Summary */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-white">Предпросмотр</h2>
              <Badge variant="orange">{parsedRows.length} записей</Badge>
            </CardHeader>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-[#FF6B35]">{parsedRows.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Измерений</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{minW} – {maxW}</div>
                <div className="text-xs text-gray-500 mt-0.5">Диапазон веса (кг)</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">
                  {format(parseISO(parsedRows[0].date), 'MMM yy', { locale: ru })}
                  {' — '}
                  {format(parseISO(parsedRows[parsedRows.length - 1].date), 'MMM yy', { locale: ru })}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Период</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-[#222]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#222] bg-[#161616]">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Дата</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Вес, кг</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">ИМТ</th>
                    {hasFat && <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Жир, %</th>}
                    {hasMuscle && <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Мышцы, кг</th>}
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Вода, %</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-[#1A1A1A] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 text-gray-300">
                        {format(parseISO(row.date), 'd MMM yyyy', { locale: ru })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-white">{row.weight_kg ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-400">{row.bmi ?? '—'}</td>
                      {hasFat && <td className="px-3 py-2.5 text-right text-gray-400">{row.body_fat_percent ?? '—'}</td>}
                      {hasMuscle && <td className="px-3 py-2.5 text-right text-gray-400">{row.muscle_mass_kg ?? '—'}</td>}
                      <td className="px-3 py-2.5 text-right text-gray-400">{row.water_percent ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedRows.length > 5 && (
              <button
                onClick={() => setShowAllPreview(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mt-3 transition-colors"
              >
                {showAllPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAllPreview ? 'Свернуть' : `Показать все ${parsedRows.length} записей`}
              </button>
            )}
          </Card>

          <div className="flex gap-3">
            <Button size="lg" className="flex-1" onClick={handleImport}>
              Импортировать {parsedRows.length} записей
            </Button>
            <Button variant="secondary" size="lg" onClick={resetImport}>
              Отмена
            </Button>
          </div>
        </>
      )}

      {/* Saving spinner */}
      {step === 'saving' && (
        <Card className="text-center py-10">
          <div className="w-12 h-12 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">Сохранение данных...</p>
          <p className="text-gray-500 text-sm mt-1">Пожалуйста, подождите</p>
        </Card>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
          <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-green-400 font-semibold text-sm">Импорт завершён</p>
            <p className="text-green-400/80 text-sm mt-0.5">
              Сохранено {savedCount} записей. Повторный импорт обновит существующие данные за те же даты.
            </p>
            <button onClick={resetImport} className="text-xs text-green-400 underline mt-2">Загрузить ещё один файл</button>
          </div>
        </div>
      )}

      {/* Chart of existing data */}
      {!loadingExisting && hasChart && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-[#FF6B35]" />
              <h2 className="text-sm font-semibold text-white">Динамика показателей</h2>
            </div>
            <Badge variant="gray">{existingData.length} измерений</Badge>
          </CardHeader>

          {/* Metric tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {([
              { key: 'weight', label: 'Вес' },
              ...(existingData.some(m => m.body_fat_percent) ? [{ key: 'fat', label: 'Жир %' }] : []),
              ...(existingData.some(m => m.muscle_mass_kg) ? [{ key: 'muscle', label: 'Мышцы' }] : []),
            ] as { key: typeof activeMetric; label: string }[]).map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeMetric === m.key
                    ? 'bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/25'
                    : 'text-gray-500 hover:text-gray-300 bg-[#1A1A1A]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              {activeMetric === 'weight' && (
                <Line type="monotone" dataKey="Вес (кг)" stroke="#FF6B35" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#FF6B35' }} />
              )}
              {activeMetric === 'fat' && (
                <Line type="monotone" dataKey="Жир (%)" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} />
              )}
              {activeMetric === 'muscle' && (
                <Line type="monotone" dataKey="Мышцы (кг)" stroke="#22C55E" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#22C55E' }} />
              )}
            </LineChart>
          </ResponsiveContainer>

          {/* Min/max stats */}
          {(() => {
            const key = activeMetric === 'weight' ? 'Вес (кг)' : activeMetric === 'fat' ? 'Жир (%)' : 'Мышцы (кг)'
            const vals = chartData.map(d => d[key as keyof typeof d] as number).filter(Boolean)
            if (!vals.length) return null
            const min = Math.min(...vals).toFixed(1)
            const max = Math.max(...vals).toFixed(1)
            const last = vals[vals.length - 1]?.toFixed(1)
            const first = vals[0]?.toFixed(1)
            const diff = (parseFloat(last) - parseFloat(first)).toFixed(1)
            return (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                  <div className="text-sm font-bold text-white">{last}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Последнее</div>
                </div>
                <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                  <div className={`text-sm font-bold ${parseFloat(diff) < 0 ? 'text-green-400' : parseFloat(diff) > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {parseFloat(diff) > 0 ? '+' : ''}{diff}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Изменение</div>
                </div>
                <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
                  <div className="text-sm font-bold text-gray-300">{min} – {max}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Диапазон</div>
                </div>
              </div>
            )
          })()}
        </Card>
      )}

      {!loadingExisting && !hasChart && step !== 'preview' && step !== 'saving' && (
        <Card className="text-center py-10 border-dashed">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-gray-500 text-sm">График появится после импорта данных</p>
        </Card>
      )}
    </div>
  )
}
