'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, isThisWeek, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { TrendingUp, Flame, Calendar, ChevronRight, Zap, Target, Wine, Cigarette, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Workout, Profile } from '@/types/database'
import { SPORT_CONFIG, type SportType } from '@/lib/sports'

type LifestyleHabits = Pick<Profile, 'smoking' | 'alcohol' | 'sleep_quality' | 'stress_level' | 'water_intake'>
type LogType = 'alcohol' | 'smoking'

function getAIRecommendation(
  workouts: Workout[],
  habits?: LifestyleHabits | null,
  recentLogTypes?: LogType[],
): string[] {
  const tips: string[] = []

  // ── Recent daily-log tips (highest priority) ──
  if (recentLogTypes?.includes('alcohol')) {
    tips.push('Алкоголь замедляет восстановление мышц на 48ч — рекомендуем лёгкую тренировку сегодня.')
  }

  // ── Lifestyle-habit tips ──
  if (habits?.sleep_quality === 'under6') {
    tips.push('Восстановление важнее интенсивности сегодня — недосыпание снижает силу и реакцию.')
  }
  if (habits?.smoking === 'sometimes' || habits?.smoking === 'regularly') {
    tips.push('Кардио особенно важно для здоровья лёгких — регулярные пробежки помогают восстановить объём.')
  }
  if (habits?.stress_level === 'high') {
    tips.push('Высокий стресс? Рекомендуем йогу или лёгкую растяжку после тренировки.')
  }
  if (habits?.water_intake === 'under1l') {
    tips.push('Пейте больше воды — обезвоживание снижает силу и выносливость на 10–20%.')
  }

  // ── Workout-based tips ──
  if (tips.length < 2) {
    const thisWeek = workouts.filter(w => isThisWeek(new Date(w.date), { weekStartsOn: 1 }))
    const sports = thisWeek.map(w => w.sport_type)
    if (thisWeek.length === 0) {
      tips.push('Начните неделю активно — запишите первую тренировку сегодня!')
    } else {
      if (!sports.includes('running'))       tips.push('Добавьте кардио для улучшения выносливости и восстановления.')
      if (!sports.includes('weightlifting')) tips.push('Силовые тренировки — основа для всех видов спорта.')
      if (thisWeek.length >= 4)              tips.push('Отличная неделя! Обязательно включите хотя бы один день отдыха.')
    }
  }

  if (tips.length === 0) tips.push('Оставайтесь последовательны и доверяйте процессу. Прогресс есть!')
  return tips.slice(0, 3)
}

function computeStreak(ws: Workout[]): number {
    if (!ws.length) return 0
    const dates = [...new Set(ws.map(w => w.date))].sort().reverse()
    let s = 0
    const today = format(new Date(), 'yyyy-MM-dd')
    let expected = today
    for (const d of dates) {
      if (d === expected) {
        s++
        const prev = new Date(expected)
        prev.setDate(prev.getDate() - 1)
        expected = format(prev, 'yyyy-MM-dd')
      } else break
    }
    return s
}

export default function DashboardPage() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const [habits, setHabits] = useState<LifestyleHabits | null>(null)
  // today's logged types: { alcohol: bool, smoking: bool }
  const [todayLogs, setTodayLogs] = useState<Record<LogType, boolean>>({ alcohol: false, smoking: false })
  const [recentLogTypes, setRecentLogTypes] = useState<LogType[]>([])
  const [loggingType, setLoggingType] = useState<LogType | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, workoutsRes, logsRes] = await Promise.all([
        supabase.from('profiles')
          .select('full_name, gender, age, weight_kg, height_cm, smoking, alcohol, sleep_quality, stress_level, water_intake')
          .eq('id', user.id).single(),
        supabase.from('workouts').select('*').eq('user_id', user.id)
          .order('date', { ascending: false }).limit(20),
        supabase.from('daily_logs').select('date, type')
          .eq('user_id', user.id)
          .gte('date', yesterday),
      ])

      if (profileRes.data) {
        if (profileRes.data.full_name) {
          setUserName(profileRes.data.full_name.split(' ')[0])
        }
        const { gender, age, weight_kg, height_cm } = profileRes.data
        if (!gender || !age || !weight_kg || !height_cm) {
          router.replace('/profile/setup')
          return
        }
        const { smoking, alcohol, sleep_quality, stress_level, water_intake } = profileRes.data
        setHabits({ smoking, alcohol, sleep_quality, stress_level, water_intake })
      }

      if (logsRes.data) {
        const todayEntries = logsRes.data.filter(l => l.date === today)
        setTodayLogs({
          alcohol: todayEntries.some(l => l.type === 'alcohol'),
          smoking: todayEntries.some(l => l.type === 'smoking'),
        })
        // Recent = yesterday OR today → drives AI tip
        const recent = logsRes.data.map(l => l.type) as LogType[]
        setRecentLogTypes([...new Set(recent)])
      }

      if (workoutsRes.data) {
        setWorkouts(workoutsRes.data)
        setStreak(computeStreak(workoutsRes.data))
      }
      setLoading(false)
    }
    load()
  }, [router, today, yesterday])

  async function toggleLog(type: LogType) {
    setLoggingType(type)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoggingType(null); return }

    if (todayLogs[type]) {
      // Unlog — delete today's entry
      await supabase.from('daily_logs')
        .delete().eq('user_id', user.id).eq('date', today).eq('type', type)
      setTodayLogs(prev => ({ ...prev, [type]: false }))
      setRecentLogTypes(prev => prev.filter(t => t !== type))
    } else {
      // Log — upsert (safe if already exists)
      await supabase.from('daily_logs')
        .upsert({ user_id: user.id, date: today, type }, { onConflict: 'user_id,date,type' })
      setTodayLogs(prev => ({ ...prev, [type]: true }))
      if (!recentLogTypes.includes(type)) setRecentLogTypes(prev => [...prev, type])
    }
    setLoggingType(null)
  }

  const thisWeekWorkouts = workouts.filter(w =>
    isThisWeek(new Date(w.date), { weekStartsOn: 1 })
  )
  const recentWorkouts = workouts.slice(0, 5)
  const tips = getAIRecommendation(workouts, habits, recentLogTypes)

  const sportCounts = workouts.reduce((acc, w) => {
    acc[w.sport_type] = (acc[w.sport_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Доброе утро'
    if (h < 17) return 'Добрый день'
    return 'Добрый вечер'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting()}{userName ? `, ${userName}` : ''} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 bg-[#FF6B35]/10 border border-[#FF6B35]/20 rounded-xl px-3 py-2">
            <Flame size={18} className="text-[#FF6B35]" />
            <span className="text-[#FF6B35] font-bold text-sm">{streak}д</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-white">{workouts.length}</div>
          <div className="text-xs text-gray-500 mt-1">Тренировок</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-[#FF6B35]">{thisWeekWorkouts.length}</div>
          <div className="text-xs text-gray-500 mt-1">На этой неделе</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-white">{streak}</div>
          <div className="text-xs text-gray-500 mt-1">Дней подряд</div>
        </Card>
      </div>

      {/* Log workout */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Записать тренировку</h2>
        <Link
          href="/workout"
          className="flex items-center justify-between bg-[#111] border border-[#222] hover:border-[#FF6B35]/30 hover:bg-[#FF6B35]/5 rounded-2xl p-4 transition-all group mb-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏃</span>
            <div>
              <div className="text-sm font-semibold text-white group-hover:text-[#FF6B35] transition-colors">Выбрать вид спорта</div>
              <div className="text-xs text-gray-500">14 видов спорта</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-600 group-hover:text-[#FF6B35] transition-colors" />
        </Link>
        {/* Quick-access recent sports */}
        {Object.keys(sportCounts).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(sportCounts) as [SportType, number][])
              .sort((a, b) => b[1] - a[1]).slice(0, 4)
              .map(([sport, count]) => {
                const cfg = SPORT_CONFIG[sport]
                if (!cfg) return null
                return (
                  <Link
                    key={sport}
                    href={`/workout/${sport}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#FF6B35]/30 rounded-xl text-xs font-medium text-gray-400 hover:text-[#FF6B35] transition-all"
                  >
                    <span>{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                    <span className="text-gray-600">{count}</span>
                  </Link>
                )
              })}
          </div>
        )}
      </div>

      {/* Daily habit log */}
      <Card>
        <h2 className="text-sm font-semibold text-white mb-3">Отметить за сегодня</h2>
        <div className="grid grid-cols-2 gap-2">
          {([
            { type: 'alcohol' as LogType, icon: Wine,      label: 'Алкоголь',  activeClass: 'bg-purple-500/15 border-purple-500/30 text-purple-300' },
            { type: 'smoking' as LogType, icon: Cigarette, label: 'Курение',   activeClass: 'bg-orange-500/15 border-orange-500/30 text-orange-300' },
          ]).map(({ type, icon: Icon, label, activeClass }) => (
            <button
              key={type}
              onClick={() => toggleLog(type)}
              disabled={loggingType === type}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-sm font-semibold transition-all disabled:opacity-60 ${
                todayLogs[type]
                  ? activeClass
                  : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-[#444] hover:text-gray-200'
              }`}
            >
              {todayLogs[type]
                ? <Check size={16} />
                : <Icon size={16} />
              }
              <span className="truncate">{label}</span>
              {todayLogs[type] && <span className="ml-auto text-[10px] opacity-60">сегодня</span>}
            </button>
          ))}
        </div>
        {(todayLogs.alcohol || todayLogs.smoking) && (
          <p className="text-xs text-gray-600 mt-2">
            Нажмите ещё раз, чтобы снять отметку
          </p>
        )}
      </Card>

      {/* AI Recommendations */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-[#FF6B35]/15 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-[#FF6B35]" />
          </div>
          <h2 className="text-sm font-semibold text-white">Умные рекомендации</h2>
        </div>
        <div className="space-y-2">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
              <Target size={14} className="text-[#FF6B35] mt-0.5 shrink-0" />
              {tip}
            </div>
          ))}
        </div>
      </Card>

      {/* This week summary */}
      {thisWeekWorkouts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Эта неделя</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, i) => {
              const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
              const dayDate = new Date(weekStart)
              dayDate.setDate(weekStart.getDate() + i)
              const dateStr = format(dayDate, 'yyyy-MM-dd')
              const hasWorkout = thisWeekWorkouts.some(w => w.date === dateStr)
              const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr
              return (
                <div key={day} className="flex flex-col items-center gap-1.5 min-w-[40px]">
                  <div className="text-xs text-gray-600">{day}</div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    hasWorkout
                      ? 'bg-[#FF6B35] text-white'
                      : isToday
                        ? 'border-2 border-[#FF6B35]/40 text-gray-500'
                        : 'bg-[#1A1A1A] text-gray-600'
                  }`}>
                    {dayDate.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent workouts */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : recentWorkouts.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Недавние тренировки</h2>
            <Link href="/progress" className="text-xs text-[#FF6B35] hover:text-[#FF8C5A] flex items-center gap-1">
              Все <TrendingUp size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentWorkouts.map(workout => {
              const cfg = SPORT_CONFIG[workout.sport_type]
              return (
                <div key={workout.id} className="flex items-center gap-4 bg-[#111] border border-[#222] rounded-2xl p-4">
                  <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-xl shrink-0">
                    {cfg.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{cfg.label}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Calendar size={11} />
                      {format(new Date(workout.date + 'T00:00:00'), 'd MMM yyyy', { locale: ru })}
                      {workout.duration_minutes && ` · ${workout.duration_minutes} мин`}
                    </div>
                  </div>
                  <Badge variant={cfg.color}>{cfg.label}</Badge>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <Card className="text-center py-10">
          <div className="text-4xl mb-3">🏃</div>
          <div className="text-white font-semibold mb-1">Тренировок пока нет</div>
          <p className="text-gray-500 text-sm">Запишите первую тренировку, чтобы начать!</p>
        </Card>
      )}
    </div>
  )
}
