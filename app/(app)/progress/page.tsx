'use client'

import { useEffect, useState } from 'react'
import { format, subMonths, eachWeekOfInterval, endOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Workout, WorkoutCardio, WorkoutSet } from '@/types/database'

const SPORT_CONFIG = {
  weightlifting: { emoji: '🏋️', label: 'Силовые', color: '#FF6B35' },
  running: { emoji: '🏃', label: 'Бег', color: '#3B82F6' },
  squash: { emoji: '🎾', label: 'Сквош', color: '#22C55E' },
  padel: { emoji: '🏓', label: 'Падель', color: '#A855F7' },
}

const PIE_COLORS = ['#FF6B35', '#3B82F6', '#22C55E', '#A855F7']

interface TooltipEntry { name: string; value: number | string; color: string }
interface TooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string }

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#333] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function ProgressPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [cardioData, setCardioData] = useState<(WorkoutCardio & { date: string })[]>([])
  const [setsData, setSetsData] = useState<(WorkoutSet & { date: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd')

      const workoutsRes = await supabase.from('workouts').select('*').eq('user_id', user.id)
        .gte('date', sixMonthsAgo).order('date', { ascending: true })

      if (workoutsRes.data) setWorkouts(workoutsRes.data)

      if (workoutsRes.data) {
        const runIds = workoutsRes.data.filter(w => w.sport_type === 'running').map(w => w.id)
        if (runIds.length > 0) {
          const cardioRes = await supabase.from('workout_cardio').select('*').in('workout_id', runIds)
          if (cardioRes.data) {
            const enriched = cardioRes.data.map(c => ({
              ...c,
              date: workoutsRes.data!.find(w => w.id === c.workout_id)?.date || '',
            }))
            setCardioData(enriched)
          }
        }

        const liftIds = workoutsRes.data.filter(w => w.sport_type === 'weightlifting').map(w => w.id)
        if (liftIds.length > 0) {
          const setsRes = await supabase.from('workout_sets').select('*').in('workout_id', liftIds)
          if (setsRes.data) {
            const enriched = setsRes.data.map(s => ({
              ...s,
              date: workoutsRes.data!.find(w => w.id === s.workout_id)?.date || '',
            }))
            setSetsData(enriched)
          }
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const weeklyData = (() => {
    const weeks = eachWeekOfInterval(
      { start: subMonths(new Date(), 3), end: new Date() },
      { weekStartsOn: 1 }
    ).slice(-12)

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      const weekWorkouts = workouts.filter(w => {
        const d = new Date(w.date + 'T00:00:00')
        return d >= weekStart && d <= weekEnd
      })
      return {
        week: format(weekStart, 'd MMM', { locale: ru }),
        total: weekWorkouts.length,
        weightlifting: weekWorkouts.filter(w => w.sport_type === 'weightlifting').length,
        running: weekWorkouts.filter(w => w.sport_type === 'running').length,
        squash: weekWorkouts.filter(w => w.sport_type === 'squash').length,
        padel: weekWorkouts.filter(w => w.sport_type === 'padel').length,
      }
    })
  })()

  const sportDist = Object.entries(SPORT_CONFIG).map(([sport, cfg]) => ({
    name: cfg.label,
    value: workouts.filter(w => w.sport_type === sport).length,
    emoji: cfg.emoji,
  })).filter(s => s.value > 0)

  const paceTrend = cardioData
    .filter(c => c.avg_pace_per_km)
    .map(c => ({
      date: format(new Date(c.date + 'T00:00:00'), 'd MMM', { locale: ru }),
      pace: +(c.avg_pace_per_km! / 60).toFixed(2),
      km: +c.distance_km.toFixed(2),
    }))
    .slice(-10)

  const liftVolume = workouts
    .filter(w => w.sport_type === 'weightlifting')
    .map(w => {
      const wSets = setsData.filter(s => s.date === w.date)
      const vol = wSets.reduce((sum, s) => sum + (s.weight_kg || 0) * s.sets * s.reps, 0)
      return { date: format(new Date(w.date + 'T00:00:00'), 'd MMM', { locale: ru }), volume: Math.round(vol) }
    }).slice(-10)

  const totalSessions = workouts.length
  const totalKm = cardioData.reduce((sum, c) => sum + c.distance_km, 0)
  const avgPace = cardioData.filter(c => c.avg_pace_per_km).length > 0
    ? cardioData.filter(c => c.avg_pace_per_km).reduce((sum, c) => sum + c.avg_pace_per_km!, 0) /
      cardioData.filter(c => c.avg_pace_per_km).length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Прогресс</h1>
        <p className="text-gray-500 text-sm mt-1">Последние 6 месяцев тренировок</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-[#FF6B35]">{totalSessions}</div>
          <div className="text-xs text-gray-500 mt-1">Всего сессий</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-blue-400">{totalKm.toFixed(0)} км</div>
          <div className="text-xs text-gray-500 mt-1">Общая дистанция</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-white">
            {avgPace > 0 ? `${Math.floor(avgPace / 60)}:${Math.round(avgPace % 60).toString().padStart(2, '0')}` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Средний темп /км</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-green-400">
            {workouts.filter(w => w.sport_type === 'squash' || w.sport_type === 'padel').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Ракеточные виды</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-white">Тренировки по неделям</h2>
          <Badge variant="gray">12 недель</Badge>
        </CardHeader>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gray-600">Загрузка...</div>
        ) : weeklyData.some(w => w.total > 0) ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="weightlifting" stackId="a" fill="#FF6B35" name="Силовые" radius={[0, 0, 0, 0]} />
              <Bar dataKey="running" stackId="a" fill="#3B82F6" name="Бег" />
              <Bar dataKey="squash" stackId="a" fill="#22C55E" name="Сквош" />
              <Bar dataKey="padel" stackId="a" fill="#A855F7" name="Падель" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
            Запишите тренировки, чтобы увидеть график частоты
          </div>
        )}
        <div className="flex gap-4 mt-3 justify-center flex-wrap">
          {Object.entries(SPORT_CONFIG).map(([sport, cfg]) => (
            <div key={sport} className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} />
              {cfg.label}
            </div>
          ))}
        </div>
      </Card>

      {sportDist.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">По видам спорта</h2>
          </CardHeader>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={sportDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {sportDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {sportDist.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm text-gray-300">{s.emoji} {s.name}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {paceTrend.length > 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">Динамика темпа бега</h2>
            <Badge variant="blue">мин/км</Badge>
          </CardHeader>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={paceTrend} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} domain={['dataMax + 0.5', 'dataMin - 0.5']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="pace" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} name="Темп (мин/км)" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-600 mt-2">Чем ниже, тем быстрее.</p>
        </Card>
      )}

      {liftVolume.filter(v => v.volume > 0).length > 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">Объём силовых</h2>
            <Badge variant="orange">кг · повт</Badge>
          </CardHeader>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={liftVolume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="volume" fill="#FF6B35" radius={[4, 4, 0, 0]} name="Объём" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {workouts.length === 0 && !loading && (
        <Card className="text-center py-12">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-white font-semibold mb-1">Данных пока нет</div>
          <p className="text-gray-500 text-sm">Запишите тренировки, чтобы увидеть графики прогресса</p>
        </Card>
      )}
    </div>
  )
}
