import { BookOpenCheck, CalendarPlus, Check, Clock3, ExternalLink, Lock, LockOpen, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, Field, Modal, PageHeader, SegmentedControl, StatusBadge } from '../../components/ui'
import { generateStudyPlan, rankAssignments } from '../../domain/study'
import type { AssignmentStatus, HomeworkAssignment, Priority } from '../../domain/types'
import { addDays, formatDate, formatTime, makeId, relativeDueLabel, toLocalDate } from '../../utilities/date'
import '../../styles/school-v2.css'

const safeExternalUrl = (value?: string): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

const statusLabel: Record<AssignmentStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  complete: 'Complete',
}

const statusFromProgress = (progress: number, requested: AssignmentStatus): AssignmentStatus => {
  if (progress >= 100 || requested === 'complete') return 'complete'
  if (progress > 0 || requested === 'in-progress') return 'in-progress'
  return 'not-started'
}

export default function SchoolPage() {
  const { data, updateData } = useApp()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'homework'
  const [assignmentModal, setAssignmentModal] = useState<'add' | HomeworkAssignment | null>(null)
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({})
  const assignments = rankAssignments(data.assignments)
  const studyBlocks = data.events.filter((event) => event.kind === 'study').toSorted((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))

  const saveAssignment = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const progress = Math.max(0, Math.min(100, Number(values.get('progress'))))
    const requestedStatus = String(values.get('status')) as AssignmentStatus
    const sourceLabel = String(values.get('sourceLabel') || '').trim()
    const sourceUrl = String(values.get('sourceUrl') || '').trim()
    const current = assignmentModal === 'add' ? null : assignmentModal
    const assignment: HomeworkAssignment = {
      id: current?.id ?? makeId('assignment'),
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
      source: current?.source ?? 'manual',
      title: String(values.get('title')).trim(),
      course: String(values.get('course')).trim(),
      dueDate: String(values.get('dueDate')),
      dueTime: String(values.get('dueTime')),
      priority: String(values.get('priority')) as Priority,
      estimatedMinutes: Math.max(15, Number(values.get('estimatedMinutes'))),
      progress: requestedStatus === 'complete' ? 100 : progress,
      status: statusFromProgress(progress, requestedStatus),
      notes: String(values.get('notes') || '').trim(),
      subtasks: current?.subtasks ?? [],
      ...(sourceLabel ? { sourceLabel } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(current?.sourceFeedId ? { sourceFeedId: current.sourceFeedId } : {}),
      ...(current?.externalId ? { externalId: current.externalId } : {}),
      ...(current?.importedAt ? { importedAt: current.importedAt } : {}),
    }
    updateData((previous) => ({
      ...previous,
      assignments: current
        ? previous.assignments.map((item) => item.id === current.id ? assignment : item)
        : [...previous.assignments, assignment],
    }), current ? 'Homework changes saved.' : 'Homework added.')
    setAssignmentModal(null)
  }

  const generate = () => {
    const retained = data.events.filter((event) => event.kind !== 'study' || event.locked || event.userAdjusted || event.completed)
    const plan = generateStudyPlan(data.assignments, retained, data.settings.study)
    updateData((previous) => ({ ...previous, events: [...previous.events.filter((event) => event.kind !== 'study' || event.locked || event.userAdjusted || event.completed), ...plan.blocks] }), plan.explanation)
  }

  const updateAssignment = (id: string, change: Partial<HomeworkAssignment>, message: string) => {
    updateData((previous) => ({ ...previous, assignments: previous.assignments.map((item) => item.id === id ? { ...item, ...change, updatedAt: new Date().toISOString() } : item) }), message)
  }

  const addSubtask = (assignment: HomeworkAssignment) => {
    const title = (subtaskDrafts[assignment.id] ?? '').trim()
    if (!title) return
    updateAssignment(assignment.id, { subtasks: [...assignment.subtasks, { id: makeId('subtask'), title, completed: false }] }, 'Subtask added.')
    setSubtaskDrafts((previous) => ({ ...previous, [assignment.id]: '' }))
  }

  const updateSubtask = (assignment: HomeworkAssignment, subtaskId: string, change: { title?: string; completed?: boolean }, message: string) => {
    updateAssignment(assignment.id, { subtasks: assignment.subtasks.map((subtask) => subtask.id === subtaskId ? { ...subtask, ...change } : subtask) }, message)
  }

  return (
    <>
      <PageHeader title="School" description="Turn deadlines into a realistic plan around the commitments already on your calendar." action={<button className="button button--primary" type="button" onClick={() => setAssignmentModal('add')}><Plus aria-hidden="true" /> Add homework</button>} />
      <div className="subnav-row">
        <SegmentedControl label="School view" options={[{ value: 'homework', label: 'Homework' }, { value: 'planner', label: 'Study planner' }]} value={view} onChange={(value) => setParams({ view: value })} />
        {view === 'planner' ? <button className="button button--accent" type="button" onClick={generate}><Sparkles aria-hidden="true" /> Generate plan</button> : null}
      </div>

      {view === 'homework' ? (
        <div className="school-layout">
          <div className="assignment-list">
            {assignments.map((assignment) => {
              const sourceUrl = safeExternalUrl(assignment.sourceUrl)
              return (
                <Card key={assignment.id} className="assignment-card" as="article">
                  <div className="assignment-card__top">
                    <div><span className="course-pill">{assignment.course}</span><h2>{assignment.title}</h2></div>
                    <div className="assignment-card__badges"><StatusBadge tone={assignment.status === 'complete' ? 'success' : 'neutral'}>{statusLabel[assignment.status]}</StatusBadge><StatusBadge tone={relativeDueLabel(assignment.dueDate) === 'Overdue' ? 'danger' : assignment.priority === 'high' ? 'attention' : 'neutral'}>{relativeDueLabel(assignment.dueDate)}</StatusBadge></div>
                  </div>
                  <p>{assignment.notes || 'No notes yet.'}</p>
                  <div className="assignment-card__meta"><span><Clock3 aria-hidden="true" /> {assignment.estimatedMinutes} min estimated</span><span><CalendarPlus aria-hidden="true" /> {formatDate(assignment.dueDate)} at {formatTime(assignment.dueTime)}</span></div>
                  {assignment.sourceLabel || sourceUrl ? <div className="source-line"><span>Source: <strong>{assignment.sourceLabel || 'Imported link'}</strong>{assignment.source === 'imported' ? ' · Imported' : ''}</span>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Open source <ExternalLink aria-hidden="true" /></a> : null}</div> : null}
                  <div className="assignment-progress"><label htmlFor={`progress-${assignment.id}`}>Progress <strong>{assignment.progress}%</strong></label><input id={`progress-${assignment.id}`} type="range" min="0" max="100" step="5" value={assignment.progress} onChange={(event) => { const progress = Number(event.target.value); updateAssignment(assignment.id, { progress, status: progress === 100 ? 'complete' : progress > 0 ? 'in-progress' : 'not-started' }, 'Assignment progress updated.') }} /></div>
                  <section className="subtasks" aria-labelledby={`subtasks-${assignment.id}`}>
                    <h3 id={`subtasks-${assignment.id}`}>Subtasks <span>{assignment.subtasks.filter((item) => item.completed).length}/{assignment.subtasks.length}</span></h3>
                    <ul>{assignment.subtasks.map((subtask) => <li key={subtask.id}><input type="checkbox" checked={subtask.completed} aria-label={`Mark ${subtask.title} ${subtask.completed ? 'not complete' : 'complete'}`} onChange={() => updateSubtask(assignment, subtask.id, { completed: !subtask.completed }, 'Subtask updated.')} /><label className="sr-only" htmlFor={`subtask-${subtask.id}`}>Subtask title</label><input id={`subtask-${subtask.id}`} value={subtask.title} onChange={(event) => updateSubtask(assignment, subtask.id, { title: event.target.value }, 'Subtask title updated.')} /><button className="icon-button icon-button--danger" type="button" aria-label={`Delete subtask ${subtask.title}`} onClick={() => updateAssignment(assignment.id, { subtasks: assignment.subtasks.filter((item) => item.id !== subtask.id) }, 'Subtask deleted.')}><Trash2 aria-hidden="true" /></button></li>)}</ul>
                    <form className="subtask-add" onSubmit={(event) => { event.preventDefault(); addSubtask(assignment) }}><label className="sr-only" htmlFor={`new-subtask-${assignment.id}`}>New subtask for {assignment.title}</label><input id={`new-subtask-${assignment.id}`} value={subtaskDrafts[assignment.id] ?? ''} placeholder="Add a next step…" onChange={(event) => setSubtaskDrafts((previous) => ({ ...previous, [assignment.id]: event.target.value }))} /><button className="button button--secondary" type="submit"><Plus aria-hidden="true" /> Add</button></form>
                  </section>
                  <div className="assignment-card__actions"><div><button className="button button--quiet" type="button" onClick={() => setAssignmentModal(assignment)}><Pencil aria-hidden="true" /> Edit</button><button className="button button--quiet" type="button" onClick={() => updateAssignment(assignment.id, { progress: 100, status: 'complete' }, `${assignment.title} marked complete.`)}><Check aria-hidden="true" /> Mark complete</button></div><button className="icon-button icon-button--danger" type="button" aria-label={`Delete ${assignment.title}`} onClick={() => { if (window.confirm(`Delete “${assignment.title}”?`)) updateData((previous) => ({ ...previous, assignments: previous.assignments.filter((item) => item.id !== assignment.id), events: previous.events.filter((event) => event.assignmentId !== assignment.id) }), 'Assignment deleted.') }}><Trash2 aria-hidden="true" /></button></div>
                </Card>
              )
            })}
            {!assignments.length ? <EmptyState title="Homework is clear" detail="Add your next assignment when it arrives." /> : null}
          </div>
          <Card className="planner-summary">
            <span className="section-icon section-icon--lilac"><BookOpenCheck aria-hidden="true" /></span>
            <h2>Plan around real life</h2><p>MyHub plans through each deadline, respects calendar conflicts and your avoid-time ranges, and keeps manual study changes.</p>
            <dl><div><dt>Available window</dt><dd>{formatTime(data.settings.study.earliestTime)}–{formatTime(data.settings.study.latestTime)}</dd></div><div><dt>Default focus</dt><dd>{data.settings.study.defaultBlockMinutes} min</dd></div><div><dt>Avoid ranges</dt><dd>{data.settings.study.avoidTimes.length}</dd></div></dl>
            <button className="button button--accent button--full" type="button" onClick={() => { generate(); setParams({ view: 'planner' }) }}><Sparkles aria-hidden="true" /> Build my study plan</button>
          </Card>
        </div>
      ) : (
        <div className="planner-layout">
          <Card className="planner-brief"><div><span className="section-icon section-icon--blue"><Sparkles aria-hidden="true" /></span><div><h2>Your study plan</h2><p>Generated blocks avoid calendar conflicts. Lock, move, or resize a block and MyHub will preserve it next time.</p></div></div><button className="button button--secondary" type="button" onClick={generate}><RefreshCw aria-hidden="true" /> Regenerate</button></Card>
          <div className="study-block-list">
            {studyBlocks.map((block) => (
              <Card key={block.id} className={block.completed ? 'study-row is-complete' : 'study-row'} as="article">
                <time><strong>{formatDate(block.date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>{formatTime(block.startTime)}–{formatTime(block.endTime)}</span></time>
                <div><h2>{block.title}</h2><p>{block.course} · {block.userAdjusted ? 'Manually adjusted' : 'Generated by MyHub'}</p></div>
                <div className="study-row__actions">
                  <button className="icon-button" type="button" aria-label={`${block.locked ? 'Unlock' : 'Lock'} ${block.title}`} onClick={() => updateData((previous) => ({ ...previous, events: previous.events.map((event) => event.id === block.id ? { ...event, locked: !event.locked } : event) }), block.locked ? 'Study block unlocked.' : 'Study block locked.')}>{block.locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}</button>
                  <button className="button button--quiet" type="button" onClick={() => updateData((previous) => ({ ...previous, events: previous.events.map((event) => event.id === block.id ? { ...event, completed: !event.completed, locked: true } : event) }), block.completed ? 'Study block reopened.' : 'Study block completed.')}><Check aria-hidden="true" /> {block.completed ? 'Reopen' : 'Complete'}</button>
                  <button className="icon-button icon-button--danger" type="button" aria-label={`Delete study block ${block.title}`} onClick={() => updateData((previous) => ({ ...previous, events: previous.events.filter((event) => event.id !== block.id) }), 'Study block deleted.')}><Trash2 aria-hidden="true" /></button>
                </div>
              </Card>
            ))}
            {!studyBlocks.length ? <EmptyState title="No study blocks yet" detail="Generate a plan and MyHub will find open time before each deadline." action={<button className="button button--primary" type="button" onClick={generate}><Sparkles aria-hidden="true" /> Generate plan</button>} /> : null}
          </div>
        </div>
      )}

      <Modal open={assignmentModal !== null} title={assignmentModal === 'add' ? 'Add homework' : 'Edit homework'} description="Keep the assignment details and source together so your plan stays trustworthy." onClose={() => setAssignmentModal(null)}>
        {assignmentModal ? <AssignmentForm key={assignmentModal === 'add' ? 'add' : assignmentModal.id} assignment={assignmentModal === 'add' ? undefined : assignmentModal} onSubmit={saveAssignment} onCancel={() => setAssignmentModal(null)} /> : null}
      </Modal>
    </>
  )
}

function AssignmentForm({ assignment, onSubmit, onCancel }: { assignment?: HomeworkAssignment; onSubmit: (form: HTMLFormElement) => void; onCancel: () => void }) {
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget) }}>
    <Field label="Assignment title"><input name="title" required autoComplete="off" defaultValue={assignment?.title} placeholder="Lab report…" /></Field>
    <Field label="Course"><input name="course" required autoComplete="off" defaultValue={assignment?.course} placeholder="CE EN 482…" /></Field>
    <div className="form-grid__split"><Field label="Due date"><input name="dueDate" type="date" required defaultValue={assignment?.dueDate ?? toLocalDate(addDays(new Date(), 2))} /></Field><Field label="Due time"><input name="dueTime" type="time" required defaultValue={assignment?.dueTime ?? '23:59'} /></Field></div>
    <div className="form-grid__split"><Field label="Priority"><select name="priority" defaultValue={assignment?.priority ?? 'medium'}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field><Field label="Estimated minutes"><input name="estimatedMinutes" type="number" inputMode="numeric" min="15" step="15" required defaultValue={assignment?.estimatedMinutes ?? 60} /></Field></div>
    <div className="form-grid__split"><Field label="Status"><select name="status" defaultValue={assignment?.status ?? 'not-started'}><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Complete</option></select></Field><Field label="Progress percent"><input name="progress" type="number" inputMode="numeric" min="0" max="100" step="5" required defaultValue={assignment?.progress ?? 0} /></Field></div>
    <Field label="Notes"><textarea name="notes" rows={3} defaultValue={assignment?.notes} placeholder="What does done look like?…" /></Field>
    <div className="form-grid__split"><Field label="Source label" hint="For example, Canvas, syllabus, or instructor email."><input name="sourceLabel" autoComplete="off" defaultValue={assignment?.sourceLabel ?? 'Manual assignment'} /></Field><Field label="Source URL" hint="Only http and https links can be opened."><input name="sourceUrl" type="url" inputMode="url" defaultValue={assignment?.sourceUrl} placeholder="https://…" /></Field></div>
    {assignment?.source === 'imported' ? <p className="provenance-note">Imported record{assignment.importedAt ? ` on ${new Date(assignment.importedAt).toLocaleString()}` : ''}. Your progress and subtasks are preserved on re-import.</p> : null}
    <div className="modal__actions"><button className="button button--quiet" type="button" onClick={onCancel}>Cancel</button><button className="button button--primary" type="submit">{assignment ? 'Save changes' : 'Add homework'}</button></div>
  </form>
}
