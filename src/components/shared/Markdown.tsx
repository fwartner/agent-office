import { useMemo } from 'react'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

/** Block-level markdown renderer */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    if (!text) return ''
    try { return marked.parse(text) as string } catch { return text }
  }, [text])

  return <div className={`md-content ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Inline markdown — strips block elements, suitable for speech bubbles */
export function InlineMarkdown({ text }: { text: string }) {
  const html = useMemo(() => {
    if (!text) return ''
    try { return (marked.parseInline(text) as string) } catch { return text }
  }, [text])

  return <span className="md-content md-inline" dangerouslySetInnerHTML={{ __html: html }} />
}
