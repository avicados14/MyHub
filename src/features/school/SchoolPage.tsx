import { BookOpenCheck, CalendarPlus, Check, Clock3, Lock, LockOpen, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, Field, Modal, PageHeader, SegmentedControl, StatusBadge } from '../../components/ui'
import { generateStudyPlan, rankAssignments } from '../../domain/study'
import type { HomeworkAssignment, Priority } from '../../domain/types'
import { addDays, formatDate, formatTime, makeId, relativeDueLabel, toLocalDate } from '../../utilities/date'

export default function SchoolPage() {
  const { data, updateData } = useApp()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'homework'
  const [addOpen, setAddOpen] = useState(false)
  const assignments = rankAssignments(data.assignments)
  const studyBlocks = data.events.filter((event) => event.kind === 'study').toSorted((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))

  const addAssignment = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const assignment: HomeworkAssignment = {
      id: makeId('assignment'), createdAt: timestamp, updatedAt: timestamp, source: 'manual',
      title: String(values.get('title')), course: String(values.get('course')), dueDate: String(values.get('dueDate')),
      dueTime: String(values.get('dueTime')), priority: String(values.get('priority')) as Priority,
      estimatedMinutes: Number(values.get('estimatedMinutes')), progress: 0, status: 'not-started',
      notes: String(values.get('notes') || ''), subtasks: [], sourceLabel: 'Manual assignment',
    }
    updateData((previous) => ({ ...previous, assignments: [...previous.assignments, assignment] }), 'Homework added.')
    setAddOpen(false)
  }

  const generate = () => {
    const retained = data.events.filter((event) => event.kind !== 'study' || event.locked || event.userAdjusted || event.completed)
    const plan = generateStudyPlan(data.assignments, retained, data.settings.study)
    updateData((previous) => ({ ...previous, events: [...previous.events.filter((event) => event.kind !== 'study' || event.locked || event.userAdjusted || event.completed), ...plan.blocks] }), plan.explanation)
  }

  const updateAssignment = (id: string, change: Partial<HomeworkAssignment>, message: string) => {
    updateData((previous) => ({ ...previous, assignments: previous.assignments.map((item) => item.id === id ? { ...item, ...change, updatedAt: new Date().toISOString() } : item) }), message)
  }

  return (
    <>
      <PageHeader title="School" description="Turn deadlines into a realistic plan around the commitments already on your calendar." action={<button className="button button--primary" type="button" onClick={() => setAddOpen(true)}><Plus aria-hidden="true" /> Add homework</button>} />
      <div className="subnav-row">
        <SegmentedControl label="School view" options={[{ value: 'homework', label: 'Homework' }, { value: 'planner', label: 'Study planner' }]} value={view} onChange={(value) => setParams({ view: value })} />
        {view === 'planner' ? <button className="button button--accent" type="button" onClick={generate}><Sparkles aria-hidden="true" /> Generate plan</button> : null}
      </div>

      {view === 'homework' ? (
        <div className="school-layout">
          <div className="assignment-list">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="assignment-card" as="article">
                <div className="assignment-card__top"><div><span className="course-pill">{assignment.course}</span><h2>{assignment.title}</h2></div><StatusBadge tone={relativeDueLabel(assignment.dueDate) === 'Overdue' ? 'danger' : assignment.priority === 'high' ? 'attention' : 'neutral'}>{relativeDueLabel(assignment.dueDate)}</StatusBadge></div>
                <p>{assignment.notes || 'No notes yet.'}</p>
                <div className="assignment-card__meta"><span><Clock3 aria-hidden="true" /> {assignment.estimatedMinutes} min estimated</span><span><CalendarPlus aria-hidden="true" /> {formatDate(assignment.dueDate)} at {formatTime(assignment.dueTime)}</span></div>
                <div className="assignment-progress"><label htmlFor={`progress-${assignment.id}`}>Progress <strong>{assignment.progress}%</strong></label><input id={`progress-${assignment.id}`} type="range" min="0" max="100" step="10" value={assignment.progress} onChange={(event) => updateAssignment(assignment.id, { progress: Number(event.target.value), status: Number(event.target.value) === 100 ? 'complete' : Number(event.target.value) > 0 ? 'in-progress' : 'not-started' }, 'Assignment progress updated.')} /></div>
                <div className="assignment-card__actions"><button className="button button--quiet" type="button" onClick={() => updateAssignment(assignment.id, { progress: 100, status: 'complete' }, `${assignment.title} marked complete.`)}><Check aria-hidden="true" /> Mark complete</button><button className="icon-button icon-button--danger" type="button" aria-label={`Delete ${assignment.title}`} onClick={() => { if (window.confirm(`Delete “${assignment.title}”?`)) updateData((previous) => ({ ...previous, assignments: previous.assignments.filter((item) => item.id !== assignment.id), events: previous.events.filter((event) => event.assignmentId !== assignment.id) }), 'Assignment deleted.') }}><Trash2 aria-hidden="true" /></button></div>
              </Card>
            ))}
            {!assignments.length ? <EmptyState title="Homework is clear" detail="Add your next assignment when it arrives." /> : null}
          </div>
          <Card className="planner-summary">
            <span className="section-icon section-icon--lilac"><BookOpenCheck aria-hidden="true" /></span>
            <h2>Plan around real life</h2><p>MyHub uses due dates, remaining effort, and calendar conflicts to build 45-minute focus blocks with breaks.</p>
            <dl><div><dt>Available window</dt><dd>{formatTime(data.settings.study.earliestTime)}–{formatTime(data.settings.study.latestTime)}</dd></div><div><dt>Default focus</dt><dd>{data.settings.study.defaultBlockMinutes} min</dd></div><div><dt>Breaks</dt><dd>{data.settings.study.breakMinutes} min</dd></div></dl>
            <button className="button button--accent button--full" type="button" onClick={() => { generate(); setParams({ view: 'planner' }) }}><Sparkles aria-hidden="true" /> Build my study plan</button>
          </Card>
        </div>
      ) : (
        <div className="planner-layout">
          <Card className="planner-brief"><div><span className="section-icon section-icon--blue"><Sparkles aria-hidden="true" /></span><div><h2>Your study plan</h2><p>Generated blocks avoid calendar conflicts. Lock or move a block and MyHub will preserve it next time.</p></div></div><button className="button button--secondary" type="button" onClick={generate}><RefreshCw aria-hidden="true" /> Regenerate</button></Card>
          <div className="study-block-list">
            {studyBlocks.map((block) => (
              <Card key={block.id} className={block.completed ? 'study-row is-complete' : 'study-row'} as="article">
                <time><strong>{formatDate(block.date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>{formatTime(block.startTime)}–{formatTime(block.endTime)}</span></time>
                <div><h2>{block.title}</h2><p>{block.course} · {block.userAdjusted ? 'Manually adjusted' : 'Generated by MyHub'}</p></div>
                <div className="study-row__actions">
                  <button className="icon-button" type="button" aria-label={`${block.locked ? 'Unlock' : 'Lock'} ${block.title}`} onClick={() => updateData((previous) => ({ ...previous, events: previous.events.map((event) => event.id === block.id ? { ...event, locked: !event.locked } : event) }), block.locked ? 'Study block unlocked.' : 'Study block locked.')} >{block.locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}</button>
                  <button className="button button--quiet" type="button" onClick={() => updateData((previous) => ({ ...previous, events: previous.events.map((event) => event.id === block.id ? { ...event, completed: !event.completed, locked: true } : event) }), block.completed ? 'Study block reopened.' : 'Study block completed.')}><Check aria-hidden="true" /> {block.completed ? 'Reopen' : 'Complete'}</button>
                  <button className="icon-button icon-button--danger" type="button" aria-label={`Delete study block ${block.title}`} onClick={() => updateData((previous) => ({ ...previous, events: previous.events.filter((event) => event.id !== block.id) }), 'Study block deleted.')}><Trash2 aria-hidden="true" /></button>
                </div>
              </Card>
            ))}
            {!studyBlocks.length ? <EmptyState title="No study blocks yet" detail="Generate a plan and MyHub will find open time before each deadline." action={<button className="button button--primary" type="button" onClick={generate}><Sparkles aria-hidden="true" /> Generate plan</button>} /> : null}
          </div>
        </div>
      )}

      <Modal open={addOpen} title="Add homework" description="An estimate helps MyHub reserve enough time before the deadline." onClose={() => setAddOpen(false)}>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); addAssignment(event.currentTarget) }}>
          <Field label="Assignment title"><input name="title" required autoComplete="off" placeholder="Lab report…" /></Field>
          <Field label="Course"><input name="course" required autoComplete="off" placeholder="CE EN 482…" /></Field>
          <div className="form-grid__split"><Field label="Due date"><input name="dueDate" type="date" required defaultValue={toLocalDate(addDays(new Date(), 2))} /></Field><Field label="Due time"><input name="dueTime" type="time" required defaultValue="23:59" /></Field></div>
          <div className="form-grid__split"><Field label="Priority"><select name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field><Field label="Estimated minutes"><input name="estimatedMinutes" type="number" inputMode="numeric" min="15" step="15" required defaultValue="60" /></Field></div>
          <Field label="Notes"><textarea name="notes" rows={3} placeholder="What does done look like?…" /></Field>
          <div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setAddOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Add homework</button></div>
        </form>
      </Modal>
    </>
  )
}
