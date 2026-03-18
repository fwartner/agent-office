import type { OfficeAgent } from '../../office-provider'
import { safeTime, relativeTime } from '../../utils/time'

export function DecisionCard({ decision, agents, onUpdate }: {
  decision: { id: string; title: string; detail: string; status: string; proposedBy: string | null; createdAt: string }
  agents: OfficeAgent[]
  onUpdate: (id: string, input: { status?: string }) => Promise<boolean>
}) {
  const proposer = decision.proposedBy ? agents.find(a => a.id === decision.proposedBy) : null
  const statusColors: Record<string, string> = { proposed: '#ffd479', accepted: '#78f7b5', rejected: '#ff8b8b' }
  return (
    <div className="decision-card" style={{ borderLeftColor: statusColors[decision.status] || '#8792a8' }}>
      <div className="decision-head">
        <strong>{decision.title}</strong>
        <span className="decision-status" style={{ color: statusColors[decision.status] }}>{decision.status}</span>
      </div>
      <p className="decision-detail">{decision.detail}</p>
      <div className="decision-meta">
        {proposer && <span>Proposed by {proposer.name}</span>}
        <span>{safeTime(decision.createdAt)} · {relativeTime(decision.createdAt)}</span>
      </div>
      {decision.status === 'proposed' && (
        <div className="decision-actions">
          <button className="decision-accept" onClick={() => onUpdate(decision.id, { status: 'accepted' })}>Accept</button>
          <button className="decision-reject" onClick={() => onUpdate(decision.id, { status: 'rejected' })}>Reject</button>
        </div>
      )}
    </div>
  )
}
