'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, isThisWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { TrendingUp, Flame, Calendar, ChevronRight, Zap, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Workout, Profile } from '@/types/database'

const SPORT_CONFIG = {
  weightlifting: { emoji: '🏋️', label: 'Силовые', color: 'orange' as const, href: '/workout/weightlifting' },
  running: { emoji: '🏃', label: 'Бег', color: 'blue' as const, href: '/workout/running' },
  squash: { emoji: '🎾', label: 'Сквош', color: 'green' as const, href: '/workout/squash' },
  padel: { emoji: '🏓', label: 'Падель', color: 'purple' as const, href: '/workout/padel' },
}

type LifestyleHabits = Pick<Profile, 'smoking' | 'alcohol' | 'sleep_quality' | 'stress_level' | 'water_intake'>

function getAIRecommendation(workouts: Workout[], habits?: LifestyleHabits | null): string[] {
  const tips: string[] = []

  // ── Lifestyle-based tips (highest priority) ──
  if (habits?.sleep_quality === 'under6') {
    tips.push('Восстановление важнее интенсивности сегодня — недосыпание снижает силу и скорость реакции.')
  }
  if (habits?.smoking === 'sometimes' || habits?.smoking === 'regularly') {
    tips.push('Кардио особенно важно для здоровья лёгких — регулярные пробежки помогают восстановить объём.')
  }
  if (habits?.stress_level === 'high') {
    tips.push('Высокий стресс? Рекомендуем йогу или лёгкую растяжку после тренировки для восстановления.')
  }
  if (habits?.alcohol === 'regularly') {
    tips.push('Алкоголь замедляет восстановление мышц на 48 часов — учитывайте это при планировании нагрузок.')
  }
  if (habits?.water_intake === 'under1l') {
    tips.push('Пейте больше воды! Обезвоживание снижает силу и выносливость на 10–20%.')
  }

  // ── Workout-based tips ──
  const thisWeek = workouts.filter(w => isThisWeek(new Date(w.date), { weekStartsOn: 1 }))
  const sports = thisWeek.map(w => w.sport_type)

  if (tips.length < 2) {
    if (thisWeek.length === 0) {
      tips.push('Начните неделю активно — запишите первую тренировку сегодня!')
      tips.push('Постоянство важнее интенсивности. Даже 20 минут — это уже результат.')
    } else {
      if (!sports.includes('running'))       tips.push('Добавьте кардио для улучшения выносливости и восстановления.')
      if (!sports.includes('weightlifting')) tips.push('Силовые тренировки — основа для всех видов спорта.')
      if (thisWeek.length >= 4)              tips.push('Отличная неделя! Обязательно включите хотя бы один день отдыха.')
      if (sports.filter(s => s === 'running').length >= 2)
                                             tips.push('Варьируйте интенсивность бега — чередуйте лёгкие пробежки с интервалами.')
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

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, workoutsRes] = await Promise.all([
        supabase.from('profiles')
          .select('full_name, gender, age, weight_kg, height_cm, smoking, alcohol, sleep_quality, stress_level, water_intake')
          .eq('id', user.id).single(),
        supabase.from('workouts').select('*').eq('user_id', user.id)
          .order('date', { ascending: false }).limit(20),
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
      if (workoutsRes.data) {
        setWorkouts(workoutsRes.data)
        setStreak(computeStreak(workoutsRes.data))
      }
      setLoading(false)
    }
    load()
  }, [router])

  const thisWeekWorkouts = workouts.filter(w =>
    isThisWeek(new Date(w.date), { weekStartsOn: 1 })
  )
  const recentWorkouts = workouts.slice(0, 5)
  const tips = getAIRecommendation(workouts, habits)

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
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SPORT_CONFIG).map(([sport, cfg]) => (
            <Link
              key={sport}
              href={cfg.href}
              className="flex items-center gap-3 bg-[#111] border border-[#222] hover:border-[#FF6B35]/30 hover:bg-[#FF6B35]/5 rounded-2xl p-4 transition-all group"
            >
              <span className="text-2xl">{cfg.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white group-hover:text-[#FF6B35] transition-colors">{cfg.label}</div>
                {sportCounts[sport] && (
                  <div className="text-xs text-gray-600">{sportCounts[sport]} занятий</div>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-600 group-hover:text-[#FF6B35] transition-colors" />
            </Link>
          ))}
        </div>
      </div>

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
