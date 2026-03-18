import { truncate } from '../../utils/time'
import { InlineMarkdown } from '../shared/Markdown'

export function SpeechBubble({ text, color }: { text: string; color: string }) {
  return (
    <div className="speech-bubble" style={{ ['--bubble-accent' as string]: color }}>
      <div className="speech-text"><InlineMarkdown text={truncate(text, 60)} /></div>
      <div className="speech-tail" />
    </div>
  )
}
