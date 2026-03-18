import { useState, useEffect, useRef, useCallback } from 'react'
import { useOffice } from '../../office-provider'

interface CommandAction {
  id: string
  label: string
  category: 'agent' | 'room' | 'action'
  action: () => void
}

export function CommandPalette({ onClose, onCreateAgent, onSelectAgent, onSelectRoom }: {
  onClose: () => void
  onCreateAgent: () => void
  onSelectAgent: (id: string) => void
  onSelectRoom: (id: string) => void
}) {
  const { agents, rooms } = useOffice()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const actions: CommandAction[] = [
    { id: 'create-agent', label: 'Create agent', category: 'action', action: () => { onCreateAgent(); onClose() } },
    ...agents.map(a => ({
      id: `agent-${a.id}`,
      label: `${a.name} (${a.id})`,
      category: 'agent' as const,
      action: () => { onSelectAgent(a.id); onClose() },
    })),
    ...rooms.map(r => ({
      id: `room-${r.id}`,
      label: `${r.name}`,
      category: 'room' as const,
      action: () => { onSelectRoom(r.id); onClose() },
    })),
  ]

  const filtered = query
    ? actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))
    : actions

  useEffect(() => { setSelectedIdx(0) }, [query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault()
      filtered[selectedIdx].action()
    }
  }, [filtered, selectedIdx, onClose])

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="Search agents, rooms, actions..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Command search"
        />
        <div className="command-palette-results" role="listbox">
          {filtered.length === 0 && (
            <div className="command-palette-empty">No results</div>
          )}
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              className={`command-palette-item ${idx === selectedIdx ? 'selected' : ''}`}
              role="option"
              aria-selected={idx === selectedIdx}
              onClick={item.action}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <span className={`command-palette-badge ${item.category}`}>
                {item.category === 'agent' ? 'A' : item.category === 'room' ? 'R' : '#'}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
