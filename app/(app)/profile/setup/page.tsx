'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Gender } from '@/types/database'

function bmi(weight: number, heightCm: number) {
  const h = heightCm / 100
  return (weight / (h * h)).toFixed(1)
}

function bmiLabel(b: number) {
  if (b < 18.5) return { text: 'Дефицит', color: 'text-blue-400' }
  if (b < 25) return { text: 'Норма', color: 'text-green-400' }
  if (b < 30) return { text: 'Избыток', color: 'text-yellow-400' }
  return { text: 'Ожирение', color: 'text-red-400' }
}

export default function ProfileSetupPage() {
  const router = useRouter()
  const [gender, setGender] = useState<Gender | null>(null)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const bmiValue = weight && height ? parseFloat(bmi(parseFloat(weight), parseFloat(height))) : null
  const bmiInfo = bmiValue ? bmiLabel(bmiValue) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!gender) { setError('Выберите пол'); return }
    if (!age || !weight || !height) { setError('Заполните все поля'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('profiles').update({
      gender,
      age: parseInt(age),
      weight_kg: parseFloat(weight),
      height_cm: parseInt(height),
    }).eq('id', user.id)

    if (err) { setError(err.message); setLoading(false); return }

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Всё готово!</h2>
          <p className="text-gray-400 mt-1 text-sm">Переходим на главную...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 py-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#FF6B35]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#FF6B35] flex items-center justify-center orange-glow">
            <Dumbbell size={18} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-gradient">Moova</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mt-4">Расскажите о себе</h1>
          <p className="text-gray-500 text-sm mt-2">
            Это поможет персонализировать рекомендации
          </p>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Gender */}
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-3">Пол</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'female' as Gender, label: 'Женский', emoji: '👩' },
                  { value: 'male' as Gender, label: 'Мужской', emoji: '👨' },
                ]).map(({ value, label, emoji }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGender(value)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-semibold transition-all ${
                      gender === value
                        ? 'bg-[#FF6B35]/10 border-[#FF6B35]/40 text-[#FF6B35]'
                        : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-[#444] hover:text-gray-200'
                    }`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <Input
              label="Возраст"
              type="number"
              placeholder="25"
              min="10"
              max="100"
              value={age}
              onChange={e => setAge(e.target.value)}
              hint="лет"
            />

            {/* Weight & Height */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Вес"
                type="number"
                placeholder="65"
                min="30"
                max="300"
                step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                hint="кг"
              />
              <Input
                label="Рост"
                type="number"
                placeholder="170"
                min="100"
                max="250"
                value={height}
                onChange={e => setHeight(e.target.value)}
                hint="см"
              />
            </div>

            {/* BMI preview */}
            {bmiValue && bmiInfo && (
              <div className="flex items-center justify-between bg-[#1A1A1A] rounded-xl px-4 py-3 border border-[#2A2A2A]">
                <span className="text-sm text-gray-400">Индекс массы тела</span>
                <div className="text-right">
                  <span className={`text-lg font-bold ${bmiInfo.color}`}>{bmiValue}</span>
                  <span className={`text-xs ml-2 ${bmiInfo.color}`}>{bmiInfo.text}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Начать тренировки 🚀
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Эти данные видны только вам и помогают строить рекомендации.
        </p>
      </div>
    </div>
  )
}
