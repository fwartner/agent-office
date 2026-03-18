import { relativeTime } from '../../utils/time'
import { Markdown } from './Markdown'

export function TaskResultDisplay({ assignment }: { assignment: { id: string; result?: string; resultAction?: string; resultSavedAt?: string } }) {
  if (!assignment.result) return null

  return (
    <div className="task-result">
      <Markdown text={assignment.result} />
      <span className="result-saved-label">
        {assignment.resultSavedAt ? `Saved ${relativeTime(assignment.resultSavedAt)}` : 'Auto-saved'}
      </span>
    </div>
  )
}
