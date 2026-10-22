import { afterEach, expect, it, vi } from 'vitest'
import { fetchForecast, parseForecast } from './forecast'
afterEach(() => vi.unstubAllGlobals())
it('keeps missing values unknown and selects only the requested day', () => {
  expect(
    parseForecast(
      {
        daily: { time: ['2026-10-21'], apparent_temperature_min: [null] },
        hourly: {
          time: ['2026-10-21T08:00', '2026-10-22T08:00'],
          apparent_temperature: [60, 70],
          precipitation_probability: [null],
          wind_speed_10m: [NaN],
        },
      },
      '2026-10-21',
    ),
  ).toEqual({
    dailyLowF: null,
    hourly: [{ time: '2026-10-21T08:00', feelsLikeF: 60, rainPercent: null, windMph: null }],
  })
})
it('requests explicit units/timezone, caches briefly, and lets refresh bypass cache', async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ daily: { time: ['2026-10-22'], apparent_temperature_min: [42] } }),
  })
  vi.stubGlobal('fetch', fetch)
  const args = ['2026-10-22', 39, -105, 'America/Denver', new AbortController().signal] as const
  expect((await fetchForecast(...args)).dailyLowF).toBe(42)
  await fetchForecast(...args)
  expect(fetch).toHaveBeenCalledTimes(1)
  const url = new URL(fetch.mock.calls[0]![0])
  expect(url.searchParams.get('timezone')).toBe('America/Denver')
  expect(url.searchParams.get('wind_speed_unit')).toBe('mph')
  expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit')
  await fetchForecast(...args, true)
  expect(fetch).toHaveBeenCalledTimes(2)
})
