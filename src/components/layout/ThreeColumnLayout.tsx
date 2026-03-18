import type { ReactNode } from 'react'
import { ResizablePanel } from './ResizablePanel'

export function ThreeColumnLayout({ left, center, right, isMobile }: {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  isMobile: boolean
}) {
  if (isMobile) {
    return (
      <div className="layout-mobile">
        {center}
        {right}
      </div>
    )
  }

  return (
    <div className="layout-three-column">
      <ResizablePanel side="left" defaultWidth={260} minWidth={200} maxWidth={400}>
        {left}
      </ResizablePanel>
      <div className="layout-center">
        {center}
      </div>
      <ResizablePanel side="right" defaultWidth={340} minWidth={280} maxWidth={500}>
        {right}
      </ResizablePanel>
    </div>
  )
}
