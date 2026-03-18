import { useState } from 'react'
import type { PresenceState } from '../../data'
import { useOffice, type OfficeAgent } from '../../office-provider'
import { characterSprites, getCharacterSprite, getSpriteAnimData, type CharacterSpriteSet, type SpriteAnimData } from '../../world'
import { presenceLabels } from '../../utils/presence'
import { useSpriteFrame } from '../../hooks/useSpriteFrame'
import { SpeechBubble } from './SpeechBubble'

function AnimatedSpriteImg({ spriteSet, animData, spriteUrl, frame, onError }: {
  spriteSet: CharacterSpriteSet
  animData: SpriteAnimData
  spriteUrl: string
  frame: number
  onError?: () => void
}) {
  const { frameWidth, frameHeight } = animData
  const { scale } = spriteSet
  const w = frameWidth * scale
  const h = frameHeight * scale
  return (
    <div
      className="sprite-frame-clip"
      style={{
        width: w,
        height: h,
        position: 'absolute',
        left: '50%',
        bottom: 8,
        transform: 'translateX(-50%)',
        overflow: 'hidden'
      }}
    >
      <img
        src={spriteUrl}
        alt=""
        className="sprite-art-strip"
        style={{
          height: h,
          width: 'auto',
          imageRendering: 'pixelated',
          marginLeft: -(frame * w),
          pointerEvents: 'none'
        }}
        draggable={false}
        onError={onError}
      />
    </div>
  )
}

export function AgentSprite({ agent, presenceColors, onClick, selected, hovered, onHover, onDragStart, isDragTarget }: {
  agent: OfficeAgent
  presenceColors: Record<PresenceState, string>
  onClick: () => void
  selected: boolean
  hovered: boolean
  onHover: (hovering: boolean) => void
  onDragStart?: (e: React.PointerEvent) => void
  isDragTarget?: boolean
}) {
  const { rooms, agentSeats, agentBubbles } = useOffice()
  const [spriteFailed, setSpriteFailed] = useState(false)
  const room = rooms.find(r => r.id === agent.roomId)
  const seat = agentSeats[agent.id]

  const spriteSet = characterSprites[agent.id]
  const spriteUrl = spriteSet ? getCharacterSprite(spriteSet, agent.effectivePresence) : null
  const animData = spriteUrl ? getSpriteAnimData(spriteUrl) : null
  const animated = animData ? animData.frameCount > 1 : false
  const frame = useSpriteFrame(animated ? animData!.frameCount : 1, 5)
  const taskBubble = agentBubbles.get(agent.id)
  const color = presenceColors[agent.effectivePresence]
  const isIdle = agent.effectivePresence === 'off_hours' || agent.effectivePresence === 'paused'
  const showFocusBubble = !taskBubble && (selected || hovered)

  if (!room || !seat) return null

  return (
    <div
      className={`agent-sprite ${selected ? 'selected' : ''} ${isIdle ? 'idle' : ''} ${isDragTarget ? 'dragging-agent' : ''}`}
      style={{
        left: `${room.zone.x + seat.xPct * room.zone.w / 100}%`,
        top: `${room.zone.y + seat.yPct * room.zone.h / 100}%`,
        ['--accent' as string]: color,
        ['--label-offset-y' as string]: `${spriteSet?.labelOffsetY ?? 34}px`
      }}
      role="button"
      tabIndex={0}
      aria-label={`${agent.name}, ${presenceLabels[agent.effectivePresence]}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onPointerDown={onDragStart}
    >
      {taskBubble && (
        <div aria-hidden="true">
          <SpeechBubble text={taskBubble.text} color={taskBubble.color} />
        </div>
      )}
      {showFocusBubble && (
        <div aria-hidden="true">
          <SpeechBubble text={agent.focus} color={color} />
        </div>
      )}
      <div className="sprite-shadow" />
      {spriteUrl && spriteSet && animData && !spriteFailed ? (
        animData.frameCount > 1 ? (
          <AnimatedSpriteImg spriteSet={spriteSet} animData={animData} spriteUrl={spriteUrl} frame={frame} onError={() => setSpriteFailed(true)} />
        ) : (
          <img
            src={spriteUrl}
            alt={agent.name}
            className="sprite-art"
            style={{
              width: animData.frameWidth * spriteSet.scale,
              height: animData.frameHeight * spriteSet.scale,
              transform: 'translate(-50%, -100%)'
            }}
            draggable={false}
            onError={() => setSpriteFailed(true)}
          />
        )
      ) : (
        <div className="sprite-dot" style={{ background: color, boxShadow: `0 0 8px ${color}88` }}>
          <span className="sprite-initial">{agent.name[0]}</span>
        </div>
      )}
      <div className={`sprite-badge presence-${agent.effectivePresence}`} style={{ background: color }} />
      <div className="sprite-label">{agent.name}</div>
      {(agent.effectivePresence === 'active' || agent.effectivePresence === 'in_meeting') && (
        <div className="sprite-pulse" style={{ borderColor: color }} />
      )}
    </div>
  )
}
