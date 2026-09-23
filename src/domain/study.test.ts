import { describe, expect, it } from 'vitest'
import { generateStudyPlan, rankAssignments, validateStudyBlock } from './study'
import type { CalendarEvent, HomeworkAssignment } from './types'

const base = { createdAt: '2026-09-22T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z', source: 'manual' as const }
const assignment = (id: string, dueDate: string, priority: HomeworkAssignment['priority'], minutes = 45): HomeworkAssignment => ({ ...base, id, title: id, course: 'TEST', dueDate, dueTime: '23:59', priority, estimatedMinutes: minutes, progress: 0, status: 'not-started', notes: '', subtasks: [] })

describe('study planner', () => {
  it('ranks earlier deadlines before later high-priority work', () => {
    const ranked = rankAssignments([assignment('later-high', '2026-09-24', 'high'), assignment('soon-low', '2026-09-23', 'low')])
    expect(ranked.map((item) => item.id)).toEqual(['soon-low', 'later-high'])
  })

  it('avoids conflicts and reports work that cannot fit', () => {
    const busy: CalendarEvent = { ...base, id: 'busy', title: 'Class', date: '2026-09-22', startTime: '16:15', endTime: '17:00', kind: 'event' }
    const result = generateStudyPlan([assignment('lab', '2026-09-22', 'high', 90)], [busy], { earliestTime: '16:00', latestTime: '18:00', defaultBlockMinutes: 45, maxBlockMinutes: 60, breakMinutes: 15, avoidTimes: [] }, new Date(2026, 8, 22, 8))
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.startTime).toBe('17:15')
    expect(result.blocks[0]?.endTime).toBe('18:00')
    expect(result.unscheduledMinutes).toBe(45)
  })

  it('plans beyond fourteen days while respecting recurring avoid ranges and complex conflicts', () => {
    const events: CalendarEvent[] = [
      { ...base, id: 'class-1', title: 'Class', date: '2026-10-12', startTime: '09:00', endTime: '10:00', kind: 'event' },
      { ...base, id: 'meeting-1', title: 'Meeting', date: '2026-10-12', startTime: '10:30', endTime: '11:15', kind: 'event' },
    ]
    const result = generateStudyPlan(
      [assignment('thesis', '2026-10-20', 'high', 3_600)],
      events,
      {
        earliestTime: '09:00', latestTime: '12:00', defaultBlockMinutes: 45, maxBlockMinutes: 60, breakMinutes: 15,
        avoidTimes: [{ id: 'monday-lunch', label: 'No Mondays after class', days: [1], startTime: '11:15', endTime: '12:00' }],
      },
      new Date(2026, 8, 22, 8),
    )
    expect(result.unscheduledMinutes).toBe(0)
    expect(result.blocks.some((block) => block.date > '2026-10-06')).toBe(true)
    expect(result.blocks.some((block) => block.date === '2026-10-12' && block.endTime > '11:15')).toBe(false)
  })

  it('reports invalid ranges and non-blocking overlap warnings for direct edits', () => {
    const existing: CalendarEvent = { ...base, id: 'busy', title: 'Lab', date: '2026-09-22', startTime: '10:00', endTime: '11:00', kind: 'event' }
    expect(validateStudyBlock({ id: 'block', date: '2026-09-22', startTime: '10:30', endTime: '10:15' }, [existing])).toEqual({ valid: false, warning: 'End time must be after start time.' })
    expect(validateStudyBlock({ id: 'block', date: '2026-09-22', startTime: '10:30', endTime: '11:15' }, [existing])).toMatchObject({ valid: true, warning: expect.stringContaining('Lab') })
  })
})
