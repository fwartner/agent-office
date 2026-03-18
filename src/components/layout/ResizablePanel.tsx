import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'

export function ResizablePanel({ children, side, defaultWidth, minWidth, maxWidth, className }: {
  children: ReactNode
  side: 'left' | 'right'
  defaultWidth: number
  minWidth: number
  maxWidth: number
  className?: string
}) {
  const storageKey = `panel-width-${side}`
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? Math.max(minWidth, Math.min(maxWidth, Number(saved))) : defaultWidth
  })
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const widthRef = useRef(width)

  // Keep ref in sync with state
  useEffect(() => { widthRef.current = width }, [width])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = widthRef.current
    e.preventDefault()
  }, [])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return
      const delta = side === 'left'
        ? e.clientX - startX.current
        : startX.current - e.clientX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta))
      setWidth(newWidth)
    }
    function onUp() {
      if (isDragging.current) {
        isDragging.current = false
        localStorage.setItem(storageKey, String(widthRef.current))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [side, minWidth, maxWidth, storageKey])

  return (
    <div className={`resizable-panel resizable-${side} ${className ?? ''}`} style={{ width, flexShrink: 0 }}>
      {children}
      <div
        className="resize-handle"
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
