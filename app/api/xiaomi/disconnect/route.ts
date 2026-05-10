import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  await supabase.from('user_integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'xiaomi')

  return NextResponse.json({ success: true })
}
