import { NextResponse } from 'next/server'
import { format, subMonths } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { fetchBodyData } from '@/lib/xiaomi-cloud'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'xiaomi')
    .single()

  if (!integration?.access_token || !integration.provider_user_id) {
    return NextResponse.json({ error: 'Xiaomi не подключён' }, { status: 400 })
  }

  await supabase.from('user_integrations').update({
    sync_status: 'syncing',
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id).eq('provider', 'xiaomi')

  try {
    const tokenData = integration.token_data as Record<string, string> | null
    const countryCode = tokenData?.country_code ?? 'US'
    const fromDate = format(subMonths(new Date(), 12), 'yyyy-MM-dd')
    const toDate = format(new Date(), 'yyyy-MM-dd')

    const records = await fetchBodyData(
      integration.access_token,
      integration.provider_user_id,
      countryCode,
      fromDate,
      toDate,
    )

    let synced = 0
    for (let i = 0; i < records.length; i += 200) {
      const batch = records.slice(i, i + 200).map(r => ({ ...r, user_id: user.id }))
      const { error } = await supabase.from('body_measurements')
        .upsert(batch, { onConflict: 'user_id,date' })
      if (error) throw new Error(error.message)
      synced += batch.length
    }

    await supabase.from('user_integrations').update({
      sync_status: 'synced',
      sync_error: null,
      last_sync_at: new Date().toISOString(),
      records_synced: synced,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id).eq('provider', 'xiaomi')

    return NextResponse.json({ synced })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ошибка синхронизации'
    await supabase.from('user_integrations').update({
      sync_status: 'error',
      sync_error: msg,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id).eq('provider', 'xiaomi')

    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
