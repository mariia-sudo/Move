import crypto from 'crypto'

// ─── Utilities ─────────────────────────────────────────────────────────────────

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex')
}

// Parse all Set-Cookie headers from a response into a flat key=value record
function parseCookies(resp: Response): Record<string, string> {
  const out: Record<string, string> = {}
  // getSetCookie() returns each Set-Cookie header as a separate entry
  const headers = resp.headers as Headers & { getSetCookie?: () => string[] }
  const list = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (resp.headers.get('set-cookie') || '').split(/,(?=[^ ])/)

  for (const c of list) {
    const nameVal = c.split(';')[0].trim()
    const eq = nameVal.indexOf('=')
    if (eq !== -1) {
      out[nameVal.slice(0, eq).trim()] = nameVal.slice(eq + 1).trim()
    }
  }
  return out
}

function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

function stripPrefix(body: string): string {
  return body.replace(/^&&&START&&&/, '').trim()
}

const UA = 'APP/com.xiaomi.mihome APPV/6.0.89 iosPassportSDK/3.9.0 iOS/16.0 miHSTS'

// ─── Xiaomi Account Auth ───────────────────────────────────────────────────────

export interface XiaomiTokens {
  userId: string
  serviceToken: string
  ssecurity: string
}

export async function authenticateXiaomi(
  email: string,
  password: string,
): Promise<XiaomiTokens> {
  const deviceId = crypto.randomBytes(8).toString('hex').toUpperCase()

  // ── Step 1: fetch login page to get _sign ──
  const r1 = await fetch(
    'https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true',
    {
      headers: {
        'User-Agent': UA,
        'Cookie': `sdkVersion=3.9.0; deviceId=${deviceId}`,
      },
      cache: 'no-store',
    },
  )
  const cookies1 = parseCookies(r1)
  const raw1 = stripPrefix(await r1.text())
  let j1: any
  try { j1 = JSON.parse(raw1) } catch {
    throw new Error('Серверы Xiaomi недоступны. Попробуйте позже.')
  }
  const sign = j1?._sign
  if (!sign) throw new Error('Не удалось получить подпись авторизации от Xiaomi.')

  // ── Step 2: submit credentials ──
  const hash = md5(password).toUpperCase()
  const authBody = new URLSearchParams({
    _json: 'true',
    _sign: sign,
    callback: 'https://sts.api.io.mi.com/sts',
    hash,
    sid: 'xiaomiio',
    user: email,
    qs: '?sid=xiaomiio&_json=true',
  })

  const jar2 = { sdkVersion: '3.9.0', deviceId, ...cookies1 }
  const r2 = await fetch('https://account.xiaomi.com/pass/serviceLoginAuth2', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': serializeCookies(jar2),
    },
    body: authBody.toString(),
    redirect: 'manual',
    cache: 'no-store',
  })

  const cookies2 = parseCookies(r2)
  const raw2 = stripPrefix(await r2.text())
  let j2: any
  try { j2 = JSON.parse(raw2) } catch {
    throw new Error('Не удалось обработать ответ авторизации.')
  }

  if (j2.code !== 0) {
    const msg: Record<number, string> = {
      70016: 'Неверный пароль.',
      70019: 'Аккаунт не найден.',
      70010: 'Требуется подтверждение по email — проверьте почту Xiaomi.',
      87001: 'Требуется двухфакторная аутентификация. Войдите сначала в приложение Mi Fitness.',
    }
    throw new Error(msg[j2.code] ?? (j2.desc || `Ошибка авторизации (код ${j2.code}).`))
  }

  const { location, userId, ssecurity } = j2
  if (!location) throw new Error('Не получена ссылка для завершения входа.')

  // ── Step 3: follow location to get serviceToken cookie ──
  const jar3 = { ...jar2, ...cookies2 }
  const r3 = await fetch(location, {
    headers: {
      'User-Agent': UA,
      'Cookie': serializeCookies(jar3),
    },
    redirect: 'manual',
    cache: 'no-store',
  })
  const cookies3 = parseCookies(r3)
  const serviceToken = cookies3['serviceToken']
  if (!serviceToken) throw new Error('Не удалось получить сессионный токен Xiaomi.')

  return { userId: String(userId), serviceToken, ssecurity }
}

// ─── Huami / Mi Fitness token exchange ────────────────────────────────────────

export async function getHuamiAppToken(
  tokens: XiaomiTokens,
  deviceId: string,
): Promise<string> {
  const body = new URLSearchParams({
    app_name: 'com.xiaomi.hm.health',
    app_version: '6.3.5',
    country_code: 'US',
    device_id: deviceId,
    device_model: 'iPhone14,3',
    grant_type: 'access_token',
    source: 'com.xiaomi.hm.health',
    third_name: 'mi-watch',
    token: tokens.serviceToken,
    lang: 'en',
  })

  const res = await fetch('https://account.huami.com/v2/client/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: body.toString(),
    cache: 'no-store',
  })

  const data = await res.json() as any
  const appToken = data?.token_info?.app_token
  if (!appToken) {
    throw new Error('Не удалось получить токен Mi Fitness. Возможно, аккаунт не привязан к Mi Scale.')
  }
  return appToken
}

// ─── Mi Fitness weight / body-composition data ────────────────────────────────

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
  const raw = item.date?.toString() ?? ''
  // date is "20240115" (8 chars)
  const date = raw.length === 8
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : null
  const w = parseFloat(item.weight)
  if (!date || !w || isNaN(w)) return null

  const n = (v: any) => { const x = parseFloat(v); return isNaN(x) || x <= 0 ? null : x }
  const ni = (v: any) => { const x = parseInt(v); return isNaN(x) || x <= 0 ? null : x }

  return {
    date,
    weight_kg: w,
    bmi: n(item.bmi),
    body_fat_percent: n(item.bodyfatrate ?? item.fatrate),
    // Some firmware reports musclerate (%), others musclemass (kg)
    muscle_mass_kg: n(item.musclemass) ?? null,
    bone_mass_kg: n(item.bonemass),
    water_percent: n(item.water),
    visceral_fat: ni(item.visceralfatgrade ?? item.visceralfat),
  }
}

export async function fetchBodyData(
  appToken: string,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<BodyRecord[]> {
  // Try both regional endpoints
  const endpoints = [
    'https://api-mifit-us2.huami.com',
    'https://api-mifit.huami.com',
  ]

  for (const base of endpoints) {
    const url = new URL(`${base}/v1/data/band_data.json`)
    url.searchParams.set('query_type', 'weight')
    url.searchParams.set('source', 'WeightGroup')
    url.searchParams.set('from_date', fromDate)
    url.searchParams.set('to_date', toDate)
    url.searchParams.set('device_type', 'weight')

    let res: Response
    try {
      res = await fetch(url.toString(), {
        headers: {
          'apptoken': appToken,
          'userid': userId,
          'User-Agent': UA,
          'appVersion': '6.3.5',
          'appPlatform': 'iOS',
          'lang': 'en_US',
          'dst': '1',
          'tz': 'Europe/Moscow',
        },
        cache: 'no-store',
      })
    } catch {
      continue // try next endpoint
    }

    if (!res.ok) continue

    const data = await res.json() as any
    if (data.code !== 1) continue

    const records: BodyRecord[] = []
    for (const item of data.data?.summary ?? []) {
      const r = parseItem(item)
      if (r) records.push(r)
    }
    // Deduplicate by date
    const byDate = new Map<string, BodyRecord>()
    for (const r of records) byDate.set(r.date, r)
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  throw new Error('Mi Fitness API недоступен. Попробуйте позже или используйте импорт CSV.')
}
