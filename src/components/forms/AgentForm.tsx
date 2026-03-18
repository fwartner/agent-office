import { useState, useEffect, useRef, type FormEvent } from 'react'
import type { PresenceState } from '../../data'
import { useOffice, type OfficeAgent, type AgentCreateInput, type AgentUpdateInput } from '../../office-provider'

type Tab = 'basic' | 'runtime'

export function AgentForm({ agent, onClose }: { agent?: OfficeAgent; onClose: () => void }) {
  const { createAgent, updateAgent, rooms } = useOffice()
  const nameRef = useRef<HTMLInputElement>(null)
  const isEdit = !!agent

  // Auto-open runtime tab if editing an agent with custom runtime config
  const hasCustomRuntime = agent && (
    agent.runtimeProvider !== 'claude-code' ||
    agent.runtimeModel ||
    (agent.runtimeMaxTurns && agent.runtimeMaxTurns !== 3) ||
    (agent.runtimeTimeoutSec && agent.runtimeTimeoutSec !== 300) ||
    agent.runtimeWorkingDir ||
    agent.runtimeAllowedTools
  )
  const [activeTab, setActiveTab] = useState<Tab>(hasCustomRuntime ? 'runtime' : 'basic')

  useEffect(() => { nameRef.current?.focus() }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const maxTurnsRaw = fd.get('runtimeMaxTurns') as string
    const timeoutRaw = fd.get('runtimeTimeoutSec') as string
    const allowedToolsRaw = (fd.get('runtimeAllowedTools') as string || '').trim()
    const allowedToolsJson = allowedToolsRaw
      ? JSON.stringify(allowedToolsRaw.split(',').map(t => t.trim()).filter(Boolean))
      : ''

    if (isEdit) {
      const input: AgentUpdateInput = {
        name: fd.get('name') as string,
        role: fd.get('role') as string,
        team: fd.get('team') as string,
        roomId: fd.get('roomId') as string,
        presence: fd.get('presence') as PresenceState,
        focus: fd.get('focus') as string,
        criticalTask: fd.get('criticalTask') === 'on',
        collaborationMode: fd.get('collaborationMode') as string,
        systemPrompt: fd.get('systemPrompt') as string,
        runtimeMaxTurns: maxTurnsRaw ? Number(maxTurnsRaw) : 3,
        runtimeTimeoutSec: timeoutRaw ? Number(timeoutRaw) : 300,
        runtimeWorkingDir: (fd.get('runtimeWorkingDir') as string) || '',
        runtimeAllowedTools: allowedToolsJson,
        runtimeMode: (fd.get('runtimeMode') as string) || 'full',
        runtimeProvider: (fd.get('runtimeProvider') as string) || 'claude-code',
        runtimeModel: (fd.get('runtimeModel') as string) || '',
      }
      await updateAgent(agent.id, input)
    } else {
      const input: AgentCreateInput = {
        id: fd.get('id') as string,
        name: fd.get('name') as string,
        role: fd.get('role') as string,
        team: fd.get('team') as string,
        roomId: fd.get('roomId') as string,
        presence: (fd.get('presence') as PresenceState) || 'available',
        focus: fd.get('focus') as string,
        criticalTask: fd.get('criticalTask') === 'on',
        collaborationMode: fd.get('collaborationMode') as string,
        systemPrompt: fd.get('systemPrompt') as string,
        runtimeMaxTurns: maxTurnsRaw ? Number(maxTurnsRaw) : 3,
        runtimeTimeoutSec: timeoutRaw ? Number(timeoutRaw) : 300,
        runtimeWorkingDir: (fd.get('runtimeWorkingDir') as string) || '',
        runtimeAllowedTools: allowedToolsJson,
        runtimeMode: (fd.get('runtimeMode') as string) || 'full',
        runtimeProvider: (fd.get('runtimeProvider') as string) || 'claude-code',
        runtimeModel: (fd.get('runtimeModel') as string) || '',
      }
      await createAgent(input)
    }
    onClose()
  }

  return (
    <form className="assign-form agent-form" onSubmit={handleSubmit}>
      <div className="assign-form-head">
        <strong>{isEdit ? `Edit ${agent.name}` : 'Add Agent'}</strong>
        <button type="button" className="assign-close" aria-label="Close" onClick={onClose}>&times;</button>
      </div>

      {/* Tab navigation */}
      <div className="agent-form-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'basic'} className={`agent-form-tab ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>Basic</button>
        <button type="button" role="tab" aria-selected={activeTab === 'runtime'} className={`agent-form-tab ${activeTab === 'runtime' ? 'active' : ''}`} onClick={() => setActiveTab('runtime')}>Runtime</button>
      </div>

      {/* Basic tab */}
      <div role="tabpanel" style={{ display: activeTab === 'basic' ? undefined : 'none' }}>
        {!isEdit && (
          <>
            <label htmlFor="agent-id" className="visually-hidden">Agent ID</label>
            <input id="agent-id" name="id" placeholder="Agent ID (lowercase, hyphens)" required aria-required="true" pattern="[a-z0-9-]+" className="assign-input" />
          </>
        )}
        <label htmlFor="agent-name" className="visually-hidden">Name</label>
        <input ref={nameRef} id="agent-name" name="name" placeholder="Name" required aria-required="true" defaultValue={agent?.name ?? ''} className="assign-input" />
        <label htmlFor="agent-role" className="visually-hidden">Role</label>
        <input id="agent-role" name="role" placeholder="Role" required aria-required="true" defaultValue={agent?.role ?? ''} className="assign-input" />
        <label htmlFor="agent-team" className="visually-hidden">Team</label>
        <input id="agent-team" name="team" placeholder="Team" required aria-required="true" defaultValue={agent?.team ?? ''} className="assign-input" />
        <div className="assign-row">
          <div>
            <label htmlFor="agent-room" className="visually-hidden">Room</label>
            <select id="agent-room" name="roomId" className="assign-select" required aria-required="true" defaultValue={agent?.roomId ?? rooms[0]?.id ?? ''}>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="agent-presence" className="visually-hidden">Presence</label>
            <select id="agent-presence" name="presence" className="assign-select" defaultValue={agent?.effectivePresence ?? 'available'}>
              <option value="available">Available</option>
              <option value="active">Active</option>
              <option value="in_meeting">In meeting</option>
              <option value="paused">Paused</option>
              <option value="blocked">Blocked</option>
              <option value="off_hours">Off hours</option>
            </select>
          </div>
        </div>
        <label htmlFor="agent-focus" className="visually-hidden">Focus</label>
        <input id="agent-focus" name="focus" placeholder="Current focus" defaultValue={agent?.focus ?? ''} className="assign-input" />
        <label htmlFor="agent-collab" className="visually-hidden">Collaboration mode</label>
        <input id="agent-collab" name="collaborationMode" placeholder="Collaboration mode" defaultValue={agent?.collaborationMode ?? ''} className="assign-input" />
        <label className="agent-form-checkbox">
          <input type="checkbox" name="criticalTask" defaultChecked={agent?.criticalTask ?? false} />
          <span>Critical task</span>
        </label>
      </div>

      {/* Runtime tab */}
      <div role="tabpanel" style={{ display: activeTab === 'runtime' ? undefined : 'none' }}>
        <label htmlFor="agent-provider" className="settings-label">Provider</label>
        <select id="agent-provider" name="runtimeProvider" className="assign-select" defaultValue={agent?.runtimeProvider ?? 'claude-code'}>
          <option value="claude-code">Claude Code (CLI)</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama (local)</option>
        </select>

        <label htmlFor="agent-model" className="settings-label">Model</label>
        <input id="agent-model" name="runtimeModel" placeholder="e.g. gpt-4o, llama3.1 (provider default if empty)" defaultValue={agent?.runtimeModel ?? ''} className="assign-input" />

        <details className="system-prompt-section" open>
          <summary className="settings-label" style={{ cursor: 'pointer', padding: '4px 0' }}>System prompt</summary>
          <label htmlFor="agent-prompt" className="visually-hidden">System prompt</label>
          <textarea id="agent-prompt" name="systemPrompt" placeholder="Custom system prompt for this agent..." rows={4} maxLength={5000} defaultValue={agent?.systemPrompt ?? ''} className="assign-input" />
          <div className="prompt-templates">
            <span className="settings-label">Templates:</span>
            <button type="button" className="prompt-template-btn" onClick={e => {
              const ta = (e.target as HTMLElement).closest('details')?.querySelector('textarea')
              if (ta) ta.value = `You are a meticulous code reviewer. Focus on correctness, security, and performance. Flag potential bugs, suggest improvements, and ensure code follows best practices. Be concise but thorough.`
            }}>Code reviewer</button>
            <button type="button" className="prompt-template-btn" onClick={e => {
              const ta = (e.target as HTMLElement).closest('details')?.querySelector('textarea')
              if (ta) ta.value = `You are a technical writer. Write clear, well-structured documentation. Focus on explaining the "why" behind decisions, provide code examples where relevant, and ensure documentation stays actionable and up-to-date.`
            }}>Tech writer</button>
            <button type="button" className="prompt-template-btn" onClick={e => {
              const ta = (e.target as HTMLElement).closest('details')?.querySelector('textarea')
              if (ta) ta.value = `You are a thorough researcher. Investigate topics deeply, cross-reference multiple sources, synthesize findings clearly, and highlight key insights with supporting evidence. Present balanced viewpoints.`
            }}>Researcher</button>
            <button type="button" className="prompt-template-btn" onClick={e => {
              const ta = (e.target as HTMLElement).closest('details')?.querySelector('textarea')
              if (ta) ta.value = `You are a project manager. Break down work into clear tasks, track dependencies, identify blockers early, and communicate status updates concisely. Focus on unblocking the team and maintaining momentum.`
            }}>PM</button>
          </div>
        </details>

        <div className="assign-row">
          <div>
            <label htmlFor="agent-max-turns" className="settings-label">Max turns</label>
            <input id="agent-max-turns" name="runtimeMaxTurns" type="number" min={1} max={50} defaultValue={agent?.runtimeMaxTurns ?? 3} className="assign-input" />
          </div>
          <div>
            <label htmlFor="agent-timeout" className="settings-label">Timeout (sec)</label>
            <input id="agent-timeout" name="runtimeTimeoutSec" type="number" min={10} max={3600} defaultValue={agent?.runtimeTimeoutSec ?? 300} className="assign-input" />
          </div>
        </div>
        <label htmlFor="agent-workdir" className="settings-label">Working directory</label>
        <input id="agent-workdir" name="runtimeWorkingDir" placeholder="Defaults to project root" defaultValue={agent?.runtimeWorkingDir ?? ''} className="assign-input" />
        <label htmlFor="agent-tools" className="settings-label">Allowed tools (comma-separated)</label>
        <textarea id="agent-tools" name="runtimeAllowedTools" placeholder="Read,Grep,Glob" rows={2} defaultValue={(() => { try { const t = agent?.runtimeAllowedTools; return t ? JSON.parse(t).join(', ') : '' } catch { return '' } })()} className="assign-input" />
        <label htmlFor="agent-mode" className="settings-label">Runtime mode</label>
        <select id="agent-mode" name="runtimeMode" className="assign-select" defaultValue={agent?.runtimeMode ?? 'full'}>
          <option value="full">Full (skip permissions)</option>
          <option value="readonly">Readonly (no special permissions)</option>
        </select>
      </div>

      <button type="submit" className="assign-submit">{isEdit ? 'Save changes' : 'Create agent'}</button>
    </form>
  )
}
