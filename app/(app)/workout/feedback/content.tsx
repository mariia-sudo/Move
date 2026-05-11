'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap, CheckCircle2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { BodyMap } from '@/components/workout/BodyMap'
import type { FeedbackMood } from '@/types/database'

const SPORT_EMOJI: Record<string, string> = {
  weightlifting: '🏋️',
  running: '🏃',
  squash: '🎾',
  padel: '🏓',
}
const SPORT_LABEL: Record<string, string> = {
  weightlifting: 'Силовая',
  running: 'Пробежка',
  squash: 'Сквош',
  padel: 'Падель',
}

const MOODS: { value: FeedbackMood; emoji: string; label: string; color: string }[] = [
  { value: 'tired',       emoji: '😴', label: 'Устал',          color: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  { value: 'good',        emoji: '😊', label: 'Хорошо',         color: 'border-green-500/30 bg-green-500/10 text-green-300' },
  { value: 'great',       emoji: '💪', label: 'Отлично',        color: 'border-[#FF6B35]/30 bg-[#FF6B35]/10 text-[#FF6B35]' },
  { value: 'overtrained', emoji: '😤', label: 'Перетренировался',color: 'border-red-500/30 bg-red-500/10 text-red-300' },
]

const ENERGY_LABELS: Record<number, string> = {
  1: 'Полное опустошение', 2: 'Очень плохо', 3: 'Плохо',
  4: 'Ниже среднего', 5: 'Среднее', 6: 'Нормально',
  7: 'Хорошо', 8: 'Отлично', 9: 'Прекрасно', 10: 'Лучший день!',
}

function energyColor(v: number) {
  if (v <= 3) return '#EF4444'
  if (v <= 5) return '#F97316'
  if (v <= 7) return '#EAB308'
  return '#22C55E'
}

export default function FeedbackContent() {
  const router = useRouter()
  const params = useSearchParams()
  const workoutId = params.get('id')

  const [sportType, setSportType] = useState('')
  const [energy, setEnergy] = useState(7)
  const [mood, setMood] = useState<FeedbackMood | null>(null)
  const [painAreas, setPainAreas] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [alcoholLast24h, setAlcoholLast24h] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workoutId) { router.replace('/dashboard'); return }
    const id = workoutId

    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: workout } = await supabase
        .from('workouts')
        .select('sport_type')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!workout) { router.replace('/dashboard'); return }
      setSportType(workout.sport_type)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId])

  async function handleSave() {
    if (!workoutId) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    await Promise.all([
      supabase.from('workout_feedback').insert({
        workout_id: workoutId,
        user_id: user.id,
        energy_level: energy,
        mood: mood ?? undefined,
        pain_areas: painAreas,
        notes: notes.trim() || null,
      }),
      alcoholLast24h
        ? supabase.from('daily_logs').upsert(
            { user_id: user.id, date: today, type: 'alcohol' },
            { onConflict: 'user_id,date,type' }
          )
        : Promise.resolve(),
    ])

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  function handleSkip() {
    router.push('/dashboard')
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Сохранено!</h2>
          <p className="text-gray-400 mt-1 text-sm">Переходим на главную...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="h-48 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-xl">
            {SPORT_EMOJI[sportType] ?? '🏃'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#FF6B35] font-semibold uppercase tracking-wider">
                {SPORT_LABEL[sportType] ?? 'Тренировка'} сохранена ✓
              </span>
            </div>
            <h1 className="text-lg font-bold text-white">Как прошло?</h1>
          </div>
        </div>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Пропустить <ChevronRight size={14} />
        </button>
      </div>

      {/* Energy slider */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[#FF6B35]" />
          <h2 className="text-sm font-semibold text-white">Уровень энергии</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold" style={{ color: energyColor(energy) }}>{energy}</span>
            <span className="text-sm text-gray-400">{ENERGY_LABELS[energy]}</span>
          </div>
          <div className="relative">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={energy}
              onChange={e => setEnergy(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${energyColor(energy)} ${(energy - 1) / 9 * 100}%, #2A2A2A ${(energy - 1) / 9 * 100}%)`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>1 — Истощён</span>
            <span>10 — Заряжен</span>
          </div>
        </div>
      </Card>

      {/* Mood */}
      <Card>
        <h2 className="text-sm font-semibold text-white mb-4">Настроение после тренировки</h2>
        <div className="grid grid-cols-2 gap-2">
          {MOODS.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(mood === m.value ? null : m.value)}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-sm font-semibold transition-all ${
                mood === m.value ? m.color : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-[#444]'
              }`}
            >
              <span className="text-xl">{m.emoji}</span>
              <span className="text-left leading-tight">{m.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Body pain map */}
      <Card>
        <h2 className="text-sm font-semibold text-white mb-1">Карта боли и усталости</h2>
        <p className="text-xs text-gray-500 mb-4">Отметьте, что болит или тянет</p>
        <BodyMap selected={painAreas} onChange={setPainAreas} />
      </Card>

      {/* Alcohol checkbox */}
      <button
        type="button"
        onClick={() => setAlcoholLast24h(v => !v)}
        className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all ${
          alcoholLast24h
            ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
            : 'bg-[#111] border-[#222] text-gray-400 hover:border-[#333]'
        }`}
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-all ${
          alcoholLast24h
            ? 'bg-purple-500 border-purple-500'
            : 'border-[#444] bg-[#1A1A1A]'
        }`}>
          {alcoholLast24h && (
            <svg viewBox="0 0 10 8" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        🍷 Употреблял алкоголь за последние 24ч
      </button>

      {/* Notes */}
      <Card>
        <Textarea
          label="Заметки о самочувствии (необязательно)"
          placeholder="Как спала? Что болит? Особые ощущения..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />
      </Card>

      <Button size="lg" className="w-full" loading={saving} onClick={handleSave}>
        Сохранить самочувствие
      </Button>
    </div>
  )
}
