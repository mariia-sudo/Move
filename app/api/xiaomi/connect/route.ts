import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { authenticateXiaomi, getHuamiAppToken } from '@/lib/xiaomi-cloud'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string }
  if (!email || !password) {
    return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    // Authenticate with Xiaomi — this never stores the password
    const tokens = await authenticateXiaomi(email, password)

    // Exchange for Mi Fitness (Huami) app token
    const deviceId = crypto.randomBytes(8).toString('hex').toUpperCase()
    const appToken = await getHuamiAppToken(tokens, deviceId)

    // Persist only tokens, never the password
    const { error: dbErr } = await supabase.from('user_integrations').upsert({
      user_id: user.id,
      provider: 'xiaomi',
      provider_user_id: tokens.userId,
      access_token: appToken,
      token_data: {
        service_token: tokens.serviceToken,
        device_id: deviceId,
      },
      sync_status: 'connected',
      sync_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

    if (dbErr) throw new Error('Ошибка сохранения токенов: ' + dbErr.message)

    return NextResponse.json({ success: true, userId: tokens.userId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Ошибка подключения' }, { status: 400 })
  }
}
