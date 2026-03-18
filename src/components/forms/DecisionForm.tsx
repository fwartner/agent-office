import { useEffect, useRef, type FormEvent } from 'react'
import type { OfficeAgent } from '../../office-provider'

export function DecisionForm({ agents, onSubmit, onClose }: {
  agents: OfficeAgent[]
  onSubmit: (input: { title: string; detail: string; proposedBy?: string }) => Promise<boolean>
  onClose: () => void
}) {
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.target as HTMLFormElement)
    await onSubmit({
      title: fd.get('title') as string,
      detail: fd.get('detail') as string,
      proposedBy: (fd.get('proposedBy') as string) || undefined
    })
    onClose()
  }

  return (
    <form className="assign-form" onSubmit={handleSubmit}>
      <div className="assign-form-head">
        <strong>New Decision</strong>
        <button type="button" className="assign-close" aria-label="Close" onClick={onClose}>&times;</button>
      </div>
      <label htmlFor="decision-title" className="visually-hidden">Title</label>
      <input ref={titleRef} id="decision-title" name="title" placeholder="Decision title" required className="assign-input" />
      <label htmlFor="decision-detail" className="visually-hidden">Detail</label>
      <textarea id="decision-detail" name="detail" placeholder="Decision detail" rows={3} required className="assign-input" />
      <label htmlFor="decision-proposer" className="visually-hidden">Proposed by</label>
      <select id="decision-proposer" name="proposedBy" className="assign-select">
        <option value="">No proposer</option>
        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="submit" className="assign-submit">Propose decision</button>
    </form>
  )
}
