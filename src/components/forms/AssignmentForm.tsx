import { useEffect, useRef, type FormEvent } from 'react'
import { useOffice } from '../../office-provider'

export function AssignmentForm({ targetAgentId, onClose }: { targetAgentId: string; onClose: () => void }) {
  const { assignTask, agents } = useOffice()
  const agent = agents.find(a => a.id === targetAgentId)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    assignTask({
      targetAgentId,
      taskTitle: fd.get('title') as string,
      taskBrief: fd.get('brief') as string,
      priority: fd.get('priority') as 'low' | 'medium' | 'high',
      routingTarget: fd.get('routing') as 'agent_runtime' | 'work_tracker' | 'both'
    })
    onClose()
  }

  return (
    <form className="assign-form" onSubmit={handleSubmit}>
      <div className="assign-form-head">
        <strong>Assign to {agent?.name ?? targetAgentId}</strong>
        <button type="button" className="assign-close" aria-label="Close" onClick={onClose}>&times;</button>
      </div>
      <label htmlFor="assign-title" className="visually-hidden">Task title</label>
      <input ref={titleRef} id="assign-title" name="title" placeholder="Task title" required aria-required="true" className="assign-input" />
      <label htmlFor="assign-brief" className="visually-hidden">Brief description</label>
      <textarea id="assign-brief" name="brief" placeholder="Brief description" rows={2} className="assign-input" />
      <div className="assign-row">
        <div>
          <label htmlFor="assign-priority" className="visually-hidden">Priority</label>
          <select id="assign-priority" name="priority" className="assign-select" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label htmlFor="assign-routing" className="visually-hidden">Routing target</label>
          <select id="assign-routing" name="routing" className="assign-select" defaultValue="agent_runtime">
            <option value="agent_runtime">Agent runtime</option>
            <option value="work_tracker">Work tracker</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>
      <button type="submit" className="assign-submit">Queue assignment</button>
    </form>
  )
}
