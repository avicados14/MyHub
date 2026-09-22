import { describe, expect, it } from 'vitest'
import { generateStudyPlan, rankAssignments } from './study'
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
    const result = generateStudyPlan([assignment('lab', '2026-09-22', 'high', 90)], [busy], { earliestTime: '16:00', latestTime: '18:00', defaultBlockMinutes: 45, maxBlockMinutes: 60, breakMinutes: 15 }, new Date(2026, 8, 22, 8))
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.startTime).toBe('17:15')
    expect(result.blocks[0]?.endTime).toBe('18:00')
    expect(result.unscheduledMinutes).toBe(45)
  })
})
