import { useState } from 'react'
import type { OfficeAgent } from '../../office-provider'
import type { DecisionRecord } from '../../data'
import { DecisionCard } from '../shared/DecisionCard'
import { DecisionForm } from '../forms/DecisionForm'

export function DecisionsPanel({ decisions, agents, createDecision, updateDecision }: {
  decisions: DecisionRecord[]
  agents: OfficeAgent[]
  createDecision: (input: { title: string; detail: string; proposedBy?: string }) => Promise<boolean>
  updateDecision: (id: string, input: { status?: string }) => Promise<boolean>
}) {
  const [showDecisionForm, setShowDecisionForm] = useState(false)

  return (
    <div className="decisions-panel" role="tabpanel">
      <button className="add-agent-btn" onClick={() => setShowDecisionForm(true)}>+ New Decision</button>
      {showDecisionForm && <DecisionForm agents={agents} onSubmit={createDecision} onClose={() => setShowDecisionForm(false)} />}
      {decisions.length === 0 && !showDecisionForm && <p className="feed-empty">No decisions yet</p>}
      {decisions.map(d => (
        <DecisionCard key={d.id} decision={d} agents={agents} onUpdate={updateDecision} />
      ))}
    </div>
  )
}
