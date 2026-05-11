import crypto from 'crypto'

// ─── Constants ─────────────────────────────────────────────────────────────────

const UA = 'MiFit/6.3.5 (iPhone; iOS 16.6; Scale/2.0)'

// Map Huami country codes → Mi Fitness API base URLs
const MIFIT_ENDPOINT: Record<string, string> = {
  CN: 'https://api-mifit.huami.com',
  DE: 'https://api-mifit-eu.huami.com',
  FR: 'https://api-mifit-eu.huami.com',
  GB: 'https://api-mifit-eu.huami.com',
  RU: 'https://api-mifit-eu.huami.com',
  NL: 'https://api-mifit-eu.huami.com',
  IT: 'https://api-mifit-eu.huami.com',
  ES: 'https://api-mifit-eu.huami.com',
  PL: 'https://api-mifit-eu.huami.com',
  SE: 'https://api-mifit-eu.huami.com',
  NO: 'https://api-mifit-eu.huami.com',
  FI: 'https://api-mifit-eu.huami.com',
}

function miFitEndpoint(countryCode: string): string {
  return MIFIT_ENDPOINT[countryCode.toUpperCase()] ?? 'https://api-mifit-us2.huami.com'
}

function huamiAccountBase(countryCode: string): string {
  const eu = ['DE', 'FR', 'GB', 'NL', 'IT', 'ES', 'PL', 'SE', 'NO', 'FI', 'AT', 'BE', 'CH', 'CZ', 'DK', 'HU', 'IE', 'PT', 'RO', 'SK', 'SI', 'GR', 'BG', 'HR', 'CY', 'EE', 'LT', 'LV', 'LU', 'MT', 'RU', 'UA']
  return eu.includes(countryCode.toUpperCase())
    ? 'https://account.eu.huami.com'
    : 'https://account.huami.com'
}

// ─── Huami direct auth (primary approach for 2025) ────────────────────────────
//
// Two-step flow that works independently of Xiaomi Cloud OAuth:
//   Step 1 → api-user.huami.com/registrations/{email}/tokens
//             POST with password → Location redirect containing access_token + country_code
//   Step 2 → account.huami.com/v2/client/login
//             POST with access_token → app_token + user_id

export interface HuamiCredentials {
  appToken: string
  userId: string
  countryCode: string
  deviceId: string
}

export async function authenticateHuami(
  email: string,
  password: string,
): Promise<HuamiCredentials> {
  const deviceId = crypto.randomBytes(6).toString('hex').toUpperCase()

  // ── Step 1: Get Huami access token via registrations endpoint ──
  const step1Body = new URLSearchParams({
    state: 'REDIRECTION',
    client_id: 'HuaMi',
    redirect_uri: 'https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html',
    token: 'access',
    password,
  })

  let step1Resp: Response
  try {
    step1Resp = await fetch(
      `https://api-user.huami.com/registrations/${encodeURIComponent(email)}/tokens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
        },
        body: step1Body.toString(),
        redirect: 'manual',
        cache: 'no-store',
      },
    )
  } catch (err: any) {
    throw new Error('Сервер Huami недоступен. Проверьте подключение и попробуйте позже.')
  }

  // Step 1 returns a 302/303 redirect — the token is in the Location URL
  const locationHeader = step1Resp.headers.get('location')

  if (!locationHeader) {
    // Non-redirect: parse error body
    let errText = ''
    try { errText = await step1Resp.text() } catch {}
    if (step1Resp.status === 400 || step1Resp.status === 401) {
      throw new Error('Неверный email или пароль Xiaomi / Mi.')
    }
    if (step1Resp.status === 404) {
      throw new Error('Аккаунт не найден. Проверьте email.')
    }
    throw new Error(`Ошибка авторизации Huami (${step1Resp.status})${errText ? ': ' + errText.slice(0, 120) : ''}`)
  }

  let accessToken: string | null = null
  let countryCode = 'US'

  try {
    const locUrl = new URL(locationHeader)
    accessToken = locUrl.searchParams.get('access')
    countryCode = locUrl.searchParams.get('country_code') || 'US'
  } catch {
    throw new Error('Не удалось разобрать ответ Huami. Возможно, API изменился.')
  }

  if (!accessToken) {
    throw new Error('Huami не вернул токен доступа. Проверьте правильность учётных данных.')
  }

  // ── Step 2: Exchange access token for Mi Fitness app_token ──
  const step2Body = new URLSearchParams({
    app_name: 'com.xiaomi.hm.health',
    app_version: '6.3.5',
    country_code: countryCode,
    device_id: deviceId,
    device_model: 'android_phone',
    grant_type: 'access_token',
    third_name: 'huami',
    code: accessToken,
    lang: 'en',
    allow_registration: 'false',
  })

  const huamiBase = huamiAccountBase(countryCode)
  let step2Resp: Response
  try {
    step2Resp = await fetch(`${huamiBase}/v2/client/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
      },
      body: step2Body.toString(),
      cache: 'no-store',
    })
  } catch {
    throw new Error('Сервер Mi Fitness недоступен. Попробуйте позже.')
  }

  if (!step2Resp.ok) {
    throw new Error(`Ошибка Mi Fitness при получении токена (${step2Resp.status}).`)
  }

  const j2 = await step2Resp.json() as any
  const appToken = j2?.token_info?.app_token
  const userId = j2?.token_info?.user_id?.toString()

  if (!appToken || !userId) {
    const errorCode = j2?.code || j2?.error_code
    if (errorCode === 'ACCOUNT_NOT_EXIST') {
      throw new Error('Mi Fitness аккаунт не найден. Убедитесь, что вы зарегистрированы в приложении Mi Fitness.')
    }
    throw new Error('Mi Fitness не вернул токен. Аккаунт может быть не привязан к Mi Scale.')
  }

  return { appToken, userId, countryCode, deviceId }
}

// ─── Mi Fitness body-composition data fetch ───────────────────────────────────

export interface BodyRecord {
  date: string           // YYYY-MM-DD
  weight_kg: number
  bmi: number | null
  body_fat_percent: number | null
  muscle_mass_kg: number | null
  bone_mass_kg: number | null
  water_percent: number | null
  visceral_fat: number | null
}

function parseItem(item: any): BodyRecord | null {
  const raw = (item.date ?? item.dateTime ?? '').toString()
  // Date arrives as "20240115" (8 chars)
  const date = raw.length === 8
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : null

  const w = parseFloat(item.weight ?? item.bodyWeight)
  if (!date || !w || isNaN(w)) return null

  const f = (v: any): number | null => { const x = parseFloat(v); return isNaN(x) || x <= 0 ? null : x }
  const fi = (v: any): number | null => { const x = parseInt(v); return isNaN(x) || x <= 0 ? null : x }

  return {
    date,
    weight_kg: +w.toFixed(2),
    bmi: f(item.bmi),
    body_fat_percent: f(item.bodyfatrate ?? item.fatrate ?? item.bodyFatPercent),
    muscle_mass_kg: f(item.musclemass ?? item.muscleMass),
    bone_mass_kg: f(item.bonemass ?? item.boneMass),
    water_percent: f(item.water ?? item.waterPercent),
    visceral_fat: fi(item.visceralfatgrade ?? item.visceralFatGrade ?? item.visceralfat),
  }
}

export async function fetchBodyData(
  appToken: string,
  userId: string,
  countryCode: string,
  fromDate: string,
  toDate: string,
): Promise<BodyRecord[]> {
  const headers = {
    'apptoken': appToken,
    'userid': userId,
    'User-Agent': UA,
    'appVersion': '6.3.5',
    'appPlatform': 'android',
    'lang': 'en_US',
    'dst': '1',
    'tz': 'Europe/Moscow',
  }

  // Try region-specific endpoint first, then fallback
  const endpoints = [
    miFitEndpoint(countryCode),
    'https://api-mifit-us2.huami.com',
    'https://api-mifit.huami.com',
  ].filter((v, i, a) => a.indexOf(v) === i) // deduplicate

  for (const base of endpoints) {
    let res: Response
    try {
      const url = new URL(`${base}/v1/data/band_data.json`)
      url.searchParams.set('query_type', 'weight')
      url.searchParams.set('source', 'WeightGroup')
      url.searchParams.set('from_date', fromDate)
      url.searchParams.set('to_date', toDate)
      url.searchParams.set('device_type', 'weight')

      res = await fetch(url.toString(), { headers, cache: 'no-store' })
    } catch {
      continue
    }

    if (res.status === 401) {
      throw new Error('Токен Mi Fitness устарел. Отключите и переподключите аккаунт Xiaomi.')
    }

    if (!res.ok) continue

    let data: any
    try { data = await res.json() } catch { continue }

    // code 1 = success
    if (data?.code !== 1) {
      if (data?.code === 40001) throw new Error('Токен Mi Fitness недействителен. Переподключите аккаунт.')
      continue
    }

    const items: any[] = data?.data?.summary ?? []
    const records: BodyRecord[] = []
    for (const item of items) {
      const r = parseItem(item)
      if (r) records.push(r)
    }

    // Deduplicate by date, keep latest per date
    const byDate = new Map<string, BodyRecord>()
    for (const r of records) byDate.set(r.date, r)
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  throw new Error('Mi Fitness API недоступен со всех серверов. Попробуйте импорт CSV как альтернативу.')
}
