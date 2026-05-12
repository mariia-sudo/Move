'use client'

import { useEffect, useState } from 'react'
import { format, differenceInDays, addDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Heart, Plus, Calendar, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { CycleLog, CyclePhase } from '@/types/database'

const PHASES: Record<CyclePhase, {
  label: string
  days: string
  color: string
  bgColor: string
  description: string
  training: string[]
  avoid: string[]
}> = {
  menstrual: {
    label: 'Менструальная',
    days: 'Дни 1–5',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
    description: 'Организм обновляется. Уровень энергии может быть ниже — прислушивайтесь к себе.',
    training: ['Лёгкая йога или растяжка', 'Спокойные прогулки', 'Отдых при необходимости', 'Плавание в лёгком темпе'],
    avoid: ['Высокоинтенсивные интервалы', 'Тяжёлые подъёмы', 'Ударное кардио'],
  },
  follicular: {
    label: 'Фолликулярная',
    days: 'Дни 6–13',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-500/20',
    description: 'Эстроген растёт. Энергия, сила и настроение улучшаются — отличное время для интенсивных тренировок!',
    training: ['Силовые тренировки — время для рекордов', 'Высокоинтенсивные интервалы', 'Попробуйте новые виды активности', 'Длинные пробежки'],
    avoid: ['Пропускать тренировки — это ваше силовое окно'],
  },
  ovulatory: {
    label: 'Овуляторная',
    days: 'Дни 14–16',
    color: 'text-[#FF6B35]',
    bgColor: 'bg-[#FF6B35]/10 border-[#FF6B35]/20',
    description: 'Пик формы. Тестостерон на максимуме — максимальная сила и координация.',
    training: ['Максимальные усилия', 'Соревновательные виды (сквош, падел)', 'Силовые тренировки', 'Командные виды спорта'],
    avoid: ['Ничего — вы на пике!'],
  },
  luteal: {
    label: 'Лютеиновая',
    days: 'Дни 17–28',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    description: 'Прогестерон растёт, температура тела повышается. Сосредоточьтесь на стабильных тренировках.',
    training: ['Умеренное кардио', 'Пилатес или йога', 'Силовые в комфортном темпе', 'Плавание'],
    avoid: ['Максимальные усилия', 'Чрезмерный объём', 'Игнорировать сигналы усталости'],
  },
}

function getCurrentPhase(lastPeriod: string, cycleLength: number): { phase: CyclePhase; dayOfCycle: number; daysUntilNext: number } {
  const start = parseISO(lastPeriod)
  const today = new Date()
  const dayOfCycle = differenceInDays(today, start) + 1
  const adjustedDay = ((dayOfCycle - 1) % cycleLength) + 1
  const nextPeriod = addDays(start, Math.ceil(dayOfCycle / cycleLength) * cycleLength)
  const daysUntilNext = differenceInDays(nextPeriod, today)

  let phase: CyclePhase
  if (adjustedDay <= 5) phase = 'menstrual'
  else if (adjustedDay <= 13) phase = 'follicular'
  else if (adjustedDay <= 16) phase = 'ovulatory'
  else phase = 'luteal'

  return { phase, dayOfCycle: adjustedDay, daysUntilNext }
}

export default function CyclePage() {
  const [logs, setLogs] = useState<CycleLog[]>([])
  const [showForm, setShowForm] = useState(false)
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().split('T')[0])
  const [cycleLength, setCycleLength] = useState('28')
  const [periodLength, setPeriodLength] = useState('5')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('cycle_logs').select('*')
      .eq('user_id', user.id).order('period_start_date', { ascending: false }).limit(6)

    if (data) setLogs(data)
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('cycle_logs').insert({
      user_id: user.id,
      period_start_date: periodStart,
      cycle_length_days: parseInt(cycleLength),
      period_length_days: parseInt(periodLength),
    })

    if (err) { setError(err.message); setSaving(false); return }

    setShowForm(false)
    await loadLogs()
    setSaving(false)
  }

  const latestLog = logs[0]
  const phaseInfo = latestLog
    ? getCurrentPhase(latestLog.period_start_date, latestLog.cycle_length_days)
    : null
  const phase = phaseInfo ? PHASES[phaseInfo.phase] : null

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Цикл</h1>
          <p className="text-gray-500 text-sm mt-1">Рекомендации по тренировкам по фазам цикла</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} />
          Записать
        </Button>
      </div>

      {showForm && (
        <Card glow>
          <h2 className="text-sm font-semibold text-white mb-4">Новая запись</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Дата начала"
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Длина цикла (дней)"
                type="number"
                min="21"
                max="45"
                value={cycleLength}
                onChange={e => setCycleLength(e.target.value)}
                hint="Среднее: 28 дней"
              />
              <Input
                label="Длина менструации (дней)"
                type="number"
                min="2"
                max="10"
                value={periodLength}
                onChange={e => setPeriodLength(e.target.value)}
                hint="Среднее: 5 дней"
              />
            </div>
            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
            <div className="flex gap-2">
              <Button type="submit" loading={saving} className="flex-1">Сохранить</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Отмена</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="h-48 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />
      ) : phaseInfo && phase ? (
        <>
          <Card className={`border ${phase.bgColor}`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Heart size={20} className={phase.color} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-bold ${phase.color}`}>{phase.label} фаза</h2>
                  <Badge variant="gray" className="text-xs">{phase.days}</Badge>
                </div>
                <p className="text-sm text-gray-400 mt-1">{phase.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${phase.color}`}>День {phaseInfo.dayOfCycle}</div>
                <div className="text-xs text-gray-500 mt-0.5">цикла</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{phaseInfo.daysUntilNext}</div>
                <div className="text-xs text-gray-500 mt-0.5">дней до следующей</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex gap-1">
                {(['menstrual', 'follicular', 'ovulatory', 'luteal'] as CyclePhase[]).map(p => {
                  const colors = { menstrual: 'bg-red-500', follicular: 'bg-yellow-500', ovulatory: 'bg-[#FF6B35]', luteal: 'bg-purple-500' }
                  const widths = { menstrual: '18%', follicular: '32%', ovulatory: '12%', luteal: '38%' }
                  return (
                    <div
                      key={p}
                      className={`h-2 rounded-full transition-all ${colors[p]} ${phaseInfo.phase === p ? 'opacity-100' : 'opacity-20'}`}
                      style={{ width: widths[p] }}
                      title={PHASES[p].label}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>День 1</span>
                <span>День {latestLog.cycle_length_days}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-white">Лучшие тренировки сейчас</h2>
            </CardHeader>
            <div className="space-y-2">
              {phase.training.map((t, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <div className="w-4 h-4 bg-green-500/15 rounded-full flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  </div>
                  {t}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[#222]">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Лучше избегать</h3>
              <div className="space-y-2">
                {phase.avoid.map((t, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-gray-500">
                    <div className="w-4 h-4 bg-red-500/10 rounded-full flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    </div>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-white">Обзор цикла</h2>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PHASES) as [CyclePhase, typeof PHASES[CyclePhase]][]).map(([key, p]) => (
                <div
                  key={key}
                  className={`p-3 rounded-xl border text-sm ${phaseInfo.phase === key ? p.bgColor : 'bg-[#1A1A1A] border-[#2A2A2A]'}`}
                >
                  <div className={`font-semibold mb-0.5 ${phaseInfo.phase === key ? p.color : 'text-gray-400'}`}>
                    {p.label}
                  </div>
                  <div className="text-xs text-gray-600">{p.days}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : !loading && (
        <Card className="text-center py-12">
          <div className="w-14 h-14 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart size={28} className="text-pink-400" />
          </div>
          <h2 className="text-white font-semibold mb-2">Отслеживайте цикл</h2>
          <p className="text-gray-500 text-sm mb-4">
            Запишите менструацию, чтобы получать персональные рекомендации по тренировкам.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Записать первую
          </Button>
        </Card>
      )}

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">История</h2>
          </CardHeader>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-[#1A1A1A] last:border-0">
                <div className="flex items-center gap-2.5">
                  <Calendar size={14} className="text-gray-600" />
                  <span className="text-sm text-gray-300">
                    {format(parseISO(log.period_start_date), 'd MMMM yyyy', { locale: ru })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="gray">{log.cycle_length_days} дн.</Badge>
                  <Badge variant="gray">{log.period_length_days} дн.</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-start gap-2 text-xs text-gray-600 bg-[#1A1A1A] rounded-xl p-3">
        <Info size={13} className="shrink-0 mt-0.5" />
        <p>Данные цикла приватны и надёжно защищены. Рекомендации — общие советы по здоровью, не медицинская консультация.</p>
      </div>
    </div>
  )
}
