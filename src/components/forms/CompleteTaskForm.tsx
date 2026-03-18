import { useEffect, useRef, type FormEvent } from 'react'
import { useOffice } from '../../office-provider'
import { truncate } from '../../utils/time'

export function CompleteTaskForm({ assignmentId, taskTitle, onClose }: { assignmentId: string; taskTitle: string; onClose: () => void }) {
  const { completeTask } = useOffice()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.target as HTMLFormElement)
    const result = (fd.get('result') as string)?.trim()
    if (!result) return
    completeTask(assignmentId, result)
    onClose()
  }

  return (
    <form className="complete-form" onSubmit={handleSubmit}>
      <div className="assign-form-head">
        <strong>Complete: {truncate(taskTitle, 30)}</strong>
        <button type="button" className="assign-close" aria-label="Close" onClick={onClose}>&times;</button>
      </div>
      <label htmlFor={`result-${assignmentId}`} className="visually-hidden">Result</label>
      <textarea ref={textareaRef} id={`result-${assignmentId}`} name="result" placeholder="Enter task result..." rows={3} required aria-required="true" className="assign-input" />
      <button type="submit" className="assign-submit">Submit result</button>
    </form>
  )
}
