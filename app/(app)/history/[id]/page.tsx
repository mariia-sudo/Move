'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, Calendar, Clock, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BodyMap } from '@/components/workout/BodyMap'
import type { Workout, WorkoutSet, WorkoutCardio, WorkoutRacket, WorkoutFeedback } from '@/types/database'
import { SPORT_CONFIG, type SportType } from '@/lib/sports'

// ─── Config ────────────────────────────────────────────────────────────────────

const MOOD_CONFIG: Record<string, { emoji: string; label: string; variant: 'blue' | 'green' | 'orange' | 'red' }> = {
  tired:       { emoji: '😴', label: 'Устал',           variant: 'blue'   },
  good:        { emoji: '😊', label: 'Хорошо',          variant: 'green'  },
  great:       { emoji: '💪', label: 'Отлично',         variant: 'orange' },
  overtrained: { emoji: '😤', label: 'Перетренировался', variant: 'red'    },
}

const RESULT_CONFIG: Record<string, { label: string; variant: 'green' | 'red' | 'gray' }> = {
  win:  { label: '🏆 Победа',    variant: 'green' },
  loss: { label: '💪 Поражение', variant: 'red'   },
  draw: { label: '🤝 Ничья',     variant: 'gray'  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatPace(secsPerKm: number) {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /км`
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function energyColor(v: number) {
  if (v <= 3) return '#EF4444'
  if (v <= 5) return '#F97316'
  if (v <= 7) return '#EAB308'
  return '#22C55E'
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [cardio, setCardio] = useState<WorkoutCardio | null>(null)
  const [racket, setRacket] = useState<WorkoutRacket | null>(null)
  const [feedback, setFeedback] = useState<WorkoutFeedback | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: w } = await supabase
        .from('workouts').select('*').eq('id', id).eq('user_id', user.id).single()
      if (!w) { router.replace('/history'); return }
      setWorkout(w)

      const sportCat = SPORT_CONFIG[w.sport_type as SportType]?.category
      // Load sport-specific data in parallel
      const [setsRes, cardioRes, racketRes, fbRes] = await Promise.all([
        sportCat === 'strength'
          ? supabase.from('workout_sets').select('*').eq('workout_id', id).order('created_at')
          : Promise.resolve({ data: [] }),
        sportCat === 'cardio'
          ? supabase.from('workout_cardio').select('*').eq('workout_id', id).single()
          : Promise.resolve({ data: null }),
        (sportCat === 'racket' || sportCat === 'team')
          ? supabase.from('workout_racket').select('*').eq('workout_id', id).single()
          : Promise.resolve({ data: null }),
        supabase.from('workout_feedback').select('*').eq('workout_id', id).single(),
      ])

      setSets((setsRes.data ?? []) as WorkoutSet[])
      setCardio((cardioRes as { data: WorkoutCardio | null }).data)
      setRacket((racketRes as { data: WorkoutRacket | null }).data)
      setFeedback((fbRes as { data: WorkoutFeedback | null }).data)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!workout) return null

  const cfg = SPORT_CONFIG[workout.sport_type as SportType] ?? SPORT_CONFIG['weightlifting']
  const totalVolume = sets.reduce((s, r) => s + (r.weight_kg ?? 0) * r.sets * r.reps, 0)

  // Group sets by exercise name for display
  const exerciseGroups = sets.reduce((acc, s) => {
    if (!acc[s.exercise]) acc[s.exercise] = []
    acc[s.exercise].push(s)
    return acc
  }, {} as Record<string, WorkoutSet[]>)

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Back + header */}
      <div>
        <Link
          href="/history"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors mb-4"
        >
          <ChevronLeft size={16} /> История
        </Link>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-[#1A1A1A] rounded-2xl flex items-center justify-center text-3xl shrink-0">
            {cfg.emoji}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{cfg.label}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                {format(parseISO(workout.date), 'd MMMM yyyy', { locale: ru })}
              </span>
              {workout.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock size={13} />
                  {workout.duration_minutes} мин
                </span>
              )}
            </div>
          </div>
          <Badge variant={cfg.color}>{cfg.label}</Badge>
        </div>
      </div>

      {/* ── Weightlifting ── */}
      {cfg.category === 'strength' && sets.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">Упражнения</h2>
            {totalVolume > 0 && (
              <span className="text-xs text-gray-500">{Math.round(totalVolume).toLocaleString('ru')} кг общий объём</span>
            )}
          </CardHeader>
          <div className="space-y-3">
            {Object.entries(exerciseGroups).map(([exercise, rows]) => (
              <div key={exercise}>
                <p className="text-sm font-semibold text-white mb-1.5">{exercise}</p>
                <div className="flex flex-wrap gap-2">
                  {rows.map((row, i) => (
                    <div key={i} className="bg-[#1A1A1A] rounded-xl px-3 py-2 text-xs text-gray-300">
                      <span className="font-bold text-white">{row.sets}×{row.reps}</span>
                      {row.weight_kg && <span className="text-gray-500 ml-1">@ {row.weight_kg} кг</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Running ── */}
      {cfg.category === 'cardio' && cardio && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">Статистика пробежки</h2>
          </CardHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1A1A1A] rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Дистанция</div>
              <div className="text-xl font-bold text-white">{cardio.distance_km} <span className="text-sm text-gray-500">км</span></div>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Время</div>
              <div className="text-xl font-bold text-white">{formatDuration(cardio.duration_seconds)}</div>
            </div>
            {cardio.avg_pace_per_km && (
              <div className="bg-[#1A1A1A] rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Средний темп</div>
                <div className="text-xl font-bold text-[#FF6B35]">{formatPace(cardio.avg_pace_per_km)}</div>
              </div>
            )}
            {cardio.avg_heart_rate && (
              <div className="bg-[#1A1A1A] rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Пульс</div>
                <div className="text-xl font-bold text-white">{cardio.avg_heart_rate} <span className="text-sm text-gray-500">уд/мин</span></div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Racket sports ── */}
      {(cfg.category === 'racket' || cfg.category === 'team') && racket && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">Матч</h2>
            {racket.result && RESULT_CONFIG[racket.result] && (
              <Badge variant={RESULT_CONFIG[racket.result].variant}>
                {RESULT_CONFIG[racket.result].label}
              </Badge>
            )}
          </CardHeader>
          <div className="space-y-2">
            {racket.opponent && (
              <div className="flex items-center justify-between py-2 border-b border-[#1A1A1A]">
                <span className="text-sm text-gray-500">Соперник</span>
                <span className="text-sm font-semibold text-white">{racket.opponent}</span>
              </div>
            )}
            {racket.score && (
              <div className="flex items-center justify-between py-2 border-b border-[#1A1A1A]">
                <span className="text-sm text-gray-500">Счёт</span>
                <span className="text-sm font-bold text-white font-mono">{racket.score}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Workout notes */}
      {workout.notes && (
        <Card>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Заметки к тренировке</h2>
          <p className="text-sm text-gray-300 leading-relaxed">{workout.notes}</p>
        </Card>
      )}

      {/* ── Feedback ── */}
      {feedback && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 h-px bg-[#1A1A1A]" />
            <span className="text-xs text-gray-600 px-2">Самочувствие после тренировки</span>
            <div className="flex-1 h-px bg-[#1A1A1A]" />
          </div>

          {/* Energy + Mood */}
          <div className="grid grid-cols-2 gap-3">
            {feedback.energy_level && (
              <Card className="py-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap size={13} className="text-[#FF6B35]" />
                  <span className="text-xs text-gray-500">Энергия</span>
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="text-3xl font-bold" style={{ color: energyColor(feedback.energy_level) }}>
                    {feedback.energy_level}
                  </span>
                  <span className="text-gray-600 text-sm mb-1">/10</span>
                </div>
                <div className="flex gap-0.5 mt-2">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full"
                      style={{ background: i < feedback.energy_level! ? energyColor(feedback.energy_level!) : '#2A2A2A' }}
                    />
                  ))}
                </div>
              </Card>
            )}

            {feedback.mood && MOOD_CONFIG[feedback.mood] && (
              <Card className="py-4 flex flex-col justify-center items-center gap-2">
                <span className="text-4xl">{MOOD_CONFIG[feedback.mood].emoji}</span>
                <Badge variant={MOOD_CONFIG[feedback.mood].variant}>
                  {MOOD_CONFIG[feedback.mood].label}
                </Badge>
              </Card>
            )}
          </div>

          {/* Body pain map */}
          {feedback.pain_areas.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-white mb-1">Карта боли</h2>
              <p className="text-xs text-gray-500 mb-3">
                {feedback.pain_areas.length === 1
                  ? '1 область'
                  : `${feedback.pain_areas.length} области`}
              </p>
              <BodyMap
                selected={feedback.pain_areas}
                onChange={() => {}}
                readonly
              />
            </Card>
          )}

          {/* Feedback notes */}
          {feedback.notes && (
            <Card>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Заметки о самочувствии</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{feedback.notes}</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
