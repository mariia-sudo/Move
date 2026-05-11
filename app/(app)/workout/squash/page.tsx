'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

type Result = 'win' | 'loss' | 'draw'

export default function SquashPage() {
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState('')
  const [opponent, setOpponent] = useState('')
  const [score, setScore] = useState('')
  const [result, setResult] = useState<Result | ''>('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: workout, error: wErr } = await supabase.from('workouts').insert({
      user_id: user.id,
      sport_type: 'squash',
      date,
      notes: notes || null,
      duration_minutes: duration ? parseInt(duration) : null,
    }).select().single()

    if (wErr || !workout) { setError(wErr?.message || 'Ошибка сохранения'); setLoading(false); return }

    const { error: rErr } = await supabase.from('workout_racket').insert({
      workout_id: workout.id,
      opponent: opponent || null,
      score: score || null,
      result: result || null,
      notes: notes || null,
    })

    if (rErr) { setError(rErr.message); setLoading(false); return }

    router.push(`/workout/feedback?id=${workout.id}`)
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-500/15 rounded-xl flex items-center justify-center">
          <span className="text-xl">🎾</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Записать сквош</h1>
          <p className="text-gray-500 text-sm">Матч или тренировочная сессия</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Input label="Длительность (мин)" type="number" placeholder="45" value={duration} onChange={e => setDuration(e.target.value)} min="1" />
        </div>

        <Input
          label="Соперник (необязательно)"
          placeholder="Имя или «Тренировка»"
          value={opponent}
          onChange={e => setOpponent(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Результат</label>
          <div className="grid grid-cols-3 gap-2">
            {(['win', 'loss', 'draw'] as Result[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setResult(result === r ? '' : r)}
                className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                  result === r
                    ? r === 'win'
                      ? 'bg-green-500/15 border-green-500/30 text-green-400'
                      : r === 'loss'
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : 'bg-gray-500/15 border-gray-500/30 text-gray-300'
                    : 'bg-[#1A1A1A] border-[#333] text-gray-500 hover:border-[#444]'
                }`}
              >
                {r === 'win' ? '🏆 Победа' : r === 'loss' ? '💪 Поражение' : '🤝 Ничья'}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Счёт (необязательно)"
          placeholder="3-2, 11-9, 11-7, 11-6"
          value={score}
          onChange={e => setScore(e.target.value)}
        />

        <Textarea
          label="Заметки (необязательно)"
          placeholder="Как прошёл матч? Что нужно улучшить?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Сохранить сессию
        </Button>
      </form>
    </div>
  )
}
