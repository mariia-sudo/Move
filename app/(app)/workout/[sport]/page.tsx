'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { SPORT_CONFIG, isSportType } from '@/lib/sports'
import type { SportType } from '@/lib/sports'

type Result = 'win' | 'loss' | 'draw'

function formatPace(secsPerKm: number) {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /км`
}

export default function DynamicWorkoutPage() {
  const params = useParams()
  const router = useRouter()
  const rawSport = params.sport as string

  // Redirect legacy sports that have their own pages
  const LEGACY = ['weightlifting', 'running', 'squash', 'padel']
  if (LEGACY.includes(rawSport)) {
    router.replace(`/workout/${rawSport}`)
    return null
  }

  if (!isSportType(rawSport)) {
    router.replace('/workout')
    return null
  }

  const sport = rawSport as SportType
  const cfg = SPORT_CONFIG[sport]

  // Common fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  // Cardio fields
  const [distanceKm, setDistanceKm] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [durationSec, setDurationSec] = useState('')
  const [heartRate, setHeartRate] = useState('')
  // Racket/Team fields
  const [opponent, setOpponent] = useState('')
  const [score, setScore] = useState('')
  const [result, setResult] = useState<Result | ''>('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalSeconds = (parseInt(durationMin) || 0) * 60 + (parseInt(durationSec) || 0)
  const distance = parseFloat(distanceKm) || 0
  const pace = distance > 0 && totalSeconds > 0 ? totalSeconds / distance : 0

  const isCardio = cfg.category === 'cardio'
  const isRacket = cfg.category === 'racket' || cfg.category === 'team'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isCardio && (!distanceKm || totalSeconds === 0)) {
      setError('Введите дистанцию и время')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const durationMins = isCardio
      ? Math.round(totalSeconds / 60)
      : duration ? parseInt(duration) : null

    const { data: workout, error: wErr } = await supabase.from('workouts').insert({
      user_id: user.id,
      sport_type: sport,
      date,
      notes: notes || null,
      duration_minutes: durationMins,
    }).select().single()

    if (wErr || !workout) { setError(wErr?.message || 'Ошибка сохранения'); setLoading(false); return }

    // Save sport-specific data
    if (isCardio) {
      const { error: cErr } = await supabase.from('workout_cardio').insert({
        workout_id: workout.id,
        distance_km: distance,
        duration_seconds: totalSeconds,
        avg_pace_per_km: pace > 0 ? Math.round(pace) : null,
        avg_heart_rate: heartRate ? parseInt(heartRate) : null,
      })
      if (cErr) { setError(cErr.message); setLoading(false); return }
    } else if (isRacket) {
      const { error: rErr } = await supabase.from('workout_racket').insert({
        workout_id: workout.id,
        opponent: opponent || null,
        score: score || null,
        result: result || null,
        notes: notes || null,
      })
      if (rErr) { setError(rErr.message); setLoading(false); return }
    }

    router.push(`/workout/feedback?id=${workout.id}`)
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl bg-[#1A1A1A]">
          {cfg.emoji}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{cfg.label}</h1>
          <p className="text-gray-500 text-sm">
            {isCardio ? 'Дистанция и время' : isRacket ? 'Матч или тренировка' : 'Запись тренировки'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── General fields ── */}
        {!isCardio && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <Input label="Длительность (мин)" type="number" placeholder="60" value={duration} onChange={e => setDuration(e.target.value)} min="1" />
          </div>
        )}

        {/* ── Cardio fields ── */}
        {isCardio && (
          <>
            <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Дистанция (км)"
                type="number" step="0.01" placeholder="5.00"
                value={distanceKm} onChange={e => setDistanceKm(e.target.value)}
                required min="0"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Время</label>
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="мм" min="0" max="999" value={durationMin}
                    onChange={e => setDurationMin(e.target.value)}
                    className="flex-1 px-3 py-3 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white placeholder:text-gray-600 outline-none text-sm text-center" />
                  <span className="text-gray-500 font-bold">:</span>
                  <input type="number" placeholder="сс" min="0" max="59" value={durationSec}
                    onChange={e => setDurationSec(e.target.value)}
                    className="flex-1 px-3 py-3 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white placeholder:text-gray-600 outline-none text-sm text-center" />
                </div>
              </div>
            </div>

            {distance > 0 && totalSeconds > 0 && (
              <Card className="bg-[#0D0D0D]">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-[#FF6B35]">{distance.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">км</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {Math.floor(totalSeconds / 60)}:{(totalSeconds % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-500">время</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{formatPace(pace)}</div>
                    <div className="text-xs text-gray-500">темп</div>
                  </div>
                </div>
              </Card>
            )}

            <Input label="Средний пульс (уд/мин) — необязательно" type="number" placeholder="150"
              value={heartRate} onChange={e => setHeartRate(e.target.value)} min="40" max="220" />
          </>
        )}

        {/* ── Racket / Team fields ── */}
        {isRacket && (
          <>
            <Input
              label={cfg.category === 'team' ? 'Команда соперника (необязательно)' : 'Соперник (необязательно)'}
              placeholder={cfg.category === 'team' ? 'напр. ЦСКА' : 'Имя или «Тренировка»'}
              value={opponent} onChange={e => setOpponent(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Результат</label>
              <div className="grid grid-cols-3 gap-2">
                {(['win', 'loss', 'draw'] as Result[]).map(r => (
                  <button key={r} type="button" onClick={() => setResult(result === r ? '' : r)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                      result === r
                        ? r === 'win'  ? 'bg-green-500/15 border-green-500/30 text-green-400'
                        : r === 'loss' ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        :                'bg-gray-500/15 border-gray-500/30 text-gray-300'
                        : 'bg-[#1A1A1A] border-[#333] text-gray-500 hover:border-[#444]'
                    }`}>
                    {r === 'win' ? '🏆 Победа' : r === 'loss' ? '💪 Поражение' : '🤝 Ничья'}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Счёт (необязательно)" placeholder="3:1" value={score} onChange={e => setScore(e.target.value)} />
          </>
        )}

        <Textarea
          label="Заметки (необязательно)"
          placeholder={
            cfg.category === 'general' ? 'Как прошло? Что чувствовали?' :
            isCardio ? 'Маршрут, погода, ощущения...' :
            'Как прошёл матч? Что улучшить?'
          }
          value={notes} onChange={e => setNotes(e.target.value)} rows={3}
        />

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Сохранить тренировку
        </Button>
      </form>
    </div>
  )
}
