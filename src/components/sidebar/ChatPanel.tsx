import { useState, useEffect, useRef, type FormEvent } from 'react'
import type { OfficeAgent } from '../../office-provider'
import { safeTime } from '../../utils/time'
import { InlineMarkdown } from '../shared/Markdown'

export function ChatPanel({ messages, agents, rooms, currentRoomId, onSend }: {
  messages: Array<{ id: string; fromAgentId: string; toAgentId: string | null; roomId: string | null; message: string; createdAt: string }>
  agents: OfficeAgent[]
  rooms: Array<{ id: string; name: string }>
  currentRoomId: string | null
  onSend: (input: { fromAgentId: string; toAgentId?: string; roomId?: string; message: string }) => Promise<boolean>
}) {
  const [selectedRoom, setSelectedRoom] = useState(currentRoomId || rooms[0]?.id || '')
  const roomMsgs = messages.filter(m => m.roomId === selectedRoom).slice(-30)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight) }, [roomMsgs.length])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.target as HTMLFormElement)
    const msg = (fd.get('message') as string)?.trim()
    const toAgent = fd.get('toAgent') as string
    if (!msg) return
    const input: { fromAgentId: string; toAgentId?: string; roomId?: string; message: string } = {
      fromAgentId: '__user__',
      roomId: selectedRoom,
      message: msg,
    }
    if (toAgent && toAgent !== '__room__') {
      input.toAgentId = toAgent
    }
    onSend(input)
    ;(e.target as HTMLFormElement).reset()
  }

  return (
    <div className="chat-panel" role="tabpanel">
      <div className="chat-room-select">
        <label htmlFor="chat-room" className="visually-hidden">Room</label>
        <select id="chat-room" className="assign-select" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div className="chat-messages" ref={listRef}>
        {roomMsgs.length === 0 && <p className="feed-empty">No messages in this room</p>}
        {roomMsgs.map(m => {
          const sender = (m.fromAgentId === '__user__' || m.fromAgentId === '__telegram__') ? null : agents.find(a => a.id === m.fromAgentId)
          const senderName = m.fromAgentId === '__user__' ? 'You' : m.fromAgentId === '__telegram__' ? 'Telegram' : sender?.name ?? m.fromAgentId
          return (
            <div key={m.id} className="chat-msg">
              <strong className="chat-sender">{senderName}</strong>
              <span className="chat-text"><InlineMarkdown text={m.message} /></span>
              <span className="chat-time">{safeTime(m.createdAt)}</span>
            </div>
          )
        })}
      </div>
      {agents.length > 0 && (
        <form className="chat-form" onSubmit={handleSubmit}>
          <select name="toAgent" className="assign-select chat-agent-select" title="Send to">
            <option value="__room__">All agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input name="message" placeholder="Type a message..." className="assign-input chat-input" autoComplete="off" />
          <button type="submit" className="assign-submit chat-send">Send</button>
        </form>
      )}
    </div>
  )
}
