import type { HourlyConditions } from './scheduleWeather'
export interface Forecast {
  dailyLowF: number | null
  hourly: HourlyConditions[]
}
const number = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null
export function parseForecast(value: unknown, date: string): Forecast {
  const v = value as {
    daily?: { time?: string[]; apparent_temperature_min?: unknown[] }
    hourly?: {
      time?: unknown[]
      apparent_temperature?: unknown[]
      precipitation_probability?: unknown[]
      wind_speed_10m?: unknown[]
    }
  } | null
  const index = Array.isArray(v?.daily?.time) ? v.daily.time.indexOf(date) : -1
  return {
    dailyLowF: number(v?.daily?.apparent_temperature_min?.[index], -150, 150),
    hourly: Array.isArray(v?.hourly?.time)
      ? v.hourly.time.flatMap((time, i) =>
          typeof time === 'string' && time.startsWith(date + 'T')
            ? [
                {
                  time,
                  feelsLikeF: number(v.hourly?.apparent_temperature?.[i], -150, 150),
                  rainPercent: number(v.hourly?.precipitation_probability?.[i], 0, 100),
                  windMph: number(v.hourly?.wind_speed_10m?.[i], 0, 300),
                },
              ]
            : [],
        )
      : [],
  }
}
const cache = new Map<string, { expires: number; value: Forecast }>()
export async function fetchForecast(
  date: string,
  latitude: number,
  longitude: number,
  timezone: string,
  signal: AbortSignal,
  refresh = false,
): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    hourly: 'apparent_temperature,precipitation_probability,wind_speed_10m',
    daily: 'apparent_temperature_min',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    forecast_days: '16',
  })
  const key = `${date}:${params}`
  const cached = cache.get(key)
  if (!refresh && cached && cached.expires > Date.now()) return cached.value
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) controller.abort()
  const timeout = setTimeout(abort, 12000)
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error('Weather unavailable; enter a feels-like low manually.')
    const value = parseForecast(await response.json(), date)
    if (controller.signal.aborted) throw new Error('Forecast request cancelled.')
    if (cache.size >= 20) cache.clear()
    cache.set(key, { value, expires: Date.now() + 5 * 60_000 })
    return value
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}
