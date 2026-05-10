'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  CheckCircle2, AlertCircle, RefreshCw, Link2Off, Eye, EyeOff,
  ChevronLeft, Clock, Wifi, WifiOff, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { UserIntegration } from '@/types/database'

type ViewState = 'loading' | 'disconnected' | 'connected'

export default function XiaomiSettingsPage() {
  const [view, setView] = useState<ViewState>('loading')
  const [integration, setIntegration] = useState<UserIntegration | null>(null)

  // Connect form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  // Sync
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // Disconnect
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'xiaomi')
      .maybeSingle()

    if (data?.access_token) {
      setIntegration(data)
      setView('connected')
    } else {
      setView('disconnected')
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    setConnectError('')

    const res = await fetch('/api/xiaomi/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setConnectError(data.error ?? 'Ошибка подключения')
      setConnecting(false)
      return
    }

    setPassword('')
    await load()
    // Kick off initial sync immediately
    handleSync(true)
  }

  async function handleSync(silent = false) {
    setSyncing(true)
    if (!silent) setSyncMsg('')

    const res = await fetch('/api/xiaomi/sync', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setSyncMsg(`Ошибка: ${data.error}`)
    } else {
      setSyncMsg(
        data.synced > 0
          ? `Синхронизировано ${data.synced} записей`
          : 'Новых данных нет',
      )
    }

    setSyncing(false)
    await load()
  }

  async function handleDisconnect() {
    if (!confirm('Отключить Xiaomi? Импортированные данные останутся.')) return
    setDisconnecting(true)

    await fetch('/api/xiaomi/disconnect', { method: 'POST' })
    setIntegration(null)
    setView('disconnected')
    setDisconnecting(false)
    setSyncMsg('')
  }

  const statusConfig = {
    idle: { label: 'Подключено', variant: 'green' as const, Icon: CheckCircle2 },
    connected: { label: 'Подключено', variant: 'green' as const, Icon: CheckCircle2 },
    syncing: { label: 'Синхронизация…', variant: 'blue' as const, Icon: RefreshCw },
    synced: { label: 'Синхронизировано', variant: 'green' as const, Icon: CheckCircle2 },
    error: { label: 'Ошибка', variant: 'red' as const, Icon: AlertCircle },
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-gray-500 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔗</span> Xiaomi Cloud
          </h1>
          <p className="text-gray-500 text-sm">Автоматическая синхронизация с Mi Scale</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 p-3.5 bg-yellow-500/8 border border-yellow-500/20 rounded-2xl">
        <Info size={15} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-400/90 leading-relaxed">
          Используется неофициальный API Xiaomi. Пароль передаётся на сервер только для получения токена и
          <strong> никогда не сохраняется</strong>. Если синхронизация не работает, используйте{' '}
          <Link href="/import" className="underline">импорт CSV</Link>.
        </p>
      </div>

      {/* Loading */}
      {view === 'loading' && (
        <Card className="animate-pulse h-48" />
      )}

      {/* ── Disconnected: connect form ── */}
      {view === 'disconnected' && (
        <Card glow>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center">
              <WifiOff size={20} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Xiaomi не подключён</p>
              <p className="text-xs text-gray-500">Введите данные от аккаунта Mi</p>
            </div>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <Input
              label="Email от аккаунта Xiaomi / Mi"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Пароль</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-[#1A1A1A] border border-[#333] focus:border-[#FF6B35] text-white placeholder:text-gray-600 outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {connectError && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{connectError}</p>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={connecting}>
              {connecting ? 'Подключение…' : 'Подключить Xiaomi'}
            </Button>
          </form>

          {/* How it works */}
          <div className="mt-5 pt-5 border-t border-[#222] space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Как это работает</p>
            {[
              'Пароль используется только один раз для получения токена',
              'Токен сессии сохраняется в вашем аккаунте Moova',
              'Синхронизация работает без повторного ввода пароля',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                <div className="w-4 h-4 rounded-full bg-[#222] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] text-gray-400">{i + 1}</span>
                </div>
                {t}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Connected ── */}
      {view === 'connected' && integration && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <Wifi size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Xiaomi подключён</p>
                  <p className="text-xs text-gray-500">ID: {integration.provider_user_id}</p>
                </div>
              </div>
              {(() => {
                const cfg = statusConfig[integration.sync_status as keyof typeof statusConfig] ?? statusConfig.idle
                return <Badge variant={cfg.variant}>{cfg.label}</Badge>
              })()}
            </CardHeader>

            {/* Last sync */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <Clock size={13} />
              {integration.last_sync_at
                ? `Последняя синхронизация: ${format(parseISO(integration.last_sync_at), 'd MMM yyyy, HH:mm', { locale: ru })}`
                : 'Синхронизация ещё не выполнялась'}
              {integration.records_synced > 0 && ` · ${integration.records_synced} записей`}
            </div>

            {/* Sync error */}
            {integration.sync_status === 'error' && integration.sync_error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-sm">{integration.sync_error}</p>
                  <p className="text-red-400/60 text-xs mt-0.5">
                    Токен мог истечь — отключите и подключите аккаунт снова.
                  </p>
                </div>
              </div>
            )}

            {/* Sync result message */}
            {syncMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm ${
                syncMsg.startsWith('Ошибка')
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-green-500/10 border border-green-500/20 text-green-400'
              }`}>
                {syncMsg.startsWith('Ошибка') ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                {syncMsg}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                className="flex-1"
                loading={syncing}
                onClick={() => handleSync()}
              >
                <RefreshCw size={15} />
                {syncing ? 'Синхронизация…' : 'Синхронизировать'}
              </Button>
              <Button
                variant="danger"
                loading={disconnecting}
                onClick={handleDisconnect}
              >
                <Link2Off size={15} />
                Отключить
              </Button>
            </div>
          </Card>

          {/* What gets synced */}
          <Card>
            <h2 className="text-sm font-semibold text-white mb-3">Какие данные синхронизируются</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Вес (кг)',
                'Индекс массы тела',
                'Жировая масса (%)',
                'Мышечная масса (кг)',
                'Костная масса (кг)',
                'Вода (%)',
                'Висцеральный жир',
                'За последние 12 месяцев',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[#1A1A1A]">
              <p className="text-xs text-gray-600">
                Данные также доступны через{' '}
                <Link href="/import" className="text-[#FF6B35] hover:text-[#FF8C5A]">
                  импорт CSV
                </Link>{' '}
                — используйте его как резервный вариант.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
