'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

function formatPace(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /км`
}

export default function RunningPage() {
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [distanceKm, setDistanceKm] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [durationSec, setDurationSec] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const totalSeconds = (parseInt(durationMin) || 0) * 60 + (parseInt(durationSec) || 0)
  const distance = parseFloat(distanceKm) || 0
  const pace = distance > 0 && totalSeconds > 0 ? totalSeconds / distance : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!distanceKm || totalSeconds === 0) { setError('Введите дистанцию и время'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: workout, error: wErr } = await supabase.from('workouts').insert({
      user_id: user.id,
      sport_type: 'running',
      date,
      notes: notes || null,
      duration_minutes: Math.round(totalSeconds / 60),
    }).select().single()

    if (wErr || !workout) { setError(wErr?.message || 'Ошибка сохранения'); setLoading(false); return }

    const { error: cErr } = await supabase.from('workout_cardio').insert({
      workout_id: workout.id,
      distance_km: distance,
      duration_seconds: totalSeconds,
      avg_pace_per_km: pace > 0 ? Math.round(pace) : null,
      avg_heart_rate: heartRate ? parseInt(heartRate) : null,
    })

    if (cErr) { setError(cErr.message); setLoading(false); return }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold">Пробежка сохранена!</h2>
          <p className="text-gray-400 mt-1 text-sm">Возвращаемся на главную...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
          <span className="text-xl">🏃</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Записать пробежку</h1>
          <p className="text-gray-500 text-sm">Дистанция, время и темп</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} required />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Дистанция (км)"
            type="number"
            step="0.01"
            placeholder="5.00"
            value={distanceKm}
            onChange={e => setDistanceKm(e.target.value)}
            required
            min="0"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Время</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="мм"
                min="0"
                max="999"
                value={durationMin}
                onChange={e => setDurationMin(e.target.value)}
                className="flex-1 px-3 py-3 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white placeholder:text-gray-600 outline-none text-sm text-center"
              />
              <span className="text-gray-500 text-sm font-bold">:</span>
              <input
                type="number"
                placeholder="сс"
                min="0"
                max="59"
                value={durationSec}
                onChange={e => setDurationSec(e.target.value)}
                className="flex-1 px-3 py-3 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white placeholder:text-gray-600 outline-none text-sm text-center"
              />
            </div>
          </div>
        </div>

        {/* Live stats */}
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

        <Input
          label="Средний пульс (уд/мин) — необязательно"
          type="number"
          placeholder="150"
          value={heartRate}
          onChange={e => setHeartRate(e.target.value)}
          min="40"
          max="220"
        />

        <Textarea
          label="Заметки (необязательно)"
          placeholder="Как прошла пробежка? Маршрут? Погода?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Сохранить пробежку
        </Button>
      </form>
    </div>
  )
}
