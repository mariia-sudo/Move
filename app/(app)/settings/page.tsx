'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, LogOut, CheckCircle2, Edit2, Save, X, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Profile, Gender } from '@/types/database'

// ─── Habit selector ─────────────────────────────────────────────────────────

function HabitRow({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">{label}</label>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all leading-tight ${
              value === opt.value
                ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]'
                : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-[#444] hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function bmi(weight: number, heightCm: number) {
  const h = heightCm / 100
  return (weight / (h * h)).toFixed(1)
}

function bmiLabel(b: number) {
  if (b < 18.5) return { text: 'Дефицит', variant: 'blue' as const }
  if (b < 25) return { text: 'Норма', variant: 'green' as const }
  if (b < 30) return { text: 'Избыток', variant: 'orange' as const }
  return { text: 'Ожирение', variant: 'red' as const }
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [xiaomiConnected, setXiaomiConnected] = useState<boolean | null>(null)

  // Profile form state
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  // Lifestyle habits state
  const [smoking, setSmoking] = useState<string | null>(null)
  const [alcohol, setAlcohol] = useState<string | null>(null)
  const [sleepQuality, setSleepQuality] = useState<string | null>(null)
  const [stressLevel, setStressLevel] = useState<string | null>(null)
  const [waterIntake, setWaterIntake] = useState<string | null>(null)
  const [habitsSaving, setHabitsSaving] = useState(false)
  const [habitsSaved, setHabitsSaved] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProfile(); loadXiaomiStatus() }, [])

  async function loadXiaomiStatus() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('user_integrations')
      .select('access_token').eq('user_id', user.id).eq('provider', 'xiaomi').maybeSingle()
    setXiaomiConnected(!!data?.access_token)
  }

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      prefillForm(data)
    }
    setLoading(false)
  }

  function prefillForm(p: Profile) {
    setFullName(p.full_name || '')
    setGender(p.gender || null)
    setAge(p.age?.toString() || '')
    setWeight(p.weight_kg?.toString() || '')
    setHeight(p.height_cm?.toString() || '')
    setSmoking(p.smoking || null)
    setAlcohol(p.alcohol || null)
    setSleepQuality(p.sleep_quality || null)
    setStressLevel(p.stress_level || null)
    setWaterIntake(p.water_intake || null)
  }

  function startEditing() {
    if (profile) prefillForm(profile)
    setEditing(true)
    setSaved(false)
    setError('')
  }

  function cancelEditing() {
    setEditing(false)
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!gender) { setError('Выберите пол'); return }
    if (!age || !weight || !height) { setError('Заполните все поля'); return }

    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('profiles').update({
      full_name: fullName || null,
      gender,
      age: parseInt(age),
      weight_kg: parseFloat(weight),
      height_cm: parseInt(height),
    }).eq('id', user.id)

    if (err) { setError(err.message); setSaving(false); return }

    setSaved(true)
    setEditing(false)
    setSaving(false)
    await loadProfile()
  }

  async function saveHabits() {
    setHabitsSaving(true)
    setHabitsSaved(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      smoking:       (smoking      ?? null) as Profile['smoking'],
      alcohol:       (alcohol      ?? null) as Profile['alcohol'],
      sleep_quality: (sleepQuality ?? null) as Profile['sleep_quality'],
      stress_level:  (stressLevel  ?? null) as Profile['stress_level'],
      water_intake:  (waterIntake  ?? null) as Profile['water_intake'],
    }).eq('id', user.id)
    setHabitsSaved(true)
    setHabitsSaving(false)
    await loadProfile()
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const bmiValue = profile?.weight_kg && profile?.height_cm
    ? parseFloat(bmi(profile.weight_kg, profile.height_cm))
    : null
  const bmiInfo = bmiValue ? bmiLabel(bmiValue) : null

  const genderLabel = profile?.gender === 'female' ? 'Женский' : profile?.gender === 'male' ? 'Мужской' : null

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-gray-500 text-sm mt-1">Профиль и параметры аккаунта</p>
      </div>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF6B35]/15 rounded-xl flex items-center justify-center">
              <User size={20} className="text-[#FF6B35]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {profile?.full_name || 'Профиль'}
              </div>
              <div className="text-xs text-gray-500">{profile?.email}</div>
            </div>
          </div>
          {!editing && (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              <Edit2 size={14} />
              Изменить
            </Button>
          )}
        </CardHeader>

        {/* Saved confirmation */}
        {saved && !editing && (
          <div className="flex items-center gap-2 text-green-400 text-sm mb-4 bg-green-500/10 rounded-xl px-3 py-2">
            <CheckCircle2 size={16} />
            Профиль обновлён
          </div>
        )}

        {/* View mode */}
        {!editing && !loading && (
          <div className="space-y-3">
            {profile?.gender || profile?.age || profile?.weight_kg || profile?.height_cm ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {genderLabel && (
                    <div className="bg-[#1A1A1A] rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">Пол</div>
                      <div className="text-sm font-semibold text-white">{genderLabel}</div>
                    </div>
                  )}
                  {profile?.age && (
                    <div className="bg-[#1A1A1A] rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">Возраст</div>
                      <div className="text-sm font-semibold text-white">{profile.age} лет</div>
                    </div>
                  )}
                  {profile?.weight_kg && (
                    <div className="bg-[#1A1A1A] rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">Вес</div>
                      <div className="text-sm font-semibold text-white">{profile.weight_kg} кг</div>
                    </div>
                  )}
                  {profile?.height_cm && (
                    <div className="bg-[#1A1A1A] rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">Рост</div>
                      <div className="text-sm font-semibold text-white">{profile.height_cm} см</div>
                    </div>
                  )}
                </div>
                {bmiValue && bmiInfo && (
                  <div className="flex items-center justify-between bg-[#1A1A1A] rounded-xl px-4 py-3">
                    <span className="text-sm text-gray-400">Индекс массы тела</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{bmiValue}</span>
                      <Badge variant={bmiInfo.variant}>{bmiInfo.text}</Badge>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm mb-3">Профиль не заполнен</p>
                <Button size="sm" onClick={startEditing}>Заполнить профиль</Button>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-[#1A1A1A] rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <form onSubmit={handleSave} className="space-y-5 pt-2">
            <Input
              label="Имя"
              type="text"
              placeholder="Иван Иванов"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />

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
                    className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      gender === value
                        ? 'bg-[#FF6B35]/10 border-[#FF6B35]/40 text-[#FF6B35]'
                        : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-[#444]'
                    }`}
                  >
                    <span className="text-xl">{emoji}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

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

            {/* Live BMI preview */}
            {weight && height && (
              <div className="flex items-center justify-between bg-[#0D0D0D] rounded-xl px-4 py-3 border border-[#2A2A2A]">
                <span className="text-sm text-gray-400">Индекс массы тела</span>
                <div className="flex items-center gap-2">
                  {(() => {
                    const b = parseFloat(bmi(parseFloat(weight), parseFloat(height)))
                    const info = bmiLabel(b)
                    return (
                      <>
                        <span className="text-sm font-bold text-white">{b}</span>
                        <Badge variant={info.variant}>{info.text}</Badge>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" loading={saving} className="flex-1">
                <Save size={15} />
                Сохранить
              </Button>
              <Button type="button" variant="secondary" onClick={cancelEditing}>
                <X size={15} />
                Отмена
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Lifestyle habits */}
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-sm font-semibold text-white">Образ жизни</h2>
            <p className="text-xs text-gray-500 mt-0.5">Используется для персональных рекомендаций</p>
          </div>
        </CardHeader>

        <div className="space-y-5">
          <HabitRow
            label="Курение"
            value={smoking}
            onChange={setSmoking}
            options={[
              { value: 'never',     label: 'Никогда'   },
              { value: 'sometimes', label: 'Иногда'    },
              { value: 'regularly', label: 'Регулярно' },
            ]}
          />
          <HabitRow
            label="Алкоголь"
            value={alcohol}
            onChange={setAlcohol}
            options={[
              { value: 'never',    label: 'Никогда'       },
              { value: 'holidays', label: 'По праздникам' },
              { value: 'regularly',label: 'Регулярно'     },
            ]}
          />
          <HabitRow
            label="Качество сна"
            value={sleepQuality}
            onChange={setSleepQuality}
            options={[
              { value: 'under6', label: '< 6 часов' },
              { value: '6to8',   label: '6–8 часов'  },
              { value: 'over8',  label: '> 8 часов'  },
            ]}
          />
          <HabitRow
            label="Уровень стресса"
            value={stressLevel}
            onChange={setStressLevel}
            options={[
              { value: 'low',    label: 'Низкий'  },
              { value: 'medium', label: 'Средний' },
              { value: 'high',   label: 'Высокий' },
            ]}
          />
          <HabitRow
            label="Потребление воды"
            value={waterIntake}
            onChange={setWaterIntake}
            options={[
              { value: 'under1l', label: '< 1 л'   },
              { value: '1to2l',   label: '1–2 л'    },
              { value: 'over2l',  label: '> 2 л'    },
            ]}
          />
        </div>

        {habitsSaved && (
          <div className="flex items-center gap-2 text-green-400 text-sm mt-4 bg-green-500/10 rounded-xl px-3 py-2">
            <CheckCircle2 size={15} />
            Привычки сохранены
          </div>
        )}

        <Button
          className="w-full mt-5"
          loading={habitsSaving}
          onClick={saveHabits}
        >
          Сохранить привычки
        </Button>
      </Card>

      {/* Xiaomi integration */}
      <Link href="/settings/xiaomi">
        <Card className="cursor-pointer hover:border-[#333] transition-colors">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              xiaomiConnected ? 'bg-green-500/10' : 'bg-[#1A1A1A]'
            }`}>
              {xiaomiConnected
                ? <Wifi size={20} className="text-green-400" />
                : <WifiOff size={20} className="text-gray-500" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Xiaomi Cloud / Mi Scale</p>
              <p className="text-xs text-gray-500">
                {xiaomiConnected === null
                  ? 'Загрузка…'
                  : xiaomiConnected
                    ? 'Подключено — автосинхронизация активна'
                    : 'Не подключено — нажмите для настройки'}
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-600" />
          </div>
        </Card>
      </Link>

      {/* Sign out */}
      <Card>
        <button
          onClick={signOut}
          className="flex items-center gap-3 text-sm font-medium text-red-400 hover:text-red-300 transition-colors w-full"
        >
          <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
            <LogOut size={16} className="text-red-400" />
          </div>
          Выйти из аккаунта
        </button>
      </Card>
    </div>
  )
}
