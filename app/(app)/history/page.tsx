'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar, ChevronRight, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SPORT_CONFIG, ALL_SPORTS, type SportType } from '@/lib/sports'

const MOOD_EMOJI: Record<string, string> = {
  tired: '😴', good: '😊', great: '💪', overtrained: '😤',
}

type SportFilter = 'all' | SportType

interface WorkoutRow {
  id: string
  sport_type: SportType
  date: string
  duration_minutes: number | null
  notes: string | null
  workout_feedback: { mood: string | null; energy_level: number | null }[] | null
}

const PAGE_SIZE = 25

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([])
  const [filter, setFilter] = useState<SportFilter>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    setWorkouts([])
    setPage(0)
    loadWorkouts(0, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function loadWorkouts(pageNum: number, reset = false) {
    if (pageNum === 0) setLoading(true); else setLoadingMore(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query = supabase
      .from('workouts')
      .select('id, sport_type, date, duration_minutes, notes, workout_feedback(mood, energy_level)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (filter !== 'all') query = query.eq('sport_type', filter)

    const { data } = await query
    const rows = (data ?? []) as WorkoutRow[]

    setWorkouts(prev => reset ? rows : [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadWorkouts(next)
  }

  // Group by month
  const grouped: { month: string; items: WorkoutRow[] }[] = []
  for (const w of workouts) {
    const month = format(parseISO(w.date), 'LLLL yyyy', { locale: ru })
    const last = grouped[grouped.length - 1]
    if (last?.month === month) last.items.push(w)
    else grouped.push({ month, items: [w] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">История тренировок</h1>
        <p className="text-gray-500 text-sm mt-1">
          {workouts.length > 0 ? `${workouts.length}${hasMore ? '+' : ''} тренировок` : ''}
        </p>
      </div>

      {/* Sport filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {([
          { value: 'all' as SportFilter, label: 'Все', emoji: null },
          ...ALL_SPORTS.map(s => ({ value: s as SportFilter, label: SPORT_CONFIG[s].label, emoji: SPORT_CONFIG[s].emoji })),
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap border transition-all ${
              filter === opt.value
                ? 'bg-[#FF6B35]/15 border-[#FF6B35]/35 text-[#FF6B35]'
                : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-[#444]'
            }`}
          >
            {opt.emoji && <span>{opt.emoji}</span>}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Grouped workout list */}
      {!loading && grouped.length === 0 && (
        <Card className="text-center py-12">
          <div className="text-4xl mb-3">🏃</div>
          <div className="text-white font-semibold mb-1">Нет тренировок</div>
          <p className="text-gray-500 text-sm">
            {filter === 'all' ? 'Запишите первую тренировку!' : 'Нет тренировок этого типа'}
          </p>
        </Card>
      )}

      {!loading && grouped.map(({ month, items }) => (
        <div key={month}>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 capitalize">
            {month}
          </h2>
          <div className="space-y-2">
            {items.map(w => {
              const cfg = SPORT_CONFIG[w.sport_type]
              const fb = w.workout_feedback?.[0]
              return (
                <Link
                  key={w.id}
                  href={`/history/${w.id}`}
                  className="flex items-center gap-3 bg-[#111] border border-[#222] hover:border-[#333] rounded-2xl px-4 py-3 transition-all group"
                >
                  <div className="w-9 h-9 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-lg shrink-0">
                    {cfg.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{cfg.label}</span>
                      {fb?.mood && (
                        <span className="text-base" title={fb.mood}>{MOOD_EMOJI[fb.mood]}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <Calendar size={11} />
                      <span>{format(parseISO(w.date), 'd MMM', { locale: ru })}</span>
                      {w.duration_minutes && (
                        <><span className="text-gray-700">·</span><span>{w.duration_minutes} мин</span></>
                      )}
                      {fb?.energy_level && (
                        <><span className="text-gray-700">·</span>
                        <span className="text-[#FF6B35]">⚡{fb.energy_level}</span></>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={cfg.color} className="hidden sm:inline-flex">{cfg.label}</Badge>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasMore && !loading && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-3 rounded-2xl border border-dashed border-[#333] hover:border-[#444] text-gray-500 hover:text-gray-300 text-sm font-medium transition-all disabled:opacity-50"
        >
          {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
        </button>
      )}
    </div>
  )
}
