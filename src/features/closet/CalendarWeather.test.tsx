import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createEmptyData } from '../../domain/defaults'
import { CalendarWeather } from './CalendarWeather'
import { fetchForecast } from './forecast'
vi.mock('./forecast', () => ({ fetchForecast: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('uses calendar walks, supports corrections and manual mode, and never exposes event text in Smart context', async () => {
  const data = createEmptyData()
  data.settings.calendarTimeZone = 'America/Denver'
  data.events = [
    {
      id: 'class',
      title: 'PRIVATE CLASS',
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '09:00',
      kind: 'event',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
      location: 'Mines campus',
    },
  ]
  vi.mocked(fetchForecast).mockResolvedValue({
    dailyLowF: 20,
    hourly: [7, 9, 12].map((h) => ({
      time: `2026-10-21T${String(h).padStart(2, '0')}:00`,
      feelsLikeF: h === 12 ? 45 : 60,
      rainPercent: 40,
      windMph: 15,
    })),
  })
  const onChange = vi.fn()
  render(<CalendarWeather data={data} date="2026-10-21" onChange={onChange} />)
  await waitFor(() => expect(onChange.mock.lastCall?.[0].temperature).toBe(60))
  expect(onChange.mock.lastCall?.[0].context).not.toContain('PRIVATE')
  expect(fetchForecast).toHaveBeenCalledWith(
    '2026-10-21',
    39.7555,
    -105.2211,
    'America/Denver',
    expect.any(AbortSignal),
    false,
  )
  fireEvent.click(screen.getByText('Review outdoor times (2)'))
  fireEvent.click(screen.getByText('Add outdoor time'))
  await waitFor(() => expect(onChange.mock.lastCall?.[0].temperature).toBe(45))
  fireEvent.click(screen.getByText('Remove outdoor time 1'))
  fireEvent.click(screen.getByRole('checkbox'))
  await waitFor(() => expect(onChange.mock.lastCall?.[0].temperature).toBe(20))
  fireEvent.change(screen.getByLabelText('Feels-like low °F'), { target: { value: '72' } })
  await waitFor(() => expect(onChange.mock.lastCall?.[0]).toMatchObject({ temperature: 72, context: '' }))
  fireEvent.change(screen.getByLabelText('Weather planning mode'), { target: { value: 'daily' } })
  await waitFor(() => expect(onChange.mock.lastCall?.[0].temperature).toBe(20))
})
it('clears old-date weather and ignores a late response after changing dates', async () => {
  const data = createEmptyData()
  let resolveOld!: (value: { dailyLowF: number; hourly: [] }) => void
  vi.mocked(fetchForecast)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    .mockResolvedValueOnce({ dailyLowF: 65, hourly: [] })
  const onChange = vi.fn()
  const { rerender } = render(<CalendarWeather data={data} date="2026-10-21" onChange={onChange} />)
  rerender(<CalendarWeather data={data} date="2026-10-22" onChange={onChange} />)
  await waitFor(() => expect(onChange.mock.lastCall?.[0].temperature).toBe(65))
  resolveOld({ dailyLowF: 10, hourly: [] })
  await waitFor(() => expect(screen.getByLabelText('Feels-like low °F')).toHaveValue(65))
})
it('offers manual temperature after forecast failure', async () => {
  vi.mocked(fetchForecast).mockRejectedValue(new Error('offline'))
  render(<CalendarWeather data={createEmptyData()} date="2026-10-21" onChange={vi.fn()} />)
  await screen.findByText('Forecast unavailable. Enter a feels-like low manually or refresh to retry.')
  fireEvent.change(screen.getByLabelText('Feels-like low °F'), { target: { value: '55' } })
  expect(screen.getByLabelText('Feels-like low °F')).toHaveValue(55)
})
