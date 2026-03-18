import type { PresenceState } from '../../data'
import type { OfficeAgent } from '../../office-provider'
import { presenceLabels, presenceIcons } from '../../utils/presence'

export function PresenceSummary({ agents, presenceColors }: {
  agents: OfficeAgent[]
  presenceColors: Record<PresenceState, string>
}) {
  return (
    <div className="presence-summary">
      <h2>Presence</h2>
      <div className="presence-grid">
        {(Object.keys(presenceColors) as PresenceState[]).map(state => {
          const count = agents.filter(a => a.effectivePresence === state).length
          if (count === 0) return null
          return (
            <div key={state} className="presence-row">
              <span className="presence-dot" aria-hidden="true" style={{ background: presenceColors[state] }}>{presenceIcons[state]}</span>
              <span className="presence-name">{presenceLabels[state]}</span>
              <span className="presence-count">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
