import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticateHuami } from '@/lib/xiaomi-cloud'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string }
  if (!email || !password) {
    return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    // Two-step Huami auth — password is NEVER stored
    const { appToken, userId, countryCode, deviceId } = await authenticateHuami(email, password)

    const { error: dbErr } = await supabase.from('user_integrations').upsert({
      user_id: user.id,
      provider: 'xiaomi',
      provider_user_id: userId,
      access_token: appToken,
      token_data: { country_code: countryCode, device_id: deviceId },
      sync_status: 'connected',
      sync_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

    if (dbErr) throw new Error('Ошибка сохранения: ' + dbErr.message)

    return NextResponse.json({ success: true, userId, countryCode })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Ошибка подключения' }, { status: 400 })
  }
}
