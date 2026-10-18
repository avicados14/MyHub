import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { createEmptyData } from '../../domain/defaults'
import type { HomeworkAssignment } from '../../domain/types'
import DashboardPage from './DashboardPage'

const state = vi.hoisted(() => ({ data: {} }))
vi.mock('../../app/AppContext', () => ({ useApp: () => state }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('shows current deadlines in the calendar zone and refreshes after midnight without removing history', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T05:59:45Z'))
  const data = createEmptyData()
  data.settings.calendarTimeZone = 'America/Denver'
  const assignment = (id: string, dueDate: string, extra = {}): HomeworkAssignment => ({
    id,
    title: id,
    dueDate,
    dueTime: '09:00',
    course: 'TEST',
    priority: 'medium',
    estimatedMinutes: 30,
    progress: 0,
    status: 'not-started',
    notes: '',
    subtasks: [],
    source: 'manual',
    createdAt: '',
    updatedAt: '',
    ...extra,
  })
  data.settings.calendarFeeds = [{ id: 'hidden', name: 'Hidden', kind: 'canvas', enabled: false, status: 'connected' }]
  data.assignments = [
    assignment('Historical', '2026-08-20'),
    assignment('Yesterday', '2026-10-17'),
    assignment('Later', '2026-10-21'),
    assignment('Tomorrow deadline', '2026-10-19'),
    assignment('Today deadline', '2026-10-18'),
    assignment('Next deadline', '2026-10-20'),
    assignment('Done', '2026-10-18', { status: 'complete' }),
    assignment('Hidden', '2026-10-18', { sourceFeedId: 'hidden' }),
  ]
  state.data = data
  const { container } = render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
  const titles = () => Array.from(container.querySelectorAll('.assignment-row strong'), (el) => el.textContent)
  expect(titles()).toEqual(['Today deadline', 'Tomorrow deadline', 'Next deadline'])
  expect(container.querySelector('.assignment-row small')?.textContent).toContain('Today at')
  act(() => {
    vi.advanceTimersByTime(30_000)
  })
  expect(titles()).toEqual(['Tomorrow deadline', 'Next deadline', 'Later'])
  expect(container.querySelector('.assignment-row small')?.textContent).toContain('Today at')
  expect(data.assignments).toHaveLength(8)
  expect(data.assignments[0]?.status).toBe('not-started')

  data.assignments = [assignment('Historical', '2026-08-20')]
  act(() => {
    vi.advanceTimersByTime(30_000)
  })
  expect(titles()).toEqual([])
  expect(screen.getByText('No upcoming assignments. Past-due work is available in School.')).toBeInTheDocument()
})
