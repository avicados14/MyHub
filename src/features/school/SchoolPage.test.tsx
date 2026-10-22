import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyData } from '../../domain/defaults'
import SchoolPage from './SchoolPage'

const data = createEmptyData()
data.assignments = Array.from({ length: 168 }, (_, index) => ({
  id: `assignment-${String(index).padStart(3, '0')}`,
  title: `Homework ${index}`,
  course: 'TEST 201',
  createdAt: '2026-10-21T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
  dueDate: '2026-10-25',
  dueTime: '23:59',
  priority: 'medium',
  estimatedMinutes: 60,
  progress: 0,
  status: 'not-started',
  notes: '',
  source: 'manual',
  subtasks: [],
}))
vi.mock('../../app/AppContext', () => ({ useApp: () => ({ data, updateData: vi.fn() }) }))

describe('School loading', () => {
  it('bounds initial rendering while keeping every assignment accessible', () => {
    render(
      <MemoryRouter>
        <SchoolPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('article')).toHaveLength(20)
    expect(screen.queryByRole('heading', { name: 'Homework 20' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show more homework (148 remaining)' }))
    expect(screen.getAllByRole('article')).toHaveLength(40)
    expect(screen.getByRole('heading', { name: 'Homework 20' })).toBeInTheDocument()
    expect(data.assignments).toHaveLength(168)
  })
})
