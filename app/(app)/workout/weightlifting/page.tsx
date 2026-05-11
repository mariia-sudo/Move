'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface SetEntry {
  exercise: string
  sets: number
  reps: number
  weight_kg: string
}

const COMMON_EXERCISES = [
  'Жим лёжа', 'Приседания', 'Становая тяга', 'Жим стоя', 'Тяга штанги',
  'Подтягивания', 'Отжимания на брусьях', 'Выпады', 'Румынская тяга', 'Жим наклонный',
  'Тяга к поясу', 'Тяга верхнего блока', 'Жим ногами', 'Ягодичный мост', 'Тяга к лицу',
]

const emptySet = (): SetEntry => ({ exercise: '', sets: 3, reps: 10, weight_kg: '' })

export default function WeightliftingPage() {
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [setEntries, setSetEntries] = useState<SetEntry[]>([emptySet()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null)

  function updateEntry(index: number, field: keyof SetEntry, value: string | number) {
    setSetEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
  }

  function addSet() {
    const last = setEntries[setEntries.length - 1]
    setSetEntries(prev => [...prev, { ...emptySet(), exercise: last?.exercise || '' }])
  }

  function removeEntry(index: number) {
    if (setEntries.length === 1) return
    setSetEntries(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = setEntries.every(s => s.exercise && s.sets > 0 && s.reps > 0)
    if (!valid) { setError('Заполните все поля упражнений'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: workout, error: wErr } = await supabase.from('workouts').insert({
      user_id: user.id,
      sport_type: 'weightlifting',
      date,
      notes: notes || null,
      duration_minutes: duration ? parseInt(duration) : null,
    }).select().single()

    if (wErr || !workout) { setError(wErr?.message || 'Ошибка сохранения'); setLoading(false); return }

    const { error: sErr } = await supabase.from('workout_sets').insert(
      setEntries.map(s => ({
        workout_id: workout.id,
        exercise: s.exercise,
        sets: s.sets,
        reps: s.reps,
        weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
      }))
    )

    if (sErr) { setError(sErr.message); setLoading(false); return }

    router.push(`/workout/feedback?id=${workout.id}`)
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#FF6B35]/15 rounded-xl flex items-center justify-center">
          <Dumbbell size={20} className="text-[#FF6B35]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Силовая тренировка</h1>
          <p className="text-gray-500 text-sm">Записывайте подходы, повторения и веса</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Input label="Длительность (мин)" type="number" placeholder="60" value={duration} onChange={e => setDuration(e.target.value)} min="1" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-300">Упражнения</label>
            <span className="text-xs text-gray-600">{setEntries.length} упр.</span>
          </div>

          {setEntries.map((entry, i) => (
            <Card key={i} className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Упражнение {i + 1}</span>
                {setEntries.length > 1 && (
                  <button type="button" onClick={() => removeEntry(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="напр. Жим лёжа"
                  value={entry.exercise}
                  onChange={e => { updateEntry(i, 'exercise', e.target.value); setShowSuggestions(i) }}
                  onBlur={() => setTimeout(() => setShowSuggestions(null), 150)}
                  onFocus={() => setShowSuggestions(i)}
                  className="w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white placeholder:text-gray-600 outline-none text-sm"
                />
                {showSuggestions === i && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-[#1A1A1A] border border-[#333] rounded-xl overflow-hidden shadow-xl max-h-40 overflow-y-auto">
                    {COMMON_EXERCISES.filter(ex =>
                      !entry.exercise || ex.toLowerCase().includes(entry.exercise.toLowerCase())
                    ).slice(0, 6).map(ex => (
                      <button
                        key={ex}
                        type="button"
                        onMouseDown={() => { updateEntry(i, 'exercise', ex); setShowSuggestions(null) }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Подходы</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={entry.sets}
                    onChange={e => updateEntry(i, 'sets', parseInt(e.target.value) || 1)}
                    className="px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white text-sm text-center outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Повторения</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={entry.reps}
                    onChange={e => updateEntry(i, 'reps', parseInt(e.target.value) || 1)}
                    className="px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white text-sm text-center outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Вес (кг)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="—"
                    value={entry.weight_kg}
                    onChange={e => updateEntry(i, 'weight_kg', e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white text-sm text-center outline-none"
                  />
                </div>
              </div>
            </Card>
          ))}

          <button
            type="button"
            onClick={addSet}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#333] hover:border-[#FF6B35]/40 text-gray-500 hover:text-[#FF6B35] text-sm font-medium transition-all"
          >
            <Plus size={16} />
            Добавить упражнение
          </button>
        </div>

        <Textarea
          label="Заметки (необязательно)"
          placeholder="Как прошло? Были личные рекорды?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
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
