import { useState, useEffect, useCallback, useRef } from 'react'
import { type PresenceState, defaultPresenceColors } from './data'
import { useOffice } from './office-provider'
import { WelcomeOnboarding } from './WelcomeOnboarding'
import { ThreeColumnLayout } from './components/layout/ThreeColumnLayout'
import { LeftSidebar } from './components/layout/LeftSidebar'
import { RightSidebar } from './components/layout/RightSidebar'
import { RoomOverlay } from './components/map/RoomOverlay'
import { AgentSprite } from './components/map/AgentSprite'
import { ToastContainer } from './components/shared/ToastContainer'

const OFFICE_MAP = '/assets/pixelart/office-map.png'
const MAP_NATIVE_W = 640
const MAP_NATIVE_H = 800

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

export function App() {
  const office = useOffice()
  const {
    agents, rooms, officeSettings, activity, assignments,
    agentRuntimeStatuses, decisions, messages, toasts,
    selectedAgentId, selectAgent, berlinTimeLabel, withinWorkday,
    dataSource, connectionError, deleteAgent, cancelTask, createDecision,
    updateDecision, sendMessage, dismissToast, updateAgentPosition,
  } = office

  const presenceColors: Record<PresenceState, string> = officeSettings.theme?.presenceColors ?? defaultPresenceColors
  const isMobile = useIsMobile()

  const [mapScale, setMapScale] = useState(2)
  const [showAgentForm, setShowAgentForm] = useState<'create' | null>(null)
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null)
  const dragAgentStart = useRef<{ x: number; y: number; agentXPct: number; agentYPct: number } | null>(null)
  const mapScrollRef = useRef<HTMLDivElement>(null)

  const pendingResultCount = assignments.filter(a =>
    a.status === 'done' && a.result && a.resultAction !== 'saved' && a.resultAction !== 'dismissed'
  ).length

  const selected = agents.find(a => a.id === selectedAgentId)
  const selectedRoom = selected ? rooms.find(r => r.id === selected.roomId) : undefined
  const clickedRoom = rooms.find(r => r.id === selectedRoomId)

  const handleZoom = useCallback((dir: 1 | -1) => {
    setMapScale(s => Math.min(4, Math.max(1, s + dir * 0.5)))
  }, [])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        selectAgent(null)
        setShowAgentForm(null)
        setSelectedRoomId(null)
        return
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && agents.length > 0) {
        e.preventDefault()
        const idx = agents.findIndex(a => a.id === selectedAgentId)
        const next = e.key === 'ArrowDown'
          ? (idx + 1) % agents.length
          : (idx - 1 + agents.length) % agents.length
        selectAgent(agents[next].id)
        setSelectedRoomId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectAgent, selectedAgentId, agents])

  // Scroll wheel zoom
  useEffect(() => {
    const el = mapScrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setMapScale(s => Math.min(4, Math.max(1, s + (e.deltaY < 0 ? 0.25 : -0.25))))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Agent drag-and-drop
  const handleAgentDragStart = useCallback((agentId: string, e: React.PointerEvent) => {
    const seat = office.agentSeats[agentId]
    if (!seat) return
    setDraggingAgentId(agentId)
    dragAgentStart.current = { x: e.clientX, y: e.clientY, agentXPct: seat.xPct, agentYPct: seat.yPct }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [office.agentSeats])

  useEffect(() => {
    if (!draggingAgentId) return
    const mapContainer = mapScrollRef.current?.querySelector('.map-container')
    if (!mapContainer) return

    function onMove(e: PointerEvent) {
      if (!dragAgentStart.current || !draggingAgentId) return
      const rect = mapContainer!.getBoundingClientRect()
      const xPctMap = ((e.clientX - rect.left) / rect.width) * 100
      const yPctMap = ((e.clientY - rect.top) / rect.height) * 100
      const agent = agents.find(a => a.id === draggingAgentId)
      if (!agent) return
      const room = rooms.find(r => r.id === agent.roomId)
      if (!room) return
      const relX = Math.max(0, Math.min(100, ((xPctMap - room.zone.x) / room.zone.w) * 100))
      const relY = Math.max(0, Math.min(100, ((yPctMap - room.zone.y) / room.zone.h) * 100))
      const snappedX = Math.round(relX / 10) * 10
      const snappedY = Math.round(relY / 10) * 10
      updateAgentPosition(draggingAgentId, snappedX, snappedY)
    }

    function onUp() {
      setDraggingAgentId(null)
      dragAgentStart.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [draggingAgentId, agents, rooms, updateAgentPosition])

  function handleRoomClick(roomId: string) {
    selectAgent(null)
    setSelectedRoomId(selectedRoomId === roomId ? null : roomId)
  }

  function handleAgentClick(agentId: string) {
    selectAgent(selectedAgentId === agentId ? null : agentId)
    setSelectedRoomId(null)
    setShowAgentForm(null)
  }

  const mapW = MAP_NATIVE_W * mapScale
  const mapH = MAP_NATIVE_H * mapScale

  const centerContent = (
    <div className="map-viewport">
      {/* Floating status overlay */}
      <div className="map-status">
        <h1 className="office-title">{officeSettings.officeName || 'Agent Office'}</h1>
        <span className={`office-status ${withinWorkday ? 'on' : 'off'}`}>
          {withinWorkday ? 'Open' : 'Closed'}
        </span>
        <span className={`office-status ${dataSource === 'live' ? 'on' : 'off'}`}>
          {dataSource === 'live' ? 'Live' : 'Seed'}
        </span>
        <span className="berlin-clock">{berlinTimeLabel}</span>
      </div>

      {connectionError && (
        <div className="connection-error-banner" role="alert">
          <span aria-hidden="true">&#x26A0;</span>
          <span>{connectionError}</span>
        </div>
      )}

      <div className="map-controls">
        <button onClick={() => handleZoom(1)} title="Zoom in" aria-label="Zoom in">+</button>
        <button onClick={() => handleZoom(-1)} title="Zoom out" aria-label="Zoom out">&minus;</button>
        <span className="zoom-label">{mapScale}x</span>
      </div>
      <div className="map-scroll" ref={mapScrollRef}>
        <div className="map-container" style={{ width: mapW, height: mapH }}>
          <img src={OFFICE_MAP} alt="Agent Office pixel-art map" className="map-bg" draggable={false} />
          {rooms.map(room => (
            <RoomOverlay
              key={room.id}
              room={room}
              highlight={selectedRoom?.id === room.id || selectedRoomId === room.id}
              agentCount={agents.filter(a => a.roomId === room.id).length}
              onClick={() => handleRoomClick(room.id)}
            />
          ))}
          {agents.map(agent => (
            <AgentSprite
              key={agent.id}
              agent={agent}
              presenceColors={presenceColors}
              onClick={() => handleAgentClick(agent.id)}
              selected={selectedAgentId === agent.id}
              hovered={hoveredAgent === agent.id}
              onHover={h => setHoveredAgent(h ? agent.id : null)}
              onDragStart={e => handleAgentDragStart(agent.id, e)}
              isDragTarget={draggingAgentId === agent.id}
            />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="office-world">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <main id="main-content" className="office-layout">
        <ThreeColumnLayout
          isMobile={isMobile}
          left={
            <LeftSidebar
              agents={agents}
              rooms={rooms}
              presenceColors={presenceColors}
              selectedAgentId={selectedAgentId}
              selectedRoomId={selectedRoomId}
              onAgentClick={handleAgentClick}
              onRoomClick={handleRoomClick}
              onAddAgent={() => { selectAgent(null); setShowAgentForm('create') }}
              onAddRoom={() => {/* handled in settings */}}
            />
          }
          center={centerContent}
          right={
            <RightSidebar
              agents={agents}
              rooms={rooms}
              presenceColors={presenceColors}
              assignments={assignments}
              activity={activity}
              decisions={decisions}
              messages={messages}
              agentRuntimeStatuses={agentRuntimeStatuses}
              dataSource={dataSource}
              selectedAgent={selected}
              selectedRoom={clickedRoom}
              selectedRoomId={selectedRoomId}
              pendingResultCount={pendingResultCount}
              showAgentForm={showAgentForm}
              onDeselectAgent={() => selectAgent(null)}
              onDeleteAgent={deleteAgent}
              onCancelTask={cancelTask}
              onCreateDecision={createDecision}
              onUpdateDecision={updateDecision}
              onSendMessage={sendMessage}
              onCloseAgentForm={() => setShowAgentForm(null)}
              onCloseRoomDetail={() => setSelectedRoomId(null)}
            />
          }
        />
      </main>

      {agents.length === 0 && dataSource !== 'seed' && <WelcomeOnboarding />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
