import { useState, useEffect } from 'react'

/** Sprite animation hook — cycles through frames at a given FPS */
export function useSpriteFrame(frameCount: number, fps: number = 6): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (frameCount <= 1) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % frameCount)
    }, 1000 / fps)
    return () => clearInterval(interval)
  }, [frameCount, fps])
  return frameCount <= 1 ? 0 : frame
}
